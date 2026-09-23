import * as api from './api.js';
import {
  crearImagen, urlIngrediente, urlPlato,
  IMG_PLATO_GENERICO, IMG_INGREDIENTE_GENERICO,
} from './imagenes.js';
import {
  traducirCategoria, traducirIngrediente, traducirOrigen, terminoDeBusqueda,
} from './traducciones.js';

const contenido = document.getElementById('contenido');
const buscador = document.getElementById('buscador');
const inputBusqueda = document.getElementById('busqueda');

// ---------- utilidades de DOM ----------

function el(tag, props = {}, ...hijos) {
  const nodo = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') nodo.className = v;
    else if (k.startsWith('on')) nodo.addEventListener(k.slice(2), v);
    else nodo.setAttribute(k, v);
  }
  for (const h of hijos.flat()) {
    if (h == null || h === false) continue;
    nodo.append(h instanceof Node ? h : document.createTextNode(h));
  }
  return nodo;
}

function mostrar(...nodos) {
  contenido.replaceChildren(...nodos);
  window.scrollTo({ top: 0 });
}

function cargando(texto = 'Cargando…') {
  mostrar(el('p', { class: 'estado' }, texto));
}

function error(err) {
  console.error(err);
  mostrar(
    el('div', { class: 'estado' },
      el('p', {}, 'No se pudo conectar con el servidor de recetas.'),
      el('button', { type: 'button', onclick: () => router() }, 'Reintentar'))
  );
}

// ---------- componentes ----------

function tarjetaReceta(r) {
  return el('a', { class: 'tarjeta', href: `#/receta/${r.id}` },
    crearImagen(urlPlato(r.imagen, { miniatura: true }), r.nombre, IMG_PLATO_GENERICO, 'tarjeta-img'),
    el('div', { class: 'tarjeta-cuerpo' },
      el('h3', {}, r.nombre),
      r.categoria && el('p', { class: 'meta' },
        [traducirCategoria(r.categoria), r.origen && traducirOrigen(r.origen)].filter(Boolean).join(' · '))));
}

function grillaRecetas(recetas) {
  return el('div', { class: 'grilla' }, recetas.map(tarjetaReceta));
}

function chipIngrediente({ nombre, medida }) {
  return el('li', { class: 'ingrediente' },
    crearImagen(urlIngrediente(nombre), nombre, IMG_INGREDIENTE_GENERICO),
    el('div', {},
      el('strong', {}, traducirIngrediente(nombre)),
      medida && el('span', { class: 'medida' }, medida)));
}

// ---------- vistas ----------

async function vistaInicio() {
  cargando();
  const [categorias, destacada] = await Promise.all([
    api.listarCategorias(),
    api.recetaAleatoria().catch(() => null),
  ]);

  mostrar(
    destacada && el('section', { class: 'destacada' },
      crearImagen(urlPlato(destacada.imagen), destacada.nombre, IMG_PLATO_GENERICO),
      el('div', {},
        el('p', { class: 'eyebrow' }, 'Receta del momento'),
        el('h1', {}, destacada.nombre),
        el('p', { class: 'meta' }, `${destacada.ingredientes.length} ingredientes · ${traducirCategoria(destacada.categoria)}`),
        el('a', { class: 'boton', href: `#/receta/${destacada.id}` }, 'Ver receta'))),
    el('h2', {}, 'Categorías'),
    el('div', { class: 'grilla grilla-categorias' },
      categorias.map((c) =>
        el('a', { class: 'tarjeta categoria', href: `#/categoria/${encodeURIComponent(c.nombre)}` },
          crearImagen(c.imagen, c.nombre, IMG_PLATO_GENERICO),
          el('h3', {}, traducirCategoria(c.nombre)))))
  );
}

async function vistaCategoria(nombre) {
  cargando();
  const recetas = await api.recetasDeCategoria(nombre);
  mostrar(
    el('a', { class: 'volver', href: '#/' }, '← Inicio'),
    el('h1', {}, traducirCategoria(nombre)),
    el('p', { class: 'meta' }, `${recetas.length} recetas`),
    grillaRecetas(recetas)
  );
}

async function vistaBusqueda(texto) {
  inputBusqueda.value = texto;
  cargando(`Buscando “${texto}”…`);
  const termino = terminoDeBusqueda(texto);

  // Primero por nombre de receta; si no hay nada, por ingrediente principal.
  let recetas = await api.buscarPorNombre(termino);
  let porIngrediente = false;
  if (!recetas.length) {
    recetas = await api.buscarPorIngrediente(termino.replace(/\s+/g, '_'));
    porIngrediente = recetas.length > 0;
  }

  mostrar(
    el('a', { class: 'volver', href: '#/' }, '← Inicio'),
    el('h1', {}, `Resultados para “${texto}”`),
    termino.toLowerCase() !== texto.trim().toLowerCase() &&
      el('p', { class: 'meta' }, `Buscado como “${termino}” (las recetas están en inglés).`),
    porIngrediente && el('p', { class: 'meta' }, 'Recetas que llevan ese ingrediente:'),
    recetas.length
      ? grillaRecetas(recetas)
      : el('p', { class: 'estado' }, 'No encontramos recetas. Probá con otra palabra.')
  );
}

async function vistaReceta(id) {
  cargando();
  const r = await api.obtenerReceta(id);
  if (!r) {
    mostrar(el('p', { class: 'estado' }, 'La receta no existe.'), el('a', { href: '#/' }, 'Volver al inicio'));
    return;
  }
  document.title = `${r.nombre} · Recetario`;

  const pasos = r.instrucciones
    .split(/\r?\n+/)
    .map((p) => p.replace(/^\s*(step\s*)?\d+[.):-]?\s*/i, '').trim())
    .filter((p) => p.length > 1);

  mostrar(
    el('a', { class: 'volver', href: r.categoria ? `#/categoria/${encodeURIComponent(r.categoria)}` : '#/' },
      `← ${r.categoria ? traducirCategoria(r.categoria) : 'Inicio'}`),
    el('article', { class: 'receta' },
      el('header', { class: 'receta-cabecera' },
        crearImagen(urlPlato(r.imagen), r.nombre, IMG_PLATO_GENERICO, 'receta-foto'),
        el('div', {},
          el('h1', {}, r.nombre),
          el('p', { class: 'meta' },
            [traducirCategoria(r.categoria), traducirOrigen(r.origen)].filter(Boolean).join(' · ')),
          r.etiquetas.length && el('ul', { class: 'etiquetas' }, r.etiquetas.map((t) => el('li', {}, t))),
          el('p', { class: 'enlaces' },
            r.video && el('a', { href: r.video, target: '_blank', rel: 'noopener' }, '▶ Ver video'),
            r.fuente && el('a', { href: r.fuente, target: '_blank', rel: 'noopener' }, 'Fuente original')))),
      el('section', {},
        el('h2', {}, `Ingredientes (${r.ingredientes.length})`),
        el('ul', { class: 'ingredientes' }, r.ingredientes.map(chipIngrediente))),
      el('section', {},
        el('h2', {}, 'Preparación'),
        el('ol', { class: 'pasos' }, pasos.map((p) => el('li', {}, p)))))
  );
}

// ---------- ruteo por hash ----------

async function router() {
  const [ruta, ...resto] = location.hash.replace(/^#\/?/, '').split('/');
  const param = decodeURIComponent(resto.join('/'));
  document.title = 'Recetario';
  try {
    if (ruta === 'receta' && param) await vistaReceta(param);
    else if (ruta === 'categoria' && param) await vistaCategoria(param);
    else if (ruta === 'buscar' && param) await vistaBusqueda(param);
    else await vistaInicio();
  } catch (err) {
    error(err);
  }
}

buscador.addEventListener('submit', (e) => {
  e.preventDefault();
  const texto = inputBusqueda.value.trim();
  if (texto) location.hash = `#/buscar/${encodeURIComponent(texto)}`;
});

document.getElementById('sorpresa').addEventListener('click', async () => {
  try {
    const r = await api.recetaAleatoria();
    location.hash = `#/receta/${r.id}`;
  } catch (err) {
    error(err);
  }
});

window.addEventListener('hashchange', router);
router();
