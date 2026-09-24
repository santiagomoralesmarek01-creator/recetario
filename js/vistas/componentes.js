import { el } from '../dom.js';
import { crearImagen, urlPlato, IMG_PLATO_GENERICO, IMG_INGREDIENTE_GENERICO } from '../imagenes.js';
import { traducirCategoria, traducirOrigen } from '../traducciones.js';

const INSIGNIAS = { casa: 'De la casa', usuario: 'Comunidad' };

// Si la receta no tiene foto, armamos un collage con sus ingredientes:
// así ninguna tarjeta queda con una imagen genérica.
export function portada(receta, { miniatura = false, clase = '' } = {}) {
  if (receta.imagen) {
    return crearImagen(urlPlato(receta.imagen, { miniatura: miniatura && receta.origenDatos === 'mealdb' }),
      receta.nombre, IMG_PLATO_GENERICO, clase);
  }
  const conImagen = (receta.ingredientes || []).filter((i) => i.imagen && i.imagen !== IMG_INGREDIENTE_GENERICO);
  if (conImagen.length < 2) {
    return crearImagen(IMG_PLATO_GENERICO, receta.nombre, IMG_PLATO_GENERICO, clase);
  }
  const cuatro = conImagen.slice(0, 4);
  return el('div', { class: `collage ${clase} collage-${cuatro.length}`, role: 'img', 'aria-label': receta.nombre },
    cuatro.map((i) => crearImagen(i.imagen, '', IMG_INGREDIENTE_GENERICO)));
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
