// Sección Juegos: portada con los 4 juegos, el ranking semanal y el acceso a
// las medallas. Cada juego vive en js/juegos/.
import { el, mostrar } from '../dom.js';
import { hayBackend } from '../supabase.js';
import { usuario } from '../auth.js';
import { rankingSemanal } from '../actividad.js';
import { leerRecords } from '../juegos/datos.js';
import { estadoDeHoy, numeroDelDia } from '../juegos/platoDelDia.js';
import { juegoPlatoDelDia } from '../juegos/platoDelDia.js';
import { juegoPais } from '../juegos/pais.js';
import { juegoFalta } from '../juegos/falta.js';
import { juegoArmar } from '../juegos/armar.js';

const JUEGOS = {
  'plato-del-dia': juegoPlatoDelDia,
  pais: juegoPais,
  falta: juegoFalta,
  armar: juegoArmar,
};

export function vistaJuego(nombre) {
  return (JUEGOS[nombre] || vistaJuegos)();
}

const ELEGIS = 'Elegís la dificultad: 🟢 Fácil · 🟡 Normal · 🔴 Difícil';

function tarjetaJuego({ ruta, icono, titulo, texto, dificultad, extra, clase = '' }) {
  return el('a', { class: `tarjeta-juego ${clase}`, href: `#/juegos/${ruta}` },
    el('span', { class: 'tarjeta-juego-icono', 'aria-hidden': 'true' }, icono),
    el('span', { class: 'tarjeta-juego-texto' },
      el('strong', {}, titulo),
      el('span', {}, texto),
      dificultad && el('span', { class: 'tarjeta-juego-dificultad' }, dificultad),
      extra && el('small', {}, extra)),
    el('span', { class: 'tarjeta-juego-ir', 'aria-hidden': 'true' }, '→'));
}

function seccionRanking() {
  const lista = el('ol', { class: 'ranking' }, el('li', { class: 'meta' }, 'Cargando…'));
  rankingSemanal()
    .then((filas) => {
      lista.replaceChildren(...(filas.length
        ? filas.map((f, i) => el('li', { class: f.soyYo ? 'soy-yo' : '' },
          el('span', { class: 'ranking-puesto' }, ['🥇', '🥈', '🥉'][i] || `${i + 1}.`),
          el('span', { class: 'ranking-nombre' }, f.soyYo ? `${f.nombre} (vos)` : f.nombre),
          el('span', { class: 'ranking-puntos' }, `${f.puntos.toLocaleString('es-AR')} pts`)))
        : [el('li', { class: 'meta' }, 'Todavía nadie sumó puntos esta semana. ¡Podés ser el primero!')]));
    })
    .catch(() => lista.replaceChildren(el('li', { class: 'meta' }, 'El ranking no está disponible por ahora.')));
  return el('section', { class: 'seccion juegos-ranking' },
    el('h2', {}, '🏆 Ranking de la semana'),
    el('p', { class: 'seccion-bajada' }, 'Suma los puntos de todos los juegos de los últimos 7 días.'),
    lista,
    !usuario() && el('p', { class: 'meta' }, el('a', { href: '#/entrar' }, 'Entrá'), ' para aparecer en el ranking y ganar medallas.'));
}

export function vistaJuegos() {
  document.title = 'Juegos · Recetario';
  const records = leerRecords();
  const { hoy, racha } = estadoDeHoy();
  const record = (juego) => (records[juego]?.partidas ? `Tu récord: ${records[juego].mejor} puntos` : 'Todavía no jugaste');

  mostrar(
    el('section', { class: 'juegos-portada' },
      el('p', { class: 'portada-antetitulo' }, 'Juegos de cocina'),
      el('h1', {}, '¿Cuánto sabés de ', el('em', {}, 'comida'), '?'),
      el('p', { class: 'meta' }, 'Adiviná platos, países e ingredientes con las recetas de la página, con prioridad para la cocina latinoamericana. Sumá puntos, subí en el ranking y ganá medallas: en difícil, cada acierto vale más.')),
    el('div', { class: 'juegos-lista' },
      tarjetaJuego({
        ruta: 'plato-del-dia', icono: '🍳', titulo: `Plato del día #${numeroDelDia()}`, clase: 'destacado',
        texto: 'El desafío diario: adiviná el plato con pistas. Es el mismo para todos y casi siempre es latinoamericano.',
        dificultad: '🟡 Dificultad media · 6 intentos con pistas',
        extra: hoy?.terminado
          ? `${hoy.gano ? `✓ Lo adivinaste en ${hoy.intentos.length}` : '✗ Hoy no salió'} · 🔥 racha de ${racha} · volvé mañana`
          : racha ? `🔥 Racha de ${racha} día${racha === 1 ? '' : 's'}: ¡no la cortes!` : '¡Jugá el de hoy!',
      }),
      tarjetaJuego({ ruta: 'pais', icono: '🌎', titulo: 'Adiviná el país', texto: 'Mirá el plato y elegí de qué país es. Contra reloj.', dificultad: ELEGIS, extra: record('pais') }),
      tarjetaJuego({ ruta: 'falta', icono: '🧩', titulo: '¿Qué le falta?', texto: 'Descubrí el ingrediente que le tapamos a cada receta.', dificultad: ELEGIS, extra: record('falta') }),
      tarjetaJuego({ ruta: 'armar', icono: '🥘', titulo: 'Armá el plato', texto: 'Elegí de la alacena los ingredientes justos y serví.', dificultad: ELEGIS, extra: record('armar') })),
    hayBackend && seccionRanking(),
    hayBackend && el('a', { class: 'juegos-medallas', href: '#/medallas' },
      el('span', { 'aria-hidden': 'true' }, '🏅'),
      el('span', {}, el('strong', {}, 'Medallas'), el('span', {}, 'Jugando, cocinando y compartiendo recetas ganás medallas. Mirá cuáles te faltan.')),
      el('span', { 'aria-hidden': 'true' }, '→')));
}
