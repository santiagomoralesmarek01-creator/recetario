import { el, mostrar, cargando, aviso, vigencia } from '../dom.js';
import * as repo from '../repositorio.js';
import * as misRecetas from '../misRecetas.js';
import { crearImagen, IMG_INGREDIENTE_GENERICO } from '../imagenes.js';
import { traducirCategoria } from '../traducciones.js';
import { usuario } from '../auth.js';
import {
  leerProgreso, guardarProgreso, pantallaSoportada, mantenerPantalla, pantallaActiva,
} from '../cocina.js';
import { portada, metaReceta } from './componentes.js';

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

  const progreso = leerProgreso(r.id);
  const esMia = r.origenDatos === 'usuario' && usuario()?.id === r.userId;

  // ---------- seguimiento de cocina ----------
  const barra = el('div', { class: 'progreso-barra' }, el('span'));
  const textoProgreso = el('p', { class: 'progreso-texto' });
  const itemsIngredientes = [];
  const itemsPasos = [];

  function refrescar() {
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
    guardarProgreso(r.id, progreso);
  }

  function casilla(conjunto, indice, texto) {
    return el('input', {
      type: 'checkbox',
      checked: conjunto.has(indice),
      'aria-label': texto,
      onchange: (e) => {
        if (e.target.checked) conjunto.add(indice); else conjunto.delete(indice);
        refrescar();
      },
    });
  }

  r.ingredientes.forEach((ing, i) => {
    itemsIngredientes.push(el('li', { class: 'ingrediente' },
      el('label', {},
        casilla(progreso.ingredientes, i, ing.nombre),
        crearImagen(ing.imagen, '', IMG_INGREDIENTE_GENERICO),
        el('span', { class: 'ingrediente-texto' },
          el('strong', {}, ing.nombre),
          ing.medida && el('span', { class: 'medida' }, ing.medida)))));
  });

  r.pasos.forEach((paso, i) => {
    itemsPasos.push(el('li', { class: 'paso' },
      el('label', {},
        casilla(progreso.pasos, i, `Paso ${i + 1}`),
        el('span', { class: 'paso-numero' }, i + 1),
        el('span', {}, paso))));
  });

  const botonPantalla = pantallaSoportada() && el('button', {
    type: 'button',
    class: 'boton-secundario',
    onclick: async (e) => {
      const activa = await mantenerPantalla(!pantallaActiva());
      try { sessionStorage.setItem('recetario:pantalla', activa ? '1' : '0'); } catch { /* sin almacenamiento */ }
      e.target.textContent = activa ? '🔆 Pantalla encendida' : '🔅 Mantener pantalla encendida';
      e.target.classList.toggle('activo', activa);
    },
  }, pantallaActiva() ? '🔆 Pantalla encendida' : '🔅 Mantener pantalla encendida');

  const panelCocina = el('section', { class: 'panel-cocina' },
    el('div', { class: 'panel-cocina-cabecera' },
      el('h2', {}, '👩‍🍳 Modo cocina'),
      el('div', { class: 'acciones' },
        botonPantalla,
        el('button', {
          type: 'button',
          class: 'boton-secundario',
          onclick: () => {
            progreso.ingredientes.clear();
            progreso.pasos.clear();
            itemsIngredientes.concat(itemsPasos).forEach((li) => { li.querySelector('input').checked = false; });
            refrescar();
          },
        }, '↺ Reiniciar'))),
    el('p', { class: 'meta' }, 'Tildá los ingredientes a medida que los usás y los pasos que vas terminando. Tu avance queda guardado en este dispositivo.'),
    barra,
    textoProgreso);

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

  mostrar(
    volver,
    el('article', { class: 'receta' },
      el('header', { class: 'receta-cabecera' },
        portada(r, { clase: 'receta-foto' }),
        el('div', {},
          el('h1', {}, r.nombre),
          el('p', { class: 'meta' }, metaReceta(r)),
          r.autor && el('p', { class: 'meta' }, `Receta de ${r.autor}${r.publica === false ? ' · 🔒 privada' : ''}`),
          r.descripcion && el('p', { class: 'descripcion' }, r.descripcion),
          r.etiquetas?.length > 0 && el('ul', { class: 'etiquetas' }, r.etiquetas.map((t) => el('li', {}, t))),
          el('p', { class: 'enlaces' },
            r.video && el('a', { href: r.video, target: '_blank', rel: 'noopener' }, '▶ Ver video'),
            r.enlace && el('a', { href: r.enlace, target: '_blank', rel: 'noopener' }, 'Fuente original')),
          accionesDueno)),
      panelCocina,
      el('section', {},
        el('h2', {}, `Ingredientes (${r.ingredientes.length})`),
        el('ul', { class: 'ingredientes' }, itemsIngredientes)),
      el('section', {},
        el('h2', {}, 'Preparación'),
        r.pasos.length
          ? el('ol', { class: 'pasos' }, itemsPasos)
          : el('p', { class: 'meta' }, 'Esta receta no tiene pasos cargados.')))
  );
  refrescar();
}
