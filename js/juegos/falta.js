// ¿Qué le falta?: una receta con un ingrediente tapado; hay que elegir cuál
// es. 10 rondas. Prioriza recetas latinoamericanas y tiene tres dificultades.
import { el, mostrar, cargando, vigencia } from '../dom.js';
import { crearImagen, IMG_PLATO_GENERICO, IMG_INGREDIENTE_GENERICO } from '../imagenes.js';
import { portada } from '../vistas/componentes.js';
import { cargarDatos, mezclar, esTrivial, ingredientesFalsos, elegirRecetas, MODOS } from './datos.js';
import { finDePartida, marcador, elegirModo, errorDePartida } from './partida.js';
import { juegaEnServidor, nuevaPartida } from '../torneo.js';
import { icono } from '../iconos.js';
import { t } from '../textos.js';

const RONDAS = 10;

// opciones: cuántas se muestran; oculto: qué tan conocido es el ingrediente tapado; puntos por acierto.
const REGLAS = {
  facil: { opciones: 3, oculto: 'comun', puntos: 50 },
  normal: { opciones: 4, oculto: 'medio', puntos: 80 },
  dificil: { opciones: 5, oculto: 'raro', puntos: 100 },
};
const DETALLES = {
  facil: 'Recetas latinoamericanas, 3 opciones y el ingrediente tapado es de los más conocidos.',
  normal: 'Más recetas del mundo y 4 opciones.',
  dificil: 'Cocina de todo el mundo, 5 opciones y el ingrediente tapado es el más particular del plato.',
};

function armarRondas({ recetas, comunes }, modo) {
  const reglas = REGLAS[modo];
  const posibles = recetas.filter((r) => r.ingredientes.length >= 5 && r.ingredientes.length <= 14);
  return elegirRecetas(posibles, RONDAS, MODOS[modo].latinas).map((receta) => {
    const candidatos = receta.ingredientes
      .filter((i) => !esTrivial(i.nombre) && i.usos >= 3 && i.imagen !== IMG_INGREDIENTE_GENERICO)
      .sort((a, b) => a.usos - b.usos);
    // Fácil: de los más usados en todas las recetas; difícil: el más particular del plato.
    const grupo = !candidatos.length ? receta.ingredientes.filter((i) => !esTrivial(i.nombre))
      : reglas.oculto === 'raro' ? candidatos.slice(0, 2)
        : reglas.oculto === 'comun' ? candidatos.slice(-3)
          : candidatos.slice(0, 4);
    const oculto = mezclar(grupo)[0] || receta.ingredientes[0];
    const falsos = ingredientesFalsos(comunes, receta, reglas.opciones - 1);
    return { receta, oculto, opciones: mezclar([oculto, ...falsos]) };
  });
}

export async function juegoFalta() {
  const vigente = vigencia();
  cargando();
  const datos = await cargarDatos();
  if (!vigente()) return;
  document.title = '¿Qué le falta? · A Mano';

  const zona = el('div', { class: 'juego-zona' });
  const tablero = marcador();
  tablero.tiempo(null);
  mostrar(
    el('a', { class: 'volver', href: '/juegos' }, '← Juegos'),
    el('section', { class: 'juego' },
      el('header', { class: 'juego-cabecera' },
        el('h1', {}, icono('rompecabezas', { clase: 'icono-titulo' }), '¿Qué le falta?'),
        el('p', { class: 'meta' }, 'A cada receta le tapamos un ingrediente. ¿Sabés cuál es?')),
      tablero.nodo, zona));

  function inicio() {
    tablero.nodo.hidden = true;
    zona.replaceChildren(elegirModo({ juego: 'falta', detalles: DETALLES, alEmpezar: empezar }));
  }

  async function empezar(modo) {
    const reglas = REGLAS[modo];
    // Con sesión, la partida la arma y la corrige el servidor (cuenta para el torneo).
    let partida = null;
    if (juegaEnServidor()) {
      zona.replaceChildren(el('p', { class: 'estado' }, 'Armando la partida…'));
      try {
        partida = await nuevaPartida('falta', modo);
      } catch (err) {
        zona.replaceChildren(errorDePartida(err, () => empezar(modo), inicio));
        return;
      }
    }
    const rondas = partida ? null : armarRondas(datos, modo);
    const total = partida ? partida.total : rondas.length;
    let indice = 0;
    let aciertos = 0;
    let puntos = 0;
    const marcas = [];
    tablero.nodo.hidden = false;

    async function ronda() {
      if (!zona.isConnected) return;
      if (indice >= total) return terminar();
      let actual;
      if (partida) {
        try {
          const d = await partida.ronda();
          indice = d.indice;
          const ing = (x) => ({ nombre: x.n, imagen: x.i });
          const oculto = { nombre: '', imagen: IMG_INGREDIENTE_GENERICO };
          actual = {
            receta: { nombre: d.receta.nombre, imagen: d.receta.imagen, categoria: d.receta.categoriaEs, codigoCategoria: d.receta.categoria, origen: d.receta.origen,
              ingredientes: d.ingredientes.map((x) => (x ? ing(x) : oculto)) },
            oculto,
            opciones: d.opciones.map(ing),
          };
        } catch (err) {
          zona.replaceChildren(errorDePartida(err, ronda, inicio));
          return;
        }
      } else {
        actual = rondas[indice];
      }
      const { receta, oculto, opciones } = actual;
      tablero.pintar({ ronda: indice + 1, total, puntos });
      let respondida = false;
      const hueco = el('li', { class: 'falta-hueco' }, el('span', { class: 'falta-signo' }, '?'), el('span', {}, '¿…?'));

      const botones = opciones.map((ing) => el('button', {
        type: 'button', class: 'opcion opcion-ingrediente', onclick: () => responder(ing),
      }, crearImagen(ing.imagen, '', IMG_INGREDIENTE_GENERICO), el('span', {}, ing.nombre)));

      async function responder(ing) {
        if (respondida) return;
        respondida = true;
        botones.forEach((b) => { b.disabled = true; });
        let bien;
        let correcta = oculto;
        if (partida) {
          try {
            const res = await partida.responder(indice, ing.nombre);
            bien = res.bien;
            puntos = res.puntos;
            correcta = opciones.find((o) => o.nombre === res.respuesta) || { nombre: res.respuesta, imagen: res.respuestaImagen };
          } catch (err) {
            zona.replaceChildren(errorDePartida(err, () => { indice++; ronda(); }, inicio));
            return;
          }
        } else {
          bien = ing === oculto;
          if (bien) puntos += reglas.puntos;
        }
        if (bien) aciertos++;
        marcas.push(bien ? '🟩' : '🟥');
        botones.forEach((b, i) => {
          if (opciones[i] === correcta) b.classList.add('correcta');
          else if (opciones[i] === ing) b.classList.add('incorrecta');
        });
        hueco.replaceChildren(crearImagen(correcta.imagen, '', IMG_INGREDIENTE_GENERICO), el('strong', {}, correcta.nombre));
        hueco.classList.add(bien ? 'bien' : 'mal');
        tablero.pintar({ ronda: indice + 1, total, puntos });
        aviso.textContent = bien ? t('juego.exacto') : `Le faltaba: ${correcta.nombre}.`;
        aviso.className = `juego-aviso ${bien ? 'bien' : 'mal'}`;
        siguiente.hidden = false;
        siguiente.focus();
      }

      const aviso = el('p', { class: 'juego-aviso', role: 'status' });
      const siguiente = el('button', {
        type: 'button', class: 'boton', hidden: true, onclick: () => { indice++; ronda(); },
      }, indice + 1 < total ? 'Siguiente →' : 'Ver resultado');

      zona.replaceChildren(
        el('div', { class: 'falta-receta' },
          el('div', { class: 'falta-titulo' },
            receta.imagen ? crearImagen(receta.imagen, '', IMG_PLATO_GENERICO)
              : portada({ nombre: receta.nombre, categoria: receta.codigoCategoria }, { clase: 'falta-foto-sin' }),
            el('div', {}, el('small', {}, [receta.categoria, receta.origen].filter(Boolean).join(' · ')), el('strong', {}, receta.nombre))),
          el('ul', { class: 'falta-ingredientes' },
            receta.ingredientes.map((i) => (i === oculto ? hueco : el('li', {},
              crearImagen(i.imagen, '', IMG_INGREDIENTE_GENERICO), el('span', {}, i.nombre)))))),
        el('p', { class: 'falta-pregunta' }, '¿Cuál es el ingrediente que falta?'),
        el('div', { class: 'opciones' }, botones),
        aviso,
        el('div', { class: 'juego-siguiente' }, siguiente));
    }

    function terminar() {
      zona.replaceChildren(finDePartida({
        juego: 'falta',
        modo,
        titulo: '¿Qué le falta?',
        puntos,
        maximo: RONDAS * reglas.puntos,
        detalle: `Adivinaste ${aciertos} de ${total} ingredientes.`,
        partida,
        alReintentar: () => empezar(modo),
        alCambiarModo: inicio,
        textoCompartir: `🧩 A Mano · ¿Qué le falta? (${MODOS[modo].nombre})\n${marcas.join('')}\n${aciertos}/${total} ingredientes`,
      }));
    }

    ronda();
  }

  inicio();
}
