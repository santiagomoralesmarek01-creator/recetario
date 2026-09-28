// ¿Qué le falta?: una receta con un ingrediente tapado; hay que elegir cuál
// es. 10 rondas. Prioriza recetas latinoamericanas y tiene tres dificultades.
import { el, mostrar, cargando, vigencia } from '../dom.js';
import { crearImagen, IMG_PLATO_GENERICO, IMG_INGREDIENTE_GENERICO } from '../imagenes.js';
import { portada } from '../vistas/componentes.js';
import { cargarDatos, mezclar, esTrivial, ingredientesFalsos, elegirRecetas, MODOS } from './datos.js';
import { finDePartida, marcador, elegirModo } from './partida.js';

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
    el('a', { class: 'volver', href: '#/juegos' }, '← Juegos'),
    el('section', { class: 'juego' },
      el('header', { class: 'juego-cabecera' },
        el('h1', {}, '🧩 ¿Qué le falta?'),
        el('p', { class: 'meta' }, 'A cada receta le tapamos un ingrediente. ¿Sabés cuál es?')),
      tablero.nodo, zona));

  function inicio() {
    tablero.nodo.hidden = true;
    zona.replaceChildren(elegirModo({ juego: 'falta', detalles: DETALLES, alEmpezar: empezar }));
  }

  function empezar(modo) {
    const reglas = REGLAS[modo];
    const rondas = armarRondas(datos, modo);
    let indice = 0;
    let aciertos = 0;
    const marcas = [];
    tablero.nodo.hidden = false;

    function ronda() {
      if (!zona.isConnected) return;
      if (indice >= rondas.length) return terminar();
      const { receta, oculto, opciones } = rondas[indice];
      tablero.pintar({ ronda: indice + 1, total: rondas.length, puntos: aciertos * reglas.puntos });
      let respondida = false;
      const hueco = el('li', { class: 'falta-hueco' }, el('span', { class: 'falta-signo' }, '?'), el('span', {}, '¿…?'));

      const botones = opciones.map((ing) => el('button', {
        type: 'button', class: 'opcion opcion-ingrediente', onclick: () => responder(ing),
      }, crearImagen(ing.imagen, '', IMG_INGREDIENTE_GENERICO), el('span', {}, ing.nombre)));

      function responder(ing) {
        if (respondida) return;
        respondida = true;
        const bien = ing === oculto;
        if (bien) aciertos++;
        marcas.push(bien ? '🟩' : '🟥');
        botones.forEach((b, i) => {
          b.disabled = true;
          if (opciones[i] === oculto) b.classList.add('correcta');
          else if (opciones[i] === ing) b.classList.add('incorrecta');
        });
        hueco.replaceChildren(crearImagen(oculto.imagen, '', IMG_INGREDIENTE_GENERICO), el('strong', {}, oculto.nombre));
        hueco.classList.add(bien ? 'bien' : 'mal');
        tablero.pintar({ ronda: indice + 1, total: rondas.length, puntos: aciertos * reglas.puntos });
        aviso.textContent = bien ? '¡Exacto! 🎉' : `Le faltaba: ${oculto.nombre}.`;
        aviso.className = `juego-aviso ${bien ? 'bien' : 'mal'}`;
        siguiente.hidden = false;
        siguiente.focus();
      }

      const aviso = el('p', { class: 'juego-aviso', role: 'status' });
      const siguiente = el('button', {
        type: 'button', class: 'boton', hidden: true, onclick: () => { indice++; ronda(); },
      }, indice + 1 < rondas.length ? 'Siguiente →' : 'Ver resultado');

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
        puntos: aciertos * reglas.puntos,
        maximo: RONDAS * reglas.puntos,
        detalle: `Adivinaste ${aciertos} de ${rondas.length} ingredientes.`,
        alReintentar: () => empezar(modo),
        alCambiarModo: inicio,
        textoCompartir: `🧩 A Mano · ¿Qué le falta? (${MODOS[modo].nombre})\n${marcas.join('')}\n${aciertos}/${rondas.length} ingredientes`,
      }));
    }

    ronda();
  }

  inicio();
}
