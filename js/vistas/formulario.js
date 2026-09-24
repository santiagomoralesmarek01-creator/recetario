import { el, mostrar, cargando, aviso, vigencia } from '../dom.js';
import { usuario, nombreVisible, pedirLogin } from '../auth.js';
import { hayBackend } from '../supabase.js';
import * as misRecetas from '../misRecetas.js';
import { crearImagen, urlIngrediente, IMG_INGREDIENTE_GENERICO, IMG_PLATO_GENERICO } from '../imagenes.js';
import { CATEGORIAS, ingredienteEnIngles } from '../traducciones.js';
import { sinBackend } from './cuenta.js';
import { sugerir, buscarExacto, UNIDADES, SIN_CANTIDAD, armarMedida, separarMedida, cargarIngredientes } from '../ingredientes.js';
import { NOMBRES_PAISES } from '../paises.js';

const MAX_LADO = 1600;

// Achica la foto en el navegador antes de subirla: menos espera y menos espacio usado.
async function reducirImagen(archivo) {
  if (!archivo.type.startsWith('image/') || archivo.type === 'image/gif') return archivo;
  try {
    const bitmap = await createImageBitmap(archivo);
    const escala = Math.min(1, MAX_LADO / Math.max(bitmap.width, bitmap.height));
    if (escala === 1 && archivo.size < 800_000) return archivo;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85));
    return blob ? new File([blob], 'foto.jpg', { type: 'image/jpeg' }) : archivo;
  } catch {
    return archivo;
  }
}

// Fila de ingrediente: buscador con sugerencias (con imagen) + cantidad + unidad.
// Se puede escribir un ingrediente que no esté en la lista; la imagen se intenta adivinar.
function filaIngrediente(datos = {}) {
  let clave = datos.imagen || '';
  const vista = crearImagen(IMG_INGREDIENTE_GENERICO, '', IMG_INGREDIENTE_GENERICO, 'ingrediente-vista');
  const mostrarImagen = () => {
    const k = clave || ingredienteEnIngles(nombre.value);
    vista.src = k ? urlIngrediente(k) : IMG_INGREDIENTE_GENERICO;
  };

  const lista = el('ul', { class: 'sugerencias', role: 'listbox', hidden: true });
  let opciones = [];
  let activa = -1;

  const nombre = el('input', {
    name: 'ing-nombre', placeholder: 'Buscá un ingrediente…', value: datos.nombre || '',
    'aria-label': 'Ingrediente', maxlength: '80', autocomplete: 'off', role: 'combobox', 'aria-autocomplete': 'list',
  });

  function cerrar() {
    lista.hidden = true;
    activa = -1;
    nombre.setAttribute('aria-expanded', 'false');
  }

  function marcar(i) {
    activa = i;
    [...lista.children].forEach((li, j) => li.classList.toggle('activa', j === i));
  }

  function elegir(ing) {
    nombre.value = ing.nombre;
    clave = ing.clave;
    mostrarImagen();
    cerrar();
    cantidad.focus();
  }

  async function actualizarSugerencias() {
    const texto = nombre.value;
    opciones = await sugerir(texto);
    if (nombre.value !== texto) return; // el usuario siguió escribiendo
    lista.replaceChildren(...opciones.map((ing, i) =>
      el('li', {
        role: 'option',
        // mousedown en vez de click: se dispara antes de que el input pierda el foco
        onmousedown: (e) => { e.preventDefault(); elegir(ing); },
        onmouseenter: () => marcar(i),
      },
      crearImagen(ing.clave ? urlIngrediente(ing.clave) : IMG_INGREDIENTE_GENERICO, '', IMG_INGREDIENTE_GENERICO),
      el('span', {}, ing.nombre))));
    lista.hidden = opciones.length === 0;
    nombre.setAttribute('aria-expanded', String(!lista.hidden));
    marcar(opciones.length ? 0 : -1);
  }

  nombre.addEventListener('input', () => { clave = ''; actualizarSugerencias(); });
  nombre.addEventListener('focus', () => { if (nombre.value) actualizarSugerencias(); });
  nombre.addEventListener('blur', async () => {
    cerrar();
    if (!clave && nombre.value.trim()) {
      const exacto = await buscarExacto(nombre.value);
      if (exacto) clave = exacto.clave;
    }
    mostrarImagen();
  });
  nombre.addEventListener('keydown', (e) => {
    if (lista.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); marcar((activa + 1) % opciones.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); marcar((activa - 1 + opciones.length) % opciones.length); }
    else if (e.key === 'Enter' && activa >= 0) { e.preventDefault(); elegir(opciones[activa]); }
    else if (e.key === 'Escape') cerrar();
  });

  const { cantidad: cant, unidad: unid } = separarMedida(datos.medida || '');
  const cantidad = el('input', {
    name: 'ing-cantidad', placeholder: 'Cant.', value: cant, 'aria-label': 'Cantidad',
    inputmode: 'decimal', maxlength: '12', class: 'campo-cantidad',
  });
  const unidad = el('select', {
    name: 'ing-unidad', 'aria-label': 'Unidad',
    onchange: () => {
      cantidad.disabled = SIN_CANTIDAD.has(unidad.value);
      if (cantidad.disabled) cantidad.value = '';
    },
  }, UNIDADES.map(([valor, singular, plural]) =>
    el('option', { value: valor, selected: valor === unid }, valor ? plural : 'unidades')));
  cantidad.disabled = SIN_CANTIDAD.has(unid);

  const fila = el('li', { class: 'fila-editable fila-ingrediente' },
    vista,
    el('div', { class: 'combo' }, nombre, lista),
    cantidad,
    unidad,
    el('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Quitar ingrediente', onclick: () => fila.remove() }, '✕'));
  fila.leer = () => ({
    nombre: nombre.value.trim(),
    medida: armarMedida(cantidad.value, unidad.value),
    ...(clave ? { imagen: clave } : {}),
  });
  mostrarImagen();
  return fila;
}

function filaPaso(texto = '') {
  const fila = el('li', { class: 'fila-editable' },
    el('textarea', { name: 'paso', rows: '2', placeholder: 'Describí este paso…', 'aria-label': 'Paso', maxlength: '1000' }, texto),
    el('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Quitar paso', onclick: () => fila.remove() }, '✕'));
  return fila;
}

export async function vistaFormulario(uuid = null) {
  if (!hayBackend) return sinBackend();
  const u = usuario();
  if (!u) { pedirLogin(); return; }
  cargarIngredientes(); // se precarga para que el buscador responda al instante

  let receta = null;
  if (uuid) {
    const vigente = vigencia();
    cargando();
    receta = await misRecetas.obtener(uuid);
    if (!vigente()) return;
    if (!receta || receta.userId !== u.id) {
      mostrar(el('p', { class: 'estado' }, 'No podés editar esta receta.'));
      return;
    }
  }

  let archivoFoto = null;
  let urlFoto = receta?.imagen || '';
  const vistaFoto = crearImagen(urlFoto || IMG_PLATO_GENERICO, 'Vista previa', IMG_PLATO_GENERICO, 'foto-vista');
  const inputUrl = el('input', {
    name: 'imagen_url', type: 'url', placeholder: 'o pegá el enlace de una imagen', value: urlFoto.includes('/fotos-recetas/') ? '' : urlFoto,
    onchange: (e) => {
      archivoFoto = null;
      urlFoto = e.target.value.trim();
      vistaFoto.src = urlFoto || IMG_PLATO_GENERICO;
    },
  });
  const inputArchivo = el('input', {
    type: 'file', accept: 'image/*', capture: 'environment',
    onchange: async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      if (f.size > 15_000_000) { aviso('La foto es demasiado grande (máx. 15 MB).', 'error'); return; }
      archivoFoto = await reducirImagen(f);
      inputUrl.value = '';
      vistaFoto.src = URL.createObjectURL(archivoFoto);
    },
  });

  const listaIngredientes = el('ul', { class: 'lista-editable' },
    (receta?.ingredientesCrudos?.length ? receta.ingredientesCrudos : [{}, {}, {}]).map(filaIngrediente));
  const listaPasos = el('ol', { class: 'lista-editable' },
    (receta?.pasos?.length ? receta.pasos : ['', '']).map(filaPaso));

  const error = el('p', { class: 'error', role: 'alert' });
  const botonGuardar = el('button', { type: 'submit' }, uuid ? 'Guardar cambios' : 'Guardar receta');

  const form = el('form', {
    class: 'formulario-receta',
    onsubmit: async (e) => {
      e.preventDefault();
      error.textContent = '';
      const d = new FormData(form);
      const ingredientes = [...listaIngredientes.children]
        .map((li) => li.leer())
        .filter((i) => i.nombre);
      const pasos = [...listaPasos.querySelectorAll('textarea')].map((t) => t.value.trim()).filter(Boolean);

      if (!ingredientes.length) { error.textContent = 'Agregá al menos un ingrediente.'; return; }
      if (!pasos.length) { error.textContent = 'Agregá al menos un paso.'; return; }

      botonGuardar.disabled = true;
      botonGuardar.textContent = 'Guardando…';
      try {
        let imagen = inputUrl.value.trim() || (archivoFoto ? '' : urlFoto);
        if (archivoFoto) imagen = await misRecetas.subirFoto(u.id, archivoFoto);

        const numero = (v) => (v ? Math.max(0, parseInt(v, 10)) || null : null);
        const datos = {
          nombre: d.get('nombre').trim(),
          descripcion: d.get('descripcion').trim(),
          categoria: d.get('categoria'),
          origen: d.get('origen').trim(),
          porciones: numero(d.get('porciones')),
          minutos: numero(d.get('minutos')),
          imagen_url: imagen || null,
          ingredientes,
          pasos,
          publica: d.get('publica') === 'on',
          autor_nombre: nombreVisible(u),
        };
        if (!uuid) datos.user_id = u.id;

        const guardada = await misRecetas.guardar(datos, uuid);
        aviso(uuid ? 'Cambios guardados' : '¡Receta guardada!');
        location.hash = `#/receta/${guardada.id}`;
      } catch (err) {
        console.error(err);
        error.textContent = `No se pudo guardar: ${err.message}`;
        botonGuardar.disabled = false;
        botonGuardar.textContent = uuid ? 'Guardar cambios' : 'Guardar receta';
      }
    },
  },
    el('label', { class: 'campo' }, el('span', {}, 'Nombre de la receta *'),
      el('input', { name: 'nombre', required: true, minlength: '2', maxlength: '120', value: receta?.nombre || '' })),
    el('label', { class: 'campo' }, el('span', {}, 'Descripción corta'),
      el('textarea', { name: 'descripcion', rows: '2', maxlength: '300' }, receta?.descripcion || '')),
    el('div', { class: 'campos-fila' },
      el('label', { class: 'campo' }, el('span', {}, 'Categoría'),
        el('select', { name: 'categoria' },
          Object.entries(CATEGORIAS).map(([valor, texto]) =>
            el('option', { value: valor, selected: (receta?.categoria || 'Miscellaneous') === valor }, texto)))),
      el('label', { class: 'campo' }, el('span', {}, 'Origen'),
        el('input', { name: 'origen', placeholder: 'ej: Argentina', maxlength: '40', value: receta?.origen || '', list: 'lista-paises' }),
        el('datalist', { id: 'lista-paises' }, NOMBRES_PAISES.map((p) => el('option', { value: p })))),
      el('label', { class: 'campo' }, el('span', {}, 'Porciones'),
        el('input', { name: 'porciones', type: 'number', min: '1', max: '100', value: receta?.porciones ?? '' })),
      el('label', { class: 'campo' }, el('span', {}, 'Minutos'),
        el('input', { name: 'minutos', type: 'number', min: '1', max: '2000', value: receta?.minutos ?? '' }))),

    el('fieldset', {},
      el('legend', {}, 'Foto'),
      el('div', { class: 'foto-editor' },
        vistaFoto,
        el('div', {},
          el('label', { class: 'campo' }, el('span', {}, 'Subir o sacar una foto'), inputArchivo),
          el('label', { class: 'campo' }, el('span', {}, 'Enlace'), inputUrl),
          el('p', { class: 'meta' }, 'Si no ponés foto, la receta se muestra con un collage de sus ingredientes.')))),

    el('fieldset', {},
      el('legend', {}, 'Ingredientes *'),
      listaIngredientes,
      el('button', { type: 'button', class: 'boton-secundario', onclick: () => {
        const fila = filaIngrediente();
        listaIngredientes.append(fila);
        fila.querySelector('input').focus();
      } }, '+ Ingrediente')),

    el('fieldset', {},
      el('legend', {}, 'Pasos *'),
      listaPasos,
      el('button', { type: 'button', class: 'boton-secundario', onclick: () => {
        const fila = filaPaso();
        listaPasos.append(fila);
        fila.querySelector('textarea').focus();
      } }, '+ Paso')),

    el('label', { class: 'campo-check' },
      el('input', { type: 'checkbox', name: 'publica', checked: receta ? receta.publica : true }),
      el('span', {}, 'Compartir con la comunidad (si no, sólo la ves vos)')),
    error,
    el('div', { class: 'acciones' },
      botonGuardar,
      el('a', { href: uuid ? `#/receta/u-${uuid}` : '#/mis-recetas' }, 'Cancelar')));

  mostrar(el('h1', {}, uuid ? 'Editar receta' : 'Nueva receta'), form);
}
