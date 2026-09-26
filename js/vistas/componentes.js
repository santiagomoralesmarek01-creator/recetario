import { el } from '../dom.js';
import { crearImagen, urlPlato, IMG_PLATO_GENERICO } from '../imagenes.js';
import { traducirCategoria, traducirOrigen } from '../traducciones.js';

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
    return crearImagen(urlPlato(receta.imagen, { miniatura: achicar }), receta.nombre, IMG_PLATO_GENERICO, clase);
  }
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
    r.minutos && `⏱ ${r.minutos} min`,
    r.porciones && `🍽 ${r.porciones} porciones`,
  ].filter(Boolean).join(' · ');
}

export function tarjetaReceta(r) {
  return el('a', { class: 'tarjeta', href: `#/receta/${r.id}` },
    el('div', { class: 'tarjeta-portada' },
      portada(r, { miniatura: true, clase: 'tarjeta-img' }),
      INSIGNIAS[r.origenDatos] && el('span', { class: `insignia insignia-${r.origenDatos}` }, INSIGNIAS[r.origenDatos]),
      r.origenDatos === 'usuario' && r.publica === false && el('span', { class: 'insignia insignia-privada' }, '🔒 Privada')),
    el('div', { class: 'tarjeta-cuerpo' },
      el('h3', {}, r.nombre),
      el('p', { class: 'meta' }, [
        r.categoria && traducirCategoria(r.categoria),
        r.autor && `por ${r.autor}`,
      ].filter(Boolean).join(' · '))));
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

export function seccion(titulo, recetas, extra = null) {
  if (!recetas.length) return null;
  return el('section', { class: 'seccion' },
    el('div', { class: 'seccion-titulo' }, el('h2', {}, titulo), extra),
    grillaRecetas(recetas));
}
