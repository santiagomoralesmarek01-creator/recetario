// Sección Juegos: portada con los 4 juegos, el ranking semanal y el acceso a
// las medallas. Cada juego vive en js/juegos/.
import { el, mostrar } from '../dom.js';
import { hayBackend } from '../supabase.js';
import { usuario } from '../auth.js';
import { rankingSemanal, PUNTOS_POR_DIA } from '../actividad.js';
import { leerRecords } from '../juegos/datos.js';
import { estadoDeHoy, numeroDelDia } from '../juegos/platoDelDia.js';
import { juegoPlatoDelDia } from '../juegos/platoDelDia.js';
import { juegoPais } from '../juegos/pais.js';
import { juegoFalta } from '../juegos/falta.js';
import { juegoArmar } from '../juegos/armar.js';
import { icono } from '../iconos.js';
import { t } from '../textos.js';
import { conPalabraDestacada } from './listados.js';
import { paisDelUsuario } from '../paises.js';

const JUEGOS = {
  'plato-del-dia': juegoPlatoDelDia,
  pais: juegoPais,
  falta: juegoFalta,
  armar: juegoArmar,
};

export function vistaJuego(nombre) {
  return (JUEGOS[nombre] || vistaJuegos)();
}

// "Elegís la dificultad: ● Fácil · ● Normal · ● Difícil", con el punto de color de cada nivel.
const ELEGIS = () => [t('juegos.elegir-dificultad'), ...[[1, 'Fácil'], [2, 'Normal'], [3, 'Difícil']].flatMap(([n, nombre], i) => [
  i ? ' · ' : '', el('span', { class: `nivel-${n}` }, el('span', { class: 'punto-nivel', 'aria-hidden': 'true' }), nombre)])];

function tarjetaJuego({ ruta, icono: simbolo, titulo, texto, dificultad, extra, clase = '' }) {
  return el('a', { class: `tarjeta-juego ${clase}`, href: `/juegos/${ruta}` },
    el('span', { class: 'tarjeta-juego-icono', 'aria-hidden': 'true' }, simbolo),
    el('span', { class: 'tarjeta-juego-texto' },
      el('strong', {}, titulo),
      el('span', {}, texto),
      dificultad && el('span', { class: 'tarjeta-juego-dificultad' }, typeof dificultad === 'function' ? dificultad() : dificultad),
      extra && el('small', {}, extra)),
    el('span', { class: 'tarjeta-juego-ir', 'aria-hidden': 'true' }, icono('flecha')));
}

// Ranking semanal con pestañas "General" y el país de la persona.
// Se reinicia cada lunes. Muestra los 5 primeros y el puesto propio con
// dos arriba y dos abajo (con "…" en el salto).
function seccionRanking() {
  const pais = paisDelUsuario();
  const lista = el('ol', { class: 'ranking' });
  let pestana = 'general';
  const botones = pais ? el('div', { class: 'ranking-pestanas', role: 'tablist' },
    [['general', 'General'], ['pais', pais]].map(([clave, texto]) => el('button', {
      type: 'button', role: 'tab', class: 'filtro-chip', 'data-clave': clave,
      onclick: () => { pestana = clave; cargar(); },
    }, texto))) : null;

  function fila(f) {
    return el('li', { class: f.soyYo ? 'soy-yo' : '' },
      el('span', { class: 'ranking-puesto' }, `${f.puesto}.`),
      el('span', { class: 'ranking-nombre' }, f.soyYo ? `${f.nombre} (${t('ranking.yo')})` : f.nombre),
      el('span', { class: 'ranking-puntos' }, `${f.puntos.toLocaleString('es-AR')} pts`));
  }

  function cargar() {
    botones?.querySelectorAll('button').forEach((b) => {
      const activo = b.dataset.clave === pestana;
      b.classList.toggle('activo', activo);
      b.setAttribute('aria-selected', String(activo));
    });
    lista.replaceChildren(el('li', { class: 'meta' }, 'Cargando…'));
    rankingSemanal(pestana === 'pais' ? pais : null)
      .then((filas) => {
        const items = [];
        filas.forEach((f, i) => {
          if (i > 0 && f.puesto > filas[i - 1].puesto + 1) items.push(el('li', { class: 'ranking-salto', 'aria-hidden': 'true' }, '…'));
          items.push(fila(f));
        });
        lista.replaceChildren(...(items.length ? items : [el('li', { class: 'meta' }, t('ranking.vacio'))]));
      })
      .catch(() => lista.replaceChildren(el('li', { class: 'meta' }, 'El ranking no está disponible por ahora.')));
  }
  cargar();

  return el('section', { class: 'seccion juegos-ranking' },
    el('h2', {}, 'Ranking de la semana'),
    el('p', { class: 'seccion-bajada' }, `Suma los puntos de todos los juegos desde el lunes, con un máximo de ${PUNTOS_POR_DIA.toLocaleString('es-AR')} por día. Cada semana arranca de cero.`),
    botones,
    lista,
    !pais && el('p', { class: 'meta' }, el('a', { href: '/preferencias' }, 'Elegir un país'), ' para ver también el ranking de ese país.'),
    !usuario() && el('p', { class: 'meta' }, el('a', { href: '/entrar' }, t('juego.entrar')), ' para aparecer en el ranking y ganar medallas.'));
}

export function vistaJuegos() {
  document.title = 'Juegos · A Mano';
  const records = leerRecords();
  const { hoy, racha } = estadoDeHoy();
  const record = (juego) => (records[juego]?.partidas ? t('juegos.record', { n: records[juego].mejor }) : t('juegos.sin-partidas'));

  mostrar(
    el('section', { class: 'juegos-portada' },
      el('p', { class: 'portada-antetitulo' }, 'Juegos de cocina'),
      el('h1', {}, ...conPalabraDestacada(t('juegos.titulo'), 'comida')),
      el('p', { class: 'meta' }, t('juegos.bajada'))),
    el('div', { class: 'juegos-lista' },
      tarjetaJuego({
        ruta: 'plato-del-dia', icono: icono('plato'), titulo: `Plato del día #${numeroDelDia()}`, clase: 'destacado',
        texto: 'El desafío diario: adiviná el plato con pistas. Es el mismo para todos y casi siempre es latinoamericano.',
        dificultad: el('span', { class: 'nivel-2' }, el('span', { class: 'punto-nivel', 'aria-hidden': 'true' }), 'Dificultad media · 6 intentos con pistas'),
        extra: hoy?.terminado
          ? `${hoy.gano ? `Lo adivinaste en ${hoy.intentos.length}` : 'Hoy no salió'} · racha de ${racha} · volvé mañana`
          : racha ? t('juegos.racha', { n: racha, dias: racha === 1 ? 'día' : 'días' }) : t('juegos.jugar-hoy'),
      }),
      tarjetaJuego({ ruta: 'pais', icono: icono('pais'), titulo: 'Adiviná el país', texto: 'Mirá el plato y elegí de qué país es. Contra reloj.', dificultad: ELEGIS, extra: record('pais') }),
      tarjetaJuego({ ruta: 'falta', icono: icono('rompecabezas'), titulo: '¿Qué le falta?', texto: 'Descubrí el ingrediente que le tapamos a cada receta.', dificultad: ELEGIS, extra: record('falta') }),
      tarjetaJuego({ ruta: 'armar', icono: icono('olla'), titulo: 'Armá el plato', texto: 'Elegí de la alacena los ingredientes justos y serví.', dificultad: ELEGIS, extra: record('armar') })),
    hayBackend && seccionRanking(),
    hayBackend && el('a', { class: 'juegos-medallas', href: '/medallas' },
      el('span', { 'aria-hidden': 'true' }, icono('medalla')),
      el('span', {}, el('strong', {}, 'Medallas'), el('span', {}, 'Jugando, cocinando y compartiendo recetas ganás medallas. Mirá cuáles te faltan.')),
      el('span', { 'aria-hidden': 'true' }, icono('flecha'))));
}
