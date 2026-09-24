import { el, mostrar, cargando, aviso, vigencia } from '../dom.js';
import * as repo from '../repositorio.js';
import * as misRecetas from '../misRecetas.js';
import { crearImagen, IMG_INGREDIENTE_GENERICO } from '../imagenes.js';
import { traducirCategoria, traducirOrigen } from '../traducciones.js';
import { usuario } from '../auth.js';
import {
  leerProgreso, guardarProgreso, pantallaSoportada, mantenerPantalla, pantallaActiva,
  recetaActual, fijarActual, soltarActual, alCambiarCocina,
} from '../cocina.js';
import { portada } from './componentes.js';
import { bandera, rutaPais } from '../paises.js';

export async function vistaReceta(id) {
  const vigente = vigencia();
  cargando();
  const r = await repo.obtenerReceta(id);
  if (!vigente()) return;
  if (!r) {
    mostrar(
      el('p', { class: 'estado' }, 'La receta no existe o es privada.'),
      el('p', { class: 'estado' }, el('a', { href: '#/' }, 'Volver al inicio')));
    return;
  }
  document.title = `${r.nombre} · Recetario`;

  let progreso = leerProgreso(r.id);
  const ORIGEN = 'ficha';
  const esMia = r.origenDatos === 'usuario' && usuario()?.id === r.userId;

  // ---------- seguimiento de cocina ----------
  const barra = el('div', { class: 'progreso-barra' }, el('span'));
  const textoProgreso = el('p', { class: 'progreso-texto' });
  const itemsIngredientes = [];
  const itemsPasos = [];

  function pintar() {
    const ing = progreso.ingredientes.size;
    const pas = progreso.pasos.size;
    const total = r.ingredientes.length + r.pasos.length;
    const hechos = ing + pas;
    barra.firstChild.style.width = total ? `${(hechos / total) * 100}%` : '0';
    textoProgreso.textContent = hechos === total && total > 0
      ? '¡Listo! Buen provecho 🎉'
      : `Ingredientes ${ing}/${r.ingredientes.length} · Pasos ${pas}/${r.pasos.length}`;

    itemsIngredientes.forEach((li, i) => li.classList.toggle('hecho', progreso.ingredientes.has(i)));
    const siguiente = r.pasos.findIndex((_, i) => !progreso.pasos.has(i));
    itemsPasos.forEach((li, i) => {
      li.classList.toggle('hecho', progreso.pasos.has(i));
      li.classList.toggle('actual', i === siguiente);
    });
    itemsIngredientes.forEach((li, i) => { li.querySelector('input').checked = progreso.ingredientes.has(i); });
    itemsPasos.forEach((li, i) => { li.querySelector('input').checked = progreso.pasos.has(i); });
  }

  // Cambio hecho acá: se guarda, y la receta pasa a ser la que se está cocinando.
  function refrescar() {
    pintar();
    guardarProgreso(r.id, progreso, ORIGEN);
    if (recetaActual()?.id !== r.id && (progreso.ingredientes.size || progreso.pasos.size)) fijarActual(r);
  }

  function casilla(conjunto, indice, texto) {
    return el('input', {
      type: 'checkbox',
      checked: (conjunto === 'ingredientes' ? progreso.ingredientes : progreso.pasos).has(indice),
      'aria-label': texto,
      onchange: (e) => {
        const actual = conjunto === 'ingredientes' ? progreso.ingredientes : progreso.pasos;
        if (e.target.checked) actual.add(indice); else actual.delete(indice);
        refrescar();
      },
    });
  }

  r.ingredientes.forEach((ing, i) => {
    itemsIngredientes.push(el('li', { class: 'ingrediente' },
      el('label', {},
        casilla('ingredientes', i, ing.nombre),
        crearImagen(ing.imagen, '', IMG_INGREDIENTE_GENERICO),
        el('span', { class: 'ingrediente-texto' },
          el('strong', {}, ing.nombre),
          ing.medida && el('span', { class: 'medida' }, ing.medida)))));
  });

  r.pasos.forEach((paso, i) => {
    itemsPasos.push(el('li', { class: 'paso' },
      el('label', {},
        casilla('pasos', i, `Paso ${i + 1}`),
        el('span', { class: 'paso-numero' }, i + 1),
        el('span', {}, paso))));
  });

  const botonPantalla = pantallaSoportada() && el('button', {
    type: 'button',
    class: `boton-secundario${pantallaActiva() ? ' activo' : ''}`,
    title: 'Evita que la pantalla se apague mientras cocinás',
    'aria-pressed': String(pantallaActiva()),
    onclick: async (e) => {
      const activa = await mantenerPantalla(!pantallaActiva());
      try { sessionStorage.setItem('recetario:pantalla', activa ? '1' : '0'); } catch { /* sin almacenamiento */ }
      e.currentTarget.classList.toggle('activo', activa);
      e.currentTarget.setAttribute('aria-pressed', String(activa));
    },
  }, '🔆 No apagar pantalla');

  const botonReiniciar = el('button', {
    type: 'button',
    class: 'boton-secundario',
    title: 'Destildar todo',
    onclick: () => {
      progreso.ingredientes.clear();
      progreso.pasos.clear();
      refrescar();
    },
  }, '↺ Reiniciar');

  // Seguir la receta en el panel lateral "Cocinando ahora".
  const botonSeguir = el('button', {
    type: 'button',
    class: 'boton-secundario',
    onclick: () => (recetaActual()?.id === r.id ? soltarActual() : fijarActual(r)),
  });
  function pintarSeguir() {
    const siguiendo = recetaActual()?.id === r.id;
    botonSeguir.textContent = siguiendo ? '📌 Siguiendo' : '📌 Seguir al costado';
    botonSeguir.title = siguiendo ? 'Dejar de mostrarla en el panel lateral' : 'Mostrarla en el panel lateral mientras navegás';
    botonSeguir.classList.toggle('activo', siguiendo);
    botonSeguir.setAttribute('aria-pressed', String(siguiendo));
  }
  pintarSeguir();

  // Barra fija abajo: siempre a mano mientras se cocina.
  const barraCocina = el('div', { class: 'barra-cocina', role: 'region', 'aria-label': 'Progreso de la receta' },
    el('div', { class: 'barra-cocina-progreso' }, textoProgreso, barra),
    el('div', { class: 'acciones' }, botonSeguir, botonPantalla, botonReiniciar));

  // Cambios hechos desde el panel lateral (u otra pestaña): se reflejan acá.
  const dejarDeEscuchar = alCambiarCocina(({ id, origen, actual }) => {
    if (!barraCocina.isConnected) { dejarDeEscuchar(); return; }
    if (actual) { pintarSeguir(); return; }
    if (id === r.id && origen !== ORIGEN) {
      progreso = leerProgreso(r.id);
      pintar();
    }
  });

  // ---------- acciones del dueño ----------
  const accionesDueno = esMia && el('p', { class: 'acciones' },
    el('a', { class: 'boton', href: `#/editar/${r.uuid}` }, '✏️ Editar'),
    el('button', {
      type: 'button',
      class: 'boton-peligro',
      onclick: async () => {
        if (!confirm(`¿Borrar “${r.nombre}”? No se puede deshacer.`)) return;
        try {
          await misRecetas.borrar(r.uuid);
          aviso('Receta borrada');
          location.hash = '#/mis-recetas';
        } catch (err) {
          aviso(`No se pudo borrar: ${err.message}`, 'error');
        }
      },
    }, 'Borrar'));

  const volver = r.categoria
    ? el('a', { class: 'volver', href: `#/categoria/${encodeURIComponent(r.categoria)}` }, `← ${traducirCategoria(r.categoria)}`)
    : el('a', { class: 'volver', href: '#/' }, '← Inicio');

  const datos = [
    ['🥕', r.ingredientes.length, 'ingredientes'],
    ['📝', r.pasos.length, 'pasos'],
    r.minutos && ['⏱', r.minutos, 'minutos'],
    r.porciones && ['🍽', r.porciones, 'porciones'],
  ].filter(Boolean);

  mostrar(
    volver,
    el('article', { class: 'receta' },
      el('header', { class: 'receta-titulo' },
        el('h1', {}, r.nombre),
        r.origen && el('a', { class: 'enlace-pais', href: rutaPais(traducirOrigen(r.origen)) },
          bandera(traducirOrigen(r.origen)), traducirOrigen(r.origen)),
        el('p', { class: 'meta' }, [
          r.categoria && traducirCategoria(r.categoria),
          r.autor && `Receta de ${r.autor}${r.publica === false ? ' · 🔒 privada' : ''}`,
          r.nombreOriginal && r.nombreOriginal !== r.nombre && `En su idioma: ${r.nombreOriginal}`,
        ].filter(Boolean).join(' · ')),
        r.descripcion && el('p', { class: 'descripcion' }, r.descripcion),
        el('ul', { class: 'datos-rapidos' },
          datos.map(([icono, valor, texto]) =>
            el('li', {}, el('span', { class: 'dato-icono', 'aria-hidden': 'true' }, icono),
              el('strong', {}, valor), el('span', {}, texto)))),
        (r.etiquetas?.length > 0 || r.video || r.enlace) && el('div', { class: 'receta-extras' },
          r.etiquetas?.length > 0 && el('ul', { class: 'etiquetas' }, r.etiquetas.map((t) => el('li', {}, t))),
          r.video && el('a', { class: 'boton-secundario boton-chico', href: r.video, target: '_blank', rel: 'noopener' }, '▶ Ver video'),
          r.enlace && el('a', { class: 'enlace-fuente', href: r.enlace, target: '_blank', rel: 'noopener' }, 'Fuente original')),
        accionesDueno),
      el('div', { class: 'receta-cuerpo' },
        el('div', { class: 'receta-foto-columna' }, portada(r, { clase: 'receta-foto' })),
        el('section', { class: 'receta-ingredientes' },
          el('h2', {}, 'Ingredientes'),
          el('p', { class: 'meta' }, 'Tildalos a medida que los vas usando.'),
          el('ul', { class: 'ingredientes' }, itemsIngredientes))),
      el('section', { class: 'receta-pasos' },
        el('h2', {}, 'Preparación'),
        r.pasos.length
          ? el('ol', { class: 'pasos' }, itemsPasos)
          : el('p', { class: 'meta' }, 'Esta receta no tiene pasos cargados.'),
        r.origenDatos === 'mealdb' && r.nombreOriginal && el('p', { class: 'nota-traduccion' }, r.pasosEnIngles
          ? 'Estamos terminando de traducir los pasos de esta receta: por ahora se muestran en inglés.'
          : 'Pasos traducidos automáticamente del inglés. Si algo no se entiende, revisá la fuente original.')),
      barraCocina)
  );
  pintar();
}
