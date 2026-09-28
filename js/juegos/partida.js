// Pantalla de fin de partida, común a los juegos: puntos, récord, guardado
// para el ranking y las medallas, y botones para compartir o volver a jugar.
import { el } from '../dom.js';
import { usuario, pedirLogin } from '../auth.js';
import { hayBackend } from '../supabase.js';
import { registrarActividad } from '../actividad.js';
import { guardarRecord, leerRecords, compartir, MODOS, modoGuardado, guardarModo } from './datos.js';
import { icono } from '../iconos.js';
import { t } from '../textos.js';
import { evento } from '../analitica.js';
import { ruta } from '../rutas.js';

// Pantalla para elegir la dificultad antes de jugar. detalles: { facil, normal, dificil } → texto.
export function elegirModo({ juego, detalles, alEmpezar }) {
  let modo = modoGuardado(juego);
  const records = leerRecords();
  const botones = Object.entries(MODOS).map(([clave, m]) => el('button', {
    type: 'button', class: 'modo-opcion', 'aria-pressed': 'false',
    onclick: () => { modo = clave; pintar(); },
  },
  el('span', { class: `modo-titulo nivel-${m.nivel}` }, el('span', { class: 'punto-nivel', 'aria-hidden': 'true' }), m.nombre),
  el('span', { class: 'modo-detalle' }, detalles[clave]),
  records[`${juego}:${clave}`]?.mejor != null && el('small', {}, t('juegos.record', { n: records[`${juego}:${clave}`].mejor }))));
  function pintar() {
    botones.forEach((b, i) => {
      const activo = Object.keys(MODOS)[i] === modo;
      b.classList.toggle('activo', activo);
      b.setAttribute('aria-pressed', String(activo));
    });
  }
  pintar();
  return el('div', { class: 'modo-elegir' },
    el('p', { class: 'falta-pregunta' }, 'Elegí la dificultad'),
    el('div', { class: 'modo-opciones' }, botones),
    el('p', { class: 'meta modo-nota' }, icono('pais'), ' Priorizamos platos latinoamericanos: en Fácil son todos de la región y en Difícil se suma más cocina del mundo.'),
    el('div', { class: 'juego-siguiente' },
      el('button', { type: 'button', class: 'boton', onclick: () => { guardarModo(juego, modo); alEmpezar(modo); } }, t('juego.empezar'))));
}

export function finDePartida({ juego, modo, titulo, puntos, maximo, detalle, alReintentar, alCambiarModo, textoCompartir }) {
  const clave = modo ? `${juego}:${modo}` : juego;
  const recordAnterior = leerRecords()[clave]?.mejor || 0;
  const esRecord = guardarRecord(juego, puntos, modo) && recordAnterior > 0;
  registrarActividad(`juego-${juego}`, { puntos, detalle: modo }).catch((err) => console.warn(err));
  evento('Juego', { juego, modo: modo || '' });
  const invitado = hayBackend && !usuario();
  const porcentaje = puntos / maximo;

  return el('div', { class: 'juego-fin' },
    el('div', { class: 'juego-fin-emoji', 'aria-hidden': 'true' }, icono(porcentaje >= 0.6 ? 'trofeo' : 'plato')),
    el('p', { class: `portada-antetitulo${modo ? ` nivel-${MODOS[modo].nivel}` : ''}` }, titulo, modo && [' · ', el('span', { class: 'punto-nivel', 'aria-hidden': 'true' }), MODOS[modo].nombre]),
    el('p', { class: 'juego-fin-puntos' }, el('strong', {}, puntos), ` / ${maximo} puntos`),
    detalle && el('p', { class: 'meta' }, detalle),
    esRecord
      ? el('p', { class: 'juego-record' }, icono('trofeo'), ` ${t('juego.nuevo-record')}`)
      : recordAnterior > 0 && el('p', { class: 'meta' }, `Tu récord${modo ? ` en ${MODOS[modo].nombre.toLowerCase()}` : ''}: ${Math.max(recordAnterior, puntos)} puntos`),
    invitado && el('p', { class: 'juego-invitacion' },
      el('button', { type: 'button', class: 'boton-texto', onclick: () => pedirLogin(ruta()) }, t('juego.entrar')),
      t('juego.entrar-texto')),
    el('div', { class: 'acciones' },
      el('button', { type: 'button', class: 'boton', onclick: alReintentar }, t('juego.otra-vez')),
      alCambiarModo && el('button', { type: 'button', class: 'boton-secundario', onclick: alCambiarModo }, t('juego.cambiar-dificultad')),
      el('button', { type: 'button', class: 'boton-secundario', onclick: () => compartir(textoCompartir) }, t('juego.compartir')),
      el('a', { class: 'boton-secundario boton', href: '/juegos' }, t('juego.otros'))));
}

// Marcador de la parte de arriba: ronda, puntos y (opcional) tiempo.
export function marcador() {
  const ronda = el('span', {});
  const puntos = el('span', {});
  const barra = el('span', { class: 'juego-tiempo-barra' }, el('span'));
  const nodo = el('div', { class: 'juego-marcador' }, ronda, puntos, barra);
  return {
    nodo,
    pintar({ ronda: r, total, puntos: p }) {
      ronda.textContent = `Ronda ${r} de ${total}`;
      puntos.textContent = `${p} pts`;
    },
    tiempo(fraccion) {
      barra.hidden = fraccion == null;
      if (fraccion != null) {
        barra.firstChild.style.width = `${Math.max(0, fraccion) * 100}%`;
        barra.classList.toggle('poco', fraccion < 0.3);
      }
    },
  };
}
