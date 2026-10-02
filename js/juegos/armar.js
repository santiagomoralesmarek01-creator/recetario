// Armá el plato: de una alacena con ingredientes mezclados, hay que elegir
// los que lleva el plato y "servir". 5 rondas. Prioriza recetas
// latinoamericanas y tiene tres dificultades.
import { el, mostrar, cargando, vigencia } from '../dom.js';
import { crearImagen, IMG_PLATO_GENERICO, IMG_INGREDIENTE_GENERICO } from '../imagenes.js';
import { portada } from '../vistas/componentes.js';
import { cargarDatos, mezclar, esTrivial, ingredientesFalsos, raiz, elegirRecetas, MODOS } from './datos.js';
import { finDePartida, marcador, elegirModo, errorDePartida } from './partida.js';
import { juegaEnServidor, nuevaPartida } from '../torneo.js';
import { icono } from '../iconos.js';
import { t } from '../textos.js';

const RONDAS = 5;

// correctos: ingredientes a encontrar; falsos: de relleno en la alacena; puntos por acierto y por error.
const REGLAS = {
  facil: { correctos: 4, falsos: 4, acierto: 25, error: 10 },
  normal: { correctos: 5, falsos: 5, acierto: 32, error: 16 },
  dificil: { correctos: 6, falsos: 8, acierto: 33, error: 20 },
};
const DETALLES = {
  facil: 'Platos latinoamericanos: encontrá 4 ingredientes entre 8.',
  normal: 'Más platos del mundo: encontrá 5 ingredientes entre 10.',
  dificil: 'Cocina de todo el mundo: encontrá 6 ingredientes entre 14 y los errores restan más.',
};

function armarRondas({ recetas, comunes }, modo) {
  const reglas = REGLAS[modo];
  const conFoto = (i) => i.imagen !== IMG_INGREDIENTE_GENERICO;
  const posibles = recetas.filter((r) => {
    const utiles = r.ingredientes.filter((i) => !esTrivial(i.nombre) && conFoto(i));
    return new Set(utiles.map((i) => raiz(i.nombre))).size >= reglas.correctos;
  });
  return elegirRecetas(posibles, RONDAS, MODOS[modo].latinas).map((receta) => {
    // Los más característicos del plato, sin repetidos ("huevo" y "huevos").
    const vistas = new Set();
    const correctos = receta.ingredientes
      .filter((i) => !esTrivial(i.nombre) && conFoto(i))
      .sort((a, b) => a.usos - b.usos)
      .filter((i) => { const r = raiz(i.nombre); if (vistas.has(r)) return false; vistas.add(r); return true; })
      .slice(0, reglas.correctos);
    const falsos = ingredientesFalsos(comunes, receta, reglas.falsos);
    return { receta, correctos, alacena: mezclar([...correctos, ...falsos]) };
  });
}

export async function juegoArmar() {
  const vigente = vigencia();
  cargando();
  const datos = await cargarDatos();
  if (!vigente()) return;
  document.title = 'Armá el plato · A Mano';

  const zona = el('div', { class: 'juego-zona' });
  const tablero = marcador();
  tablero.tiempo(null);
  mostrar(
    el('a', { class: 'volver', href: '/juegos' }, '← Juegos'),
    el('section', { class: 'juego' },
      el('header', { class: 'juego-cabecera' },
        el('h1', {}, icono('olla', { clase: 'icono-titulo' }), 'Armá el plato'),
        el('p', { class: 'meta' }, 'Elegí de la alacena los ingredientes de cada plato y serví. Los aciertos suman y los errores restan.')),
      tablero.nodo, zona));

  function inicio() {
    tablero.nodo.hidden = true;
    zona.replaceChildren(elegirModo({ juego: 'armar', detalles: DETALLES, alEmpezar: empezar }));
  }

  async function empezar(modo) {
    const reglas = REGLAS[modo];
    // Con sesión, la partida la arma y la corrige el servidor (cuenta para el torneo).
    let partida = null;
    if (juegaEnServidor()) {
      zona.replaceChildren(el('p', { class: 'estado' }, 'Armando la partida…'));
      try {
        partida = await nuevaPartida('armar', modo);
      } catch (err) {
        zona.replaceChildren(errorDePartida(err, () => empezar(modo), inicio));
        return;
      }
    }
    const rondas = partida ? null : armarRondas(datos, modo);
    const total = partida ? partida.total : rondas.length;
    let indice = 0;
    let puntos = 0;
    let perfectos = 0;
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
          actual = {
            receta: { nombre: d.receta.nombre, imagen: d.receta.imagen, imagenGrande: d.receta.imagen, categoria: d.receta.categoriaEs, codigoCategoria: d.receta.categoria, origen: d.receta.origen },
            correctos: null,
            alacena: d.alacena.map((x) => ({ nombre: x.n, imagen: x.i })),
          };
        } catch (err) {
          zona.replaceChildren(errorDePartida(err, ronda, inicio));
          return;
        }
      } else {
        actual = rondas[indice];
      }
      const { receta, alacena } = actual;
      let { correctos } = actual;
      const necesarios = correctos ? correctos.length : reglas.correctos;
      tablero.pintar({ ronda: indice + 1, total, puntos });
      const elegidos = new Set();
      let servido = false;

      const contador = el('span', { class: 'armar-contador' });
      const olla = el('div', { class: 'armar-olla-contenido' });
      const servir = el('button', { type: 'button', class: 'boton', onclick: () => servirPlato() }, icono('plato'), 'Servir');
      const aviso = el('p', { class: 'juego-aviso', role: 'status' });
      const siguiente = el('button', {
        type: 'button', class: 'boton', hidden: true, onclick: () => { indice++; ronda(); },
      }, indice + 1 < total ? 'Siguiente plato →' : 'Ver resultado');

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
        contador.textContent = `${elegidos.size}/${necesarios}`;
        servir.disabled = !elegidos.size;
      }

      function alternar(ing) {
        if (servido) return;
        if (elegidos.has(ing)) elegidos.delete(ing);
        else if (elegidos.size < necesarios) elegidos.add(ing);
        else { aviso.textContent = `Ya elegiste ${necesarios}: sacá uno para cambiarlo.`; aviso.className = 'juego-aviso'; return; }
        aviso.textContent = '';
        pintar();
      }

      async function servirPlato() {
        if (servido) return;
        servido = true;
        servir.disabled = true;
        fichas.forEach((f) => { f.disabled = true; });
        let bien;
        let mal;
        let ganados;
        if (partida) {
          try {
            const res = await partida.responder(indice, [...elegidos].map((i) => i.nombre));
            correctos = alacena.filter((i) => res.respuesta.includes(i.nombre));
            bien = res.aciertosRonda;
            mal = res.erroresRonda;
            ganados = res.ganados;
            puntos = res.puntos;
          } catch (err) {
            zona.replaceChildren(errorDePartida(err, () => { indice++; ronda(); }, inicio));
            return;
          }
        } else {
          bien = [...elegidos].filter((i) => correctos.includes(i)).length;
          mal = elegidos.size - bien;
          ganados = Math.max(0, bien * reglas.acierto - mal * reglas.error);
          puntos += ganados;
        }
        if (bien === necesarios) perfectos++;
        marcas.push(bien === necesarios ? '🟩' : bien >= necesarios - 2 ? '🟨' : '🟥');
        fichas.forEach((f, i) => {
          f.disabled = true;
          const ing = alacena[i];
          if (correctos.includes(ing)) f.classList.add(elegidos.has(ing) ? 'correcta' : 'faltó');
          else if (elegidos.has(ing)) f.classList.add('incorrecta');
        });
        tablero.pintar({ ronda: indice + 1, total, puntos });
        aviso.textContent = bien === necesarios
          ? t('juego.perfecto', { n: ganados })
          : `Acertaste ${bien} de ${necesarios}${mal ? ` y pusiste ${mal} que no iba${mal > 1 ? 'n' : ''}` : ''}: +${ganados}. Los que faltaron están marcados.`;
        aviso.className = `juego-aviso ${bien === necesarios ? 'bien' : bien >= necesarios - 2 ? '' : 'mal'}`;
        servir.hidden = true;
        siguiente.hidden = false;
        siguiente.focus();
      }

      zona.replaceChildren(
        el('div', { class: 'armar-mesa' },
          el('div', { class: 'armar-pedido' },
            receta.imagen ? crearImagen(receta.imagenGrande || receta.imagen, receta.nombre, IMG_PLATO_GENERICO)
              : portada({ nombre: receta.nombre, categoria: receta.codigoCategoria }, { clase: 'armar-foto-sin' }),
            el('div', {},
              el('small', {}, 'Pedido de la mesa'),
              el('strong', {}, receta.nombre),
              el('span', { class: 'meta' }, [receta.categoria, receta.origen].filter(Boolean).join(' · ')))),
          el('div', { class: 'armar-olla' },
            el('div', { class: 'armar-olla-cabecera' }, el('span', {}, icono('olla'), ' La olla'), contador),
            olla)),
        el('p', { class: 'falta-pregunta' }, `La alacena: elegí ${necesarios} ingredientes`),
        el('div', { class: `armar-alacena armar-${alacena.length}` }, fichas),
        aviso,
        el('div', { class: 'juego-siguiente' }, servir, siguiente));
      pintar();
    }

    function terminar() {
      zona.replaceChildren(finDePartida({
        juego: 'armar',
        modo,
        titulo: 'Armá el plato',
        puntos,
        maximo: RONDAS * reglas.correctos * reglas.acierto,
        detalle: `Platos perfectos: ${perfectos} de ${total}.`,
        partida,
        alReintentar: () => empezar(modo),
        alCambiarModo: inicio,
        textoCompartir: `🥘 A Mano · Armá el plato (${MODOS[modo].nombre})\n${marcas.join('')}\n${puntos} puntos`,
      }));
    }

    ronda();
  }

  inicio();
}
