// ¿Qué le falta?: una receta con un ingrediente tapado; hay que elegir cuál
// es entre 4 opciones. 10 rondas, 100 puntos cada acierto.
import { el, mostrar, cargando, vigencia } from '../dom.js';
import { crearImagen, IMG_PLATO_GENERICO, IMG_INGREDIENTE_GENERICO } from '../imagenes.js';
import { cargarDatos, mezclar, esTrivial, ingredientesFalsos } from './datos.js';
import { finDePartida, marcador } from './partida.js';

const RONDAS = 10;

function armarRondas({ recetas, comunes }) {
  const posibles = recetas.filter((r) => r.imagen && r.ingredientes.length >= 5 && r.ingredientes.length <= 14);
  return mezclar(posibles).slice(0, RONDAS).map((receta) => {
    // Se tapa uno de los ingredientes que "definen" el plato: poco comunes pero conocidos.
    const candidatos = receta.ingredientes
      .filter((i) => !esTrivial(i.nombre) && i.usos >= 3 && i.imagen !== IMG_INGREDIENTE_GENERICO)
      .sort((a, b) => a.usos - b.usos)
      .slice(0, 3);
    const oculto = mezclar(candidatos.length ? candidatos : receta.ingredientes.filter((i) => !esTrivial(i.nombre)))[0]
      || receta.ingredientes[0];
    const falsos = ingredientesFalsos(comunes, receta, 3);
    return { receta, oculto, opciones: mezclar([oculto, ...falsos]) };
  });
}

export async function juegoFalta() {
  const vigente = vigencia();
  cargando();
  const datos = await cargarDatos();
  if (!vigente()) return;
  document.title = '¿Qué le falta? · Recetario';

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

  function empezar() {
    const rondas = armarRondas(datos);
    let indice = 0;
    let aciertos = 0;
    const marcas = [];

    function ronda() {
      if (!zona.isConnected) return;
      if (indice >= rondas.length) return terminar();
      const { receta, oculto, opciones } = rondas[indice];
      tablero.pintar({ ronda: indice + 1, total: rondas.length, puntos: aciertos * 100 });
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
        tablero.pintar({ ronda: indice + 1, total: rondas.length, puntos: aciertos * 100 });
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
            crearImagen(receta.imagen, '', IMG_PLATO_GENERICO),
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
        titulo: '¿Qué le falta?',
        puntos: aciertos * 100,
        maximo: RONDAS * 100,
        detalle: `Adivinaste ${aciertos} de ${rondas.length} ingredientes.`,
        alReintentar: empezar,
        textoCompartir: `🧩 Recetario · ¿Qué le falta?\n${marcas.join('')}\n${aciertos}/${rondas.length} ingredientes`,
      }));
    }

    ronda();
  }

  empezar();
}
