import { el } from '../dom.js';
import { crearImagen, urlPlato, IMG_PLATO_GENERICO } from '../imagenes.js';
import { traducirCategoria, traducirOrigen } from '../traducciones.js';
import { NIVELES } from '../dificultad.js';
import { MOMENTOS, SABORES, momentoDe, saborDe } from '../tipoPlato.js';
import { icono } from '../iconos.js';

const INSIGNIAS = { casa: 'De la casa', usuario: 'Comunidad' };

// Recetas sin foto: un fondo cálido con el emoji de su categoría, en lugar
// de una imagen genérica.
const ESTILO_CATEGORIA = {
  Beef: ['🥩', '#f3c9b8', '#fbe6dc'], Chicken: ['🍗', '#f5d2a6', '#fdebd3'], Pork: ['🥓', '#f2c3c0', '#fce4e1'],
  Lamb: ['🍖', '#eecbb0', '#fae5d6'], Goat: ['🍖', '#eecbb0', '#fae5d6'], Seafood: ['🦐', '#bfe0e6', '#e3f3f6'],
  Pasta: ['🍝', '#f6dca0', '#fdf0d0'], Vegetarian: ['🥗', '#cfe3b6', '#ecf5e0'], Vegan: ['🌱', '#cfe3b6', '#ecf5e0'],
  Dessert: ['🍰', '#f4cfdc', '#fce8ef'], Breakfast: ['🍳', '#f7e2a8', '#fdf3d6'], Side: ['🥖', '#ecd6b5', '#f8ecda'],
  Starter: ['🥟', '#efd7bd', '#f9ecde'], Miscellaneous: ['🍲', '#e8d3c1', '#f6ebe1'],
};

export function portada(receta, { miniatura = false, clase = '' } = {}) {
  if (receta.imagen) {
    const achicar = miniatura && /themealdb\.com\/images\/media/.test(receta.imagen);
    const img = crearImagen(urlPlato(receta.imagen, { miniatura: achicar }), receta.nombre, IMG_PLATO_GENERICO, clase);
    // Fotos externas (Wikimedia): si no cargan, mejor el fondo de la categoría que el ícono genérico.
    if (/wikimedia\.org/.test(receta.imagen)) {
      img.addEventListener('error', () => img.replaceWith(portadaSinFoto(receta, clase)), { once: true });
    }
    return img;
  }
  return portadaSinFoto(receta, clase);
}

function portadaSinFoto(receta, clase) {
  const [emoji, tono, claro] = ESTILO_CATEGORIA[receta.categoria] || ESTILO_CATEGORIA.Miscellaneous;
  return el('div', {
    class: `portada-sin-foto ${clase}`, role: 'img', 'aria-label': receta.nombre,
    style: `--tono: ${tono}; --tono-claro: ${claro}`,
  }, el('span', { 'aria-hidden': 'true' }, emoji));
}

export function metaReceta(r) {
  return [
    r.categoria && traducirCategoria(r.categoria),
    r.origen && traducirOrigen(r.origen),
    r.minutos && `${r.minutos} min`,
    r.porciones && `${r.porciones} porciones`,
  ].filter(Boolean).join(' · ');
}

export function tarjetaReceta(r) {
  return el('a', { class: 'tarjeta', href: `#/receta/${r.id}` },
    el('div', { class: 'tarjeta-portada' },
      portada(r, { miniatura: true, clase: 'tarjeta-img' }),
      INSIGNIAS[r.origenDatos] && el('span', { class: `insignia insignia-${r.origenDatos}` }, INSIGNIAS[r.origenDatos]),
      r.origenDatos === 'usuario' && r.publica === false && el('span', { class: 'insignia insignia-privada' }, icono('candado'), 'Privada'),
      r.origen && el('span', { class: 'insignia insignia-pais' }, traducirOrigen(r.origen))),
    el('div', { class: 'tarjeta-cuerpo' },
      el('h3', {}, r.nombre),
      el('p', { class: 'meta' }, [
        r.categoria && traducirCategoria(r.categoria),
        r.autor && `por ${r.autor}`,
      ].filter(Boolean).join(' · ')),
      r.dificultad && el('p', { class: `tarjeta-dificultad nivel-${r.dificultad}` },
        el('span', { class: 'pildora-dificultad' }, el('span', { class: 'punto-nivel', 'aria-hidden': 'true' }), NIVELES[r.dificultad].nombre),
        r.dificiles > 0 && el('span', { class: 'tarjeta-especiales', title: 'Lleva ingredientes difíciles de conseguir en Latinoamérica' }, ' · ', icono('canasta'), 'ingredientes especiales'))));
}

// ---------- filtro por dificultad ----------

const CLAVE_FILTRO = 'recetario:filtro';

const FILTRO_VACIO = { nivel: 0, conseguibles: false, momento: '', sabor: '' };

function leerFiltro() {
  try { return { ...FILTRO_VACIO, ...JSON.parse(sessionStorage.getItem(CLAVE_FILTRO) || '{}') }; } catch { return { ...FILTRO_VACIO }; }
}

// Momento y sabor se calculan una sola vez por receta.
const tipos = new WeakMap();
function tipoDe(r) {
  if (!tipos.has(r)) tipos.set(r, { momento: momentoDe(r), sabor: saborDe(r) });
  return tipos.get(r);
}

function selector(etiqueta, opciones, valor, alCambiar) {
  const select = el('select', { onchange: () => alCambiar(select.value) },
    el('option', { value: '' }, `Todos`),
    Object.entries(opciones).map(([clave, o]) => el('option', { value: clave, selected: clave === valor }, o.nombre)));
  return el('label', { class: 'filtro-selector' }, el('span', {}, etiqueta), select);
}

// Grupos de recetas ([{ titulo, recetas, tanda }]) con una barra para filtrar
// por momento del día, sabor, dificultad y ingredientes fáciles de conseguir.
// El filtro elegido se recuerda mientras dure la visita.
export function listadoFiltrable(grupos, { vacio = 'No hay recetas para mostrar.', dificultad = true } = {}) {
  const estado = leerFiltro();
  if (!dificultad) estado.nivel = 0;
  const contador = el('p', { class: 'meta filtro-contador', 'aria-live': 'polite' });
  const cuerpo = el('div', { class: 'filtro-resultados' });
  const opciones = [[0, 'Todas'], ...Object.entries(NIVELES).map(([n, d]) => [Number(n), d.nombre])];
  const chips = opciones.map(([n, texto]) => el('button', {
    type: 'button', class: `filtro-chip${n ? ` nivel-${n}` : ''}`,
    onclick: () => { estado.nivel = n; actualizar(); },
  }, n ? el('span', { class: 'punto-nivel', 'aria-hidden': 'true' }) : '', texto));
  const conseguibles = el('input', {
    type: 'checkbox', checked: estado.conseguibles,
    onchange: () => { estado.conseguibles = conseguibles.checked; actualizar(); },
  });

  const pasa = (r) => (!estado.nivel || r.dificultad === estado.nivel)
    && (!estado.conseguibles || !r.dificiles)
    && (!estado.momento || tipoDe(r).momento === estado.momento)
    && (!estado.sabor || tipoDe(r).sabor === estado.sabor);

  function actualizar() {
    try { sessionStorage.setItem(CLAVE_FILTRO, JSON.stringify(estado)); } catch { /* sin almacenamiento */ }
    chips.forEach((c, i) => {
      const activo = opciones[i][0] === estado.nivel;
      c.classList.toggle('activo', activo);
      c.setAttribute('aria-pressed', String(activo));
    });
    const filtrados = grupos.map((g) => ({ ...g, recetas: g.recetas.filter(pasa) }));
    const total = filtrados.reduce((s, g) => s + g.recetas.length, 0);
    const hayFiltro = estado.nivel || estado.conseguibles || estado.momento || estado.sabor;
    contador.textContent = `${total} receta${total === 1 ? '' : 's'}${hayFiltro ? ' con este filtro' : ''}`;
    cuerpo.replaceChildren(
      ...filtrados.filter((g) => g.recetas.length).map((g) => (g.titulo
        ? el('section', { class: 'seccion' }, el('h2', {}, g.titulo), grillaRecetas(g.recetas, { tanda: g.tanda || 0 }))
        : grillaRecetas(g.recetas, { tanda: g.tanda || 0 }))),
      total === 0 && el('p', { class: 'estado' }, hayFiltro ? 'Ninguna receta cumple con este filtro. Probá con otro.' : vacio));
  }

  actualizar();
  return el('div', { class: 'listado-filtrable' },
    el('div', { class: 'filtro-dificultad' },
      selector('Momento', MOMENTOS, estado.momento, (v) => { estado.momento = v; actualizar(); }),
      selector('Sabor', SABORES, estado.sabor, (v) => { estado.sabor = v; actualizar(); }),
      dificultad && el('div', { class: 'filtro-chips', role: 'group', 'aria-label': 'Dificultad' }, chips),
      el('label', { class: 'filtro-conseguir' }, conseguibles, icono('canasta'), 'Sólo ingredientes fáciles de conseguir'),
      dificultad && leyendaDificultad()),
    contador, cuerpo);
}

// "¿Qué significa cada nivel?", desplegable.
export function leyendaDificultad() {
  return el('details', { class: 'leyenda-dificultad' },
    el('summary', {}, '¿Qué significa cada nivel?'),
    el('ul', {}, Object.entries(NIVELES).map(([n, d]) => el('li', { class: `nivel-${n}` },
      el('span', { class: 'punto-nivel', 'aria-hidden': 'true' }), el('strong', {}, d.nombre), `: ${d.descripcion}`))),
    el('p', {}, 'Se calcula con la cantidad de pasos e ingredientes, el tiempo y las técnicas de cada receta. La ', icono('canasta'), ' marca los ingredientes difíciles de conseguir en Latinoamérica.'));
}

// Con "tanda" muestra de a N tarjetas y un botón para ver más (listas largas).
export function grillaRecetas(recetas, { tanda = 0 } = {}) {
  if (!tanda || recetas.length <= tanda) return el('div', { class: 'grilla' }, recetas.map(tarjetaReceta));
  const grilla = el('div', { class: 'grilla' });
  let mostradas = 0;
  const boton = el('button', { type: 'button', class: 'boton-secundario', onclick: () => mostrarMas() });
  const pie = el('div', { class: 'ver-mas' }, boton);
  function mostrarMas() {
    grilla.append(...recetas.slice(mostradas, mostradas + tanda).map(tarjetaReceta));
    mostradas = Math.min(recetas.length, mostradas + tanda);
    const quedan = recetas.length - mostradas;
    boton.textContent = `Ver más (${quedan} restantes)`;
    pie.hidden = quedan === 0;
  }
  mostrarMas();
  return el('div', {}, grilla, pie);
}
