// Adiviná el país: aparece un plato y hay que elegir de qué país es entre 4.
// 10 rondas contra reloj; cuanto más rápido, más puntos. Prioriza platos
// latinoamericanos y tiene tres dificultades.
import { el, mostrar, cargando, vigencia } from '../dom.js';
import { crearImagen, IMG_PLATO_GENERICO } from '../imagenes.js';
import { bandera, continenteDe, LATINOAMERICA } from '../paises.js';
import { normalizar } from '../ingredientes.js';
import { portada } from '../vistas/componentes.js';
import { cargarDatos, mezclar, elegirRecetas, MODOS } from './datos.js';
import { finDePartida, marcador, elegirModo, errorDePartida } from './partida.js';
import { juegaEnServidor, nuevaPartida } from '../torneo.js';
import { icono } from '../iconos.js';
import { t } from '../textos.js';

const RONDAS = 10;

// segundos por ronda, cuántas opciones falsas son del mismo continente y puntos máximos por ronda.
const REGLAS = {
  facil: { segundos: 20, cercanas: 2, puntos: 50 },
  normal: { segundos: 15, cercanas: 2, puntos: 80 },
  dificil: { segundos: 10, cercanas: 3, puntos: 100 },
};
const DETALLES = {
  facil: 'Platos de Latinoamérica, 20 segundos y opciones de la región y del resto del mundo.',
  normal: 'Más platos del mundo, 15 segundos y opciones parecidas.',
  dificil: 'Cocina de todo el mundo, 10 segundos y todas las opciones del mismo continente.',
};

// Si el nombre ya dice el país ("Ceviche peruano"), la pregunta no tiene gracia.
const nombreDelata = (r) => {
  const raiz = normalizar(r.origen).slice(0, 4);
  return normalizar(r.nombre).split(/[^a-z]+/).some((p) => p.length > 3 && p.startsWith(raiz));
};

function armarRondas({ recetas, paisesConRecetas }, modo) {
  const reglas = REGLAS[modo];
  const posibles = recetas.filter((x) => paisesConRecetas.includes(x.origen) && !nombreDelata(x)
    // En latinoamericanas se aceptan sin foto (muchas son de la casa); en el resto, sólo con foto.
    && (x.imagen || x.latina));
  // Como mucho una receta por país, para que haya variedad.
  const unaPorPais = [];
  const vistos = new Set();
  for (const r of mezclar(posibles)) {
    if (vistos.has(r.origen)) continue;
    vistos.add(r.origen);
    unaPorPais.push(r);
  }
  return elegirRecetas(unaPorPais, RONDAS, MODOS[modo].latinas).map((r) => {
    const otros = paisesConRecetas.filter((p) => p !== r.origen);
    // Para un plato latinoamericano, "cerca" es otro país de Latinoamérica
    // (no Estados Unidos o Canadá, que también son de América).
    const mismo = r.latina ? (p) => LATINOAMERICA.has(p) : (p) => continenteDe(p) === continenteDe(r.origen);
    const cerca = mezclar(otros.filter(mismo)).slice(0, reglas.cercanas);
    const lejos = mezclar(otros.filter((p) => !cerca.includes(p))).slice(0, 3 - cerca.length);
    return { receta: r, opciones: mezclar([r.origen, ...cerca, ...lejos]) };
  });
}

export async function juegoPais() {
  const vigente = vigencia();
  cargando();
  const datos = await cargarDatos();
  if (!vigente()) return;
  document.title = 'Adiviná el país · A Mano';

  const zona = el('div', { class: 'juego-zona' });
  const tablero = marcador();
  tablero.nodo.hidden = true;
  mostrar(
    el('a', { class: 'volver', href: '/juegos' }, '← Juegos'),
    el('section', { class: 'juego' },
      el('header', { class: 'juego-cabecera' },
        el('h1', {}, icono('pais', { clase: 'icono-titulo' }), 'Adiviná el país'),
        el('p', { class: 'meta' }, `¿De qué país es cada plato? ${RONDAS} rondas contra reloj: cuanto más rápido, más puntos.`)),
      tablero.nodo, zona));

  let reloj = null;
  const parar = () => { clearInterval(reloj); reloj = null; };

  function inicio() {
    parar();
    tablero.nodo.hidden = true;
    zona.replaceChildren(elegirModo({ juego: 'pais', detalles: DETALLES, alEmpezar: empezar }));
  }

  async function empezar(modo) {
    const reglas = REGLAS[modo];
    // Con sesión, la partida la arma y la corrige el servidor (cuenta para el torneo).
    let partida = null;
    if (juegaEnServidor()) {
      zona.replaceChildren(el('p', { class: 'estado' }, 'Armando la partida…'));
      try {
        partida = await nuevaPartida('pais', modo);
      } catch (err) {
        zona.replaceChildren(errorDePartida(err, () => empezar(modo), inicio));
        return;
      }
    }
    const rondas = partida ? null : armarRondas(datos, modo);
    const total = partida ? partida.total : rondas.length;
    let indice = 0;
    let puntos = 0;
    let aciertos = 0;
    const marcas = [];
    tablero.nodo.hidden = false;

    async function ronda() {
      if (!zona.isConnected) return parar();
      if (indice >= total) return terminar();
      let actual;
      if (partida) {
        try {
          const d = await partida.ronda();
          indice = d.indice;
          actual = { receta: { nombre: d.receta.nombre, imagen: d.receta.imagen, imagenGrande: d.receta.imagen, codigoCategoria: d.receta.categoria }, opciones: d.opciones };
        } catch (err) {
          zona.replaceChildren(errorDePartida(err, ronda, inicio));
          return;
        }
      } else {
        actual = rondas[indice];
      }
      const { receta, opciones } = actual;
      tablero.pintar({ ronda: indice + 1, total, puntos });
      const inicioRonda = Date.now();
      let respondida = false;

      const botones = opciones.map((pais) => el('button', {
        type: 'button', class: 'opcion', onclick: () => responder(pais),
      }, bandera(pais, 'opcion-bandera'), el('span', {}, pais)));

      async function responder(pais) {
        if (respondida) return;
        respondida = true;
        parar();
        botones.forEach((b) => { b.disabled = true; });
        let bien;
        let correcta;
        if (partida) {
          try {
            const res = await partida.responder(indice, pais);
            bien = res.bien;
            correcta = res.respuesta;
            puntos = res.puntos;
          } catch (err) {
            zona.replaceChildren(errorDePartida(err, () => { indice++; ronda(); }, inicio));
            return;
          }
        } else {
          const restante = Math.max(0, reglas.segundos - (Date.now() - inicioRonda) / 1000);
          bien = pais === receta.origen;
          correcta = receta.origen;
          if (bien) puntos += Math.round(reglas.puntos / 2 + (reglas.puntos / 2) * (restante / reglas.segundos));
        }
        if (bien) aciertos++;
        marcas.push(bien ? '🟩' : '🟥');
        botones.forEach((b, i) => {
          if (opciones[i] === correcta) b.classList.add('correcta');
          else if (opciones[i] === pais) b.classList.add('incorrecta');
        });
        tablero.pintar({ ronda: indice + 1, total, puntos });
        aviso.textContent = pais == null ? `Se acabó el tiempo. Era ${correcta}.` : bien ? t('juego.correcto') : `Era ${correcta}.`;
        aviso.className = `juego-aviso ${bien ? 'bien' : 'mal'}`;
        setTimeout(() => { indice++; ronda(); }, bien ? 1000 : 1800);
      }

      const aviso = el('p', { class: 'juego-aviso', role: 'status' });
      zona.replaceChildren(
        el('figure', { class: 'juego-foto' },
          receta.imagen
            ? crearImagen(receta.imagenGrande || receta.imagen, receta.nombre, IMG_PLATO_GENERICO)
            : portada({ nombre: receta.nombre, categoria: receta.codigoCategoria }, { clase: 'juego-foto-sin' }),
          el('figcaption', {}, receta.nombre)),
        el('div', { class: 'opciones' }, botones),
        aviso);

      parar();
      tablero.tiempo(1);
      reloj = setInterval(() => {
        if (!zona.isConnected) return parar();
        const fraccion = 1 - (Date.now() - inicioRonda) / (reglas.segundos * 1000);
        tablero.tiempo(fraccion);
        if (fraccion <= 0) responder(null);
      }, 100);
    }

    function terminar() {
      tablero.tiempo(null);
      zona.replaceChildren(finDePartida({
        juego: 'pais',
        modo,
        titulo: 'Adiviná el país',
        puntos,
        maximo: RONDAS * reglas.puntos,
        detalle: `Acertaste ${aciertos} de ${total} países.`,
        partida,
        alReintentar: () => empezar(modo),
        alCambiarModo: inicio,
        textoCompartir: `🌎 A Mano · Adiviná el país (${MODOS[modo].nombre})\n${marcas.join('')}\n${puntos} puntos (${aciertos}/${total})`,
      }));
    }

    ronda();
  }

  inicio();
}
