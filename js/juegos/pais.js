// Adiviná el país: aparece un plato y hay que elegir de qué país es entre 4.
// 10 rondas de 15 segundos; cuanto más rápido, más puntos.
import { el, mostrar, cargando, vigencia } from '../dom.js';
import { crearImagen, IMG_PLATO_GENERICO } from '../imagenes.js';
import { bandera, continenteDe } from '../paises.js';
import { cargarDatos, mezclar } from './datos.js';
import { finDePartida, marcador } from './partida.js';

const RONDAS = 10;
const SEGUNDOS = 15;

function armarRondas({ recetas, paisesConRecetas }) {
  const porPais = new Map();
  const elegidas = [];
  for (const r of mezclar(recetas.filter((x) => x.imagen && paisesConRecetas.includes(x.origen)))) {
    // Como mucho una receta por país, para que haya variedad.
    if (porPais.has(r.origen)) continue;
    porPais.set(r.origen, true);
    elegidas.push(r);
    if (elegidas.length === RONDAS) break;
  }
  return elegidas.map((r) => {
    // Dos opciones del mismo continente (más difícil) y una de cualquier lado.
    const otros = paisesConRecetas.filter((p) => p !== r.origen);
    const cerca = mezclar(otros.filter((p) => continenteDe(p) === continenteDe(r.origen))).slice(0, 2);
    const lejos = mezclar(otros.filter((p) => !cerca.includes(p))).slice(0, 3 - cerca.length);
    return { receta: r, opciones: mezclar([r.origen, ...cerca, ...lejos]) };
  });
}

export async function juegoPais() {
  const vigente = vigencia();
  cargando();
  const datos = await cargarDatos();
  if (!vigente()) return;
  document.title = 'Adiviná el país · Recetario';

  const zona = el('div', { class: 'juego-zona' });
  const tablero = marcador();
  mostrar(
    el('a', { class: 'volver', href: '#/juegos' }, '← Juegos'),
    el('section', { class: 'juego' },
      el('header', { class: 'juego-cabecera' },
        el('h1', {}, '🌎 Adiviná el país'),
        el('p', { class: 'meta' }, `¿De qué país es cada plato? ${RONDAS} rondas de ${SEGUNDOS} segundos: cuanto más rápido, más puntos.`)),
      tablero.nodo, zona));

  let reloj = null;
  const parar = () => { clearInterval(reloj); reloj = null; };

  function empezar() {
    const rondas = armarRondas(datos);
    let indice = 0;
    let puntos = 0;
    let aciertos = 0;
    const marcas = [];

    function ronda() {
      if (!zona.isConnected) return parar();
      if (indice >= rondas.length) return terminar();
      const { receta, opciones } = rondas[indice];
      tablero.pintar({ ronda: indice + 1, total: rondas.length, puntos });
      const inicio = Date.now();
      let respondida = false;

      const botones = opciones.map((pais) => el('button', {
        type: 'button', class: 'opcion', onclick: () => responder(pais),
      }, bandera(pais, 'opcion-bandera'), el('span', {}, pais)));

      function responder(pais) {
        if (respondida) return;
        respondida = true;
        parar();
        const restante = Math.max(0, SEGUNDOS - (Date.now() - inicio) / 1000);
        const bien = pais === receta.origen;
        if (bien) {
          aciertos++;
          puntos += 50 + Math.round((50 * restante) / SEGUNDOS);
        }
        marcas.push(bien ? '🟩' : '🟥');
        botones.forEach((b, i) => {
          b.disabled = true;
          if (opciones[i] === receta.origen) b.classList.add('correcta');
          else if (opciones[i] === pais) b.classList.add('incorrecta');
        });
        tablero.pintar({ ronda: indice + 1, total: rondas.length, puntos });
        aviso.textContent = pais == null ? `⏰ ¡Se acabó el tiempo! Era ${receta.origen}.` : bien ? '¡Correcto! 🎉' : `Era ${receta.origen}.`;
        aviso.className = `juego-aviso ${bien ? 'bien' : 'mal'}`;
        setTimeout(() => { indice++; ronda(); }, bien ? 1000 : 1800);
      }

      const aviso = el('p', { class: 'juego-aviso', role: 'status' });
      zona.replaceChildren(
        el('figure', { class: 'juego-foto' },
          crearImagen(receta.imagenGrande || receta.imagen, receta.nombre, IMG_PLATO_GENERICO),
          el('figcaption', {}, receta.nombre)),
        el('div', { class: 'opciones' }, botones),
        aviso);

      parar();
      tablero.tiempo(1);
      reloj = setInterval(() => {
        if (!zona.isConnected) return parar();
        const fraccion = 1 - (Date.now() - inicio) / (SEGUNDOS * 1000);
        tablero.tiempo(fraccion);
        if (fraccion <= 0) responder(null);
      }, 100);
    }

    function terminar() {
      tablero.tiempo(null);
      zona.replaceChildren(finDePartida({
        juego: 'pais',
        titulo: 'Adiviná el país',
        puntos,
        maximo: RONDAS * 100,
        detalle: `Acertaste ${aciertos} de ${rondas.length} países.`,
        alReintentar: empezar,
        textoCompartir: `🌎 Recetario · Adiviná el país\n${marcas.join('')}\n${puntos} puntos (${aciertos}/${rondas.length})`,
      }));
    }

    ronda();
  }

  empezar();
}
