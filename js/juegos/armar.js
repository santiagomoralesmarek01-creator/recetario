// Armá el plato: de una alacena con ingredientes mezclados, hay que elegir
// los que lleva el plato y "servir". 5 rondas de hasta 200 puntos.
import { el, mostrar, cargando, vigencia } from '../dom.js';
import { crearImagen, IMG_PLATO_GENERICO, IMG_INGREDIENTE_GENERICO } from '../imagenes.js';
import { cargarDatos, mezclar, esTrivial, ingredientesFalsos, raiz } from './datos.js';
import { finDePartida, marcador } from './partida.js';

const RONDAS = 5;
const CORRECTOS = 5;
const FALSOS = 5;
const PUNTOS_ACIERTO = 40;
const PUNTOS_ERROR = 20;

function armarRondas({ recetas, comunes }) {
  const conFoto = (i) => i.imagen !== IMG_INGREDIENTE_GENERICO;
  const posibles = recetas.filter((r) => {
    if (!r.imagen) return false;
    const utiles = r.ingredientes.filter((i) => !esTrivial(i.nombre) && conFoto(i));
    return new Set(utiles.map((i) => raiz(i.nombre))).size >= CORRECTOS;
  });
  return mezclar(posibles).slice(0, RONDAS).map((receta) => {
    // Los más característicos del plato, sin repetidos ("huevo" y "huevos").
    const vistas = new Set();
    const correctos = receta.ingredientes
      .filter((i) => !esTrivial(i.nombre) && conFoto(i))
      .sort((a, b) => a.usos - b.usos)
      .filter((i) => { const r = raiz(i.nombre); if (vistas.has(r)) return false; vistas.add(r); return true; })
      .slice(0, CORRECTOS);
    const falsos = ingredientesFalsos(comunes, receta, FALSOS);
    return { receta, correctos, alacena: mezclar([...correctos, ...falsos]) };
  });
}

export async function juegoArmar() {
  const vigente = vigencia();
  cargando();
  const datos = await cargarDatos();
  if (!vigente()) return;
  document.title = 'Armá el plato · Recetario';

  const zona = el('div', { class: 'juego-zona' });
  const tablero = marcador();
  tablero.tiempo(null);
  mostrar(
    el('a', { class: 'volver', href: '#/juegos' }, '← Juegos'),
    el('section', { class: 'juego' },
      el('header', { class: 'juego-cabecera' },
        el('h1', {}, '🥘 Armá el plato'),
        el('p', { class: 'meta' }, `Elegí de la alacena los ${CORRECTOS} ingredientes de cada plato y serví. Cada acierto suma ${PUNTOS_ACIERTO} puntos y cada error resta ${PUNTOS_ERROR}.`)),
      tablero.nodo, zona));

  function empezar() {
    const rondas = armarRondas(datos);
    let indice = 0;
    let puntos = 0;
    let perfectos = 0;
    const marcas = [];

    function ronda() {
      if (!zona.isConnected) return;
      if (indice >= rondas.length) return terminar();
      const { receta, correctos, alacena } = rondas[indice];
      tablero.pintar({ ronda: indice + 1, total: rondas.length, puntos });
      const elegidos = new Set();
      let servido = false;

      const contador = el('span', { class: 'armar-contador' });
      const olla = el('div', { class: 'armar-olla-contenido' });
      const servir = el('button', { type: 'button', class: 'boton', onclick: () => servirPlato() }, '🍽️ Servir');
      const aviso = el('p', { class: 'juego-aviso', role: 'status' });
      const siguiente = el('button', {
        type: 'button', class: 'boton', hidden: true, onclick: () => { indice++; ronda(); },
      }, indice + 1 < rondas.length ? 'Siguiente plato →' : 'Ver resultado');

      const fichas = alacena.map((ing) => el('button', {
        type: 'button', class: 'armar-ficha', 'aria-pressed': 'false', onclick: () => alternar(ing),
      }, crearImagen(ing.imagen, '', IMG_INGREDIENTE_GENERICO), el('span', {}, ing.nombre)));

      function pintar() {
        fichas.forEach((f, i) => {
          const esta = elegidos.has(alacena[i]);
          f.classList.toggle('elegida', esta);
          f.setAttribute('aria-pressed', String(esta));
        });
        olla.replaceChildren(...(elegidos.size
          ? [...elegidos].map((ing) => el('span', { class: 'armar-en-olla', title: ing.nombre },
            crearImagen(ing.imagen, ing.nombre, IMG_INGREDIENTE_GENERICO)))
          : [el('span', { class: 'armar-olla-vacia' }, 'Tocá los ingredientes para meterlos en la olla')]));
        contador.textContent = `${elegidos.size}/${CORRECTOS}`;
        servir.disabled = !elegidos.size;
      }

      function alternar(ing) {
        if (servido) return;
        if (elegidos.has(ing)) elegidos.delete(ing);
        else if (elegidos.size < CORRECTOS) elegidos.add(ing);
        else { aviso.textContent = `Ya elegiste ${CORRECTOS}: sacá uno para cambiarlo.`; aviso.className = 'juego-aviso'; return; }
        aviso.textContent = '';
        pintar();
      }

      function servirPlato() {
        if (servido) return;
        servido = true;
        const bien = [...elegidos].filter((i) => correctos.includes(i)).length;
        const mal = elegidos.size - bien;
        const ganados = Math.max(0, bien * PUNTOS_ACIERTO - mal * PUNTOS_ERROR);
        puntos += ganados;
        if (bien === CORRECTOS) perfectos++;
        marcas.push(bien === CORRECTOS ? '🟩' : bien >= 3 ? '🟨' : '🟥');
        fichas.forEach((f, i) => {
          f.disabled = true;
          const ing = alacena[i];
          if (correctos.includes(ing)) f.classList.add(elegidos.has(ing) ? 'correcta' : 'faltó');
          else if (elegidos.has(ing)) f.classList.add('incorrecta');
        });
        tablero.pintar({ ronda: indice + 1, total: rondas.length, puntos });
        aviso.textContent = bien === CORRECTOS
          ? `¡Plato perfecto! +${ganados} 🎉`
          : `Acertaste ${bien} de ${CORRECTOS}${mal ? ` y pusiste ${mal} que no iba${mal > 1 ? 'n' : ''}` : ''}: +${ganados}. Los que faltaron están marcados.`;
        aviso.className = `juego-aviso ${bien === CORRECTOS ? 'bien' : bien >= 3 ? '' : 'mal'}`;
        servir.hidden = true;
        siguiente.hidden = false;
        siguiente.focus();
      }

      zona.replaceChildren(
        el('div', { class: 'armar-mesa' },
          el('div', { class: 'armar-pedido' },
            crearImagen(receta.imagenGrande || receta.imagen, receta.nombre, IMG_PLATO_GENERICO),
            el('div', {},
              el('small', {}, 'Pedido de la mesa'),
              el('strong', {}, receta.nombre),
              el('span', { class: 'meta' }, [receta.categoria, receta.origen].filter(Boolean).join(' · ')))),
          el('div', { class: 'armar-olla' },
            el('div', { class: 'armar-olla-cabecera' }, el('span', {}, '🍲 La olla'), contador),
            olla)),
        el('p', { class: 'falta-pregunta' }, 'La alacena'),
        el('div', { class: 'armar-alacena' }, fichas),
        aviso,
        el('div', { class: 'juego-siguiente' }, servir, siguiente));
      pintar();
    }

    function terminar() {
      zona.replaceChildren(finDePartida({
        juego: 'armar',
        titulo: 'Armá el plato',
        puntos,
        maximo: RONDAS * CORRECTOS * PUNTOS_ACIERTO,
        detalle: `Platos perfectos: ${perfectos} de ${rondas.length}.`,
        alReintentar: empezar,
        textoCompartir: `🥘 Recetario · Armá el plato\n${marcas.join('')}\n${puntos} puntos`,
      }));
    }

    ronda();
  }

  empezar();
}
