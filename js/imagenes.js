// Toda la lógica de "de dónde sale cada imagen" vive acá.
// Si mañana cambiás de proveedor (Spoonacular, Cloudinary, fotos propias),
// sólo hay que tocar este archivo.

const BASE_INGREDIENTES = 'https://www.themealdb.com/images/ingredients';

export const IMG_PLATO_GENERICO = 'img/plato-generico.svg';
export const IMG_INGREDIENTE_GENERICO = 'img/ingrediente-generico.svg';

// Tamaños disponibles en TheMealDB: -Small (100px), -Medium (350px) o sin sufijo (grande).
export function urlIngrediente(nombreEnIngles, tamano = 'Small') {
  if (!nombreEnIngles) return IMG_INGREDIENTE_GENERICO;
  const sufijo = tamano ? `-${tamano}` : '';
  return `${BASE_INGREDIENTES}/${encodeURIComponent(nombreEnIngles.trim())}${sufijo}.png`;
}

// TheMealDB sirve una miniatura agregando "/small" a la URL de la foto del plato.
export function urlPlato(urlOriginal, { miniatura = false } = {}) {
  if (!urlOriginal) return IMG_PLATO_GENERICO;
  return miniatura ? `${urlOriginal}/small` : urlOriginal;
}

// Crea un <img> con carga diferida y reemplazo automático si la imagen falla.
export function crearImagen(src, alt, reemplazo, clase = '') {
  const img = document.createElement('img');
  img.loading = 'lazy';
  img.decoding = 'async';
  img.alt = alt;
  if (clase) img.className = clase;
  img.addEventListener('error', () => {
    // Si también falla la miniatura, probamos la original antes del genérico.
    if (img.src.endsWith('/small') && !img.dataset.reintento) {
      img.dataset.reintento = '1';
      img.src = img.src.slice(0, -'/small'.length);
      return;
    }
    if (!img.src.endsWith(reemplazo)) img.src = reemplazo;
  });
  img.src = src || reemplazo;
  return img;
}
