// Panel "Cocinando ahora": la receta que estás siguiendo, siempre a mano.
// En pantallas anchas es una columna fija a la derecha; en las angostas, un
// botón flotante que abre el panel como cajón lateral.
import { el } from './dom.js';
import { crearImagen, urlPlato, IMG_PLATO_GENERICO, IMG_INGREDIENTE_GENERICO } from './imagenes.js';
import {
  recetaActual, soltarActual, leerProgreso, guardarProgreso, alCambiarCocina,
} from './cocina.js';

const ORIGEN = 'panel';
let panel;
let botonFlotante;
let abierto = false; // sólo cuenta en pantallas angostas

export function iniciarPanel() {
  panel = el('aside', { class: 'panel-actual', 'aria-label': 'Receta que estás cocinando', hidden: true });
  botonFlotante = el('button', {
    type: 'button', class: 'panel-flotante', hidden: true,
    onclick: () => alternar(true),
  });
  const fondo = el('div', { class: 'panel-fondo', onclick: () => alternar(false) });
  document.body.append(fondo, panel, botonFlotante);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && abierto) alternar(false); });

  // El panel arranca justo debajo de la cabecera, que cambia de alto según el ancho.
  const cabecera = document.querySelector('.cabecera');
  const medir = () => document.documentElement.style.setProperty('--alto-cabecera', `${cabecera.offsetHeight}px`);
  new ResizeObserver(medir).observe(cabecera);
  medir();

  alCambiarCocina(({ origen }) => { if (origen !== ORIGEN) dibujar(); });
  window.addEventListener('hashchange', () => { alternar(false); actualizarFlotante(); });
  dibujar();
}

function alternar(abrir) {
  abierto = abrir;
  document.body.classList.toggle('panel-abierto', abrir);
}

// En la ficha de la misma receta ya está la barra de progreso: el botón flotante sobra.
function actualizarFlotante() {
  const actual = recetaActual();
  const enSuFicha = actual && location.hash === `#/receta/${actual.id}`;
  botonFlotante.hidden = !actual || enSuFicha;
}

function dibujar() {
  const r = recetaActual();
  document.body.classList.toggle('con-panel', Boolean(r));
  panel.hidden = !r;
  if (!r) {
    botonFlotante.hidden = true;
    alternar(false);
    return;
  }

  const progreso = leerProgreso(r.id);
  const total = r.ingredientes.length + r.pasos.length;
  const hechos = progreso.ingredientes.size + progreso.pasos.size;
  const siguiente = r.pasos.findIndex((_, i) => !progreso.pasos.has(i));

  function casilla(conjunto, indice, texto) {
    return el('input', {
      type: 'checkbox',
      checked: conjunto.has(indice),
      'aria-label': texto,
      onchange: (e) => {
        if (e.target.checked) conjunto.add(indice); else conjunto.delete(indice);
        guardarProgreso(r.id, progreso, ORIGEN);
        dibujar();
      },
    });
  }

  const textoProgreso = hechos === total && total > 0
    ? '¡Listo! Buen provecho 🎉'
    : `${progreso.ingredientes.size}/${r.ingredientes.length} ingredientes · ${progreso.pasos.size}/${r.pasos.length} pasos`;

  // Conserva el scroll del panel al redibujar.
  const scroll = panel.querySelector('.panel-actual-cuerpo')?.scrollTop || 0;

  panel.replaceChildren(
    el('div', { class: 'panel-actual-cabecera' },
      el('span', { class: 'panel-actual-titulo' }, 'Cocinando ahora'),
      el('div', { class: 'panel-actual-acciones' },
        el('button', {
          type: 'button', class: 'boton-icono panel-cerrar-cajon', 'aria-label': 'Ocultar panel',
          onclick: () => alternar(false),
        }, '→'),
        el('button', {
          type: 'button', class: 'boton-icono', title: 'Dejar de seguir esta receta', 'aria-label': 'Dejar de seguir esta receta',
          onclick: () => soltarActual(),
        }, '✕'))),
    el('a', { class: 'panel-actual-receta', href: `#/receta/${r.id}` },
      crearImagen(r.imagen ? urlPlato(r.imagen, { miniatura: /^\d+$/.test(r.id) }) : IMG_PLATO_GENERICO, '', IMG_PLATO_GENERICO),
      el('strong', {}, r.nombre)),
    el('div', { class: 'progreso-barra' }, el('span', { style: `width:${total ? (hechos / total) * 100 : 0}%` })),
    el('p', { class: 'panel-actual-progreso' }, textoProgreso),
    el('div', { class: 'panel-actual-cuerpo' },
      el('h3', {}, 'Ingredientes'),
      el('ul', { class: 'panel-lista' }, r.ingredientes.map((ing, i) =>
        el('li', { class: progreso.ingredientes.has(i) ? 'hecho' : '' },
          el('label', {},
            casilla(progreso.ingredientes, i, ing.nombre),
            crearImagen(ing.imagen || IMG_INGREDIENTE_GENERICO, '', IMG_INGREDIENTE_GENERICO, 'panel-ing-img'),
            el('span', {}, el('span', { class: 'panel-ing-nombre' }, ing.nombre), ing.medida && el('small', {}, ing.medida)))))),
      el('h3', {}, 'Pasos'),
      el('ol', { class: 'panel-lista panel-pasos' }, r.pasos.map((paso, i) =>
        el('li', { class: [progreso.pasos.has(i) && 'hecho', i === siguiente && 'actual'].filter(Boolean).join(' ') },
          el('label', {},
            casilla(progreso.pasos, i, `Paso ${i + 1}`),
            el('span', { class: 'paso-numero' }, i + 1),
            el('span', {}, paso)))))),
  );
  panel.querySelector('.panel-actual-cuerpo').scrollTop = scroll;

  botonFlotante.replaceChildren(
    el('span', { 'aria-hidden': 'true' }, '🍳'),
    el('span', { class: 'panel-flotante-texto' }, r.nombre),
    el('span', { class: 'panel-flotante-cuenta' }, `${hechos}/${total}`));
  botonFlotante.setAttribute('aria-label', `Abrir la receta que estás cocinando: ${r.nombre}`);
  actualizarFlotante();
}
