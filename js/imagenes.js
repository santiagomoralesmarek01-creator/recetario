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

// TheMealDB sirve versiones chicas agregando "/small" (~250 px) o "/medium"
// (~350 px) a la URL de la foto del plato; sin sufijo es la grande (~700 px).
export function urlPlato(urlOriginal, { miniatura = false } = {}) {
  if (!urlOriginal) return IMG_PLATO_GENERICO;
  return miniatura ? `${urlOriginal}/small` : urlOriginal;
}

// Para tarjetas: la mediana en pantallas comunes y la grande en pantallas de
// alta densidad (celulares, notebooks con "retina"), así no se ve borrosa.
export function fuentesPlato(urlOriginal) {
  return {
    src: `${urlOriginal}/medium`,
    srcset: `${urlOriginal}/medium 350w, ${urlOriginal} 700w`,
    sizes: '(max-width: 700px) 48vw, 290px',
  };
}

const SUFIJO_CHICO = /\/(small|medium)$/;

// Crea un <img> con carga diferida y reemplazo automático si la imagen falla.
// `fuentes` opcional: { srcset, sizes } para que el navegador elija el tamaño.
export function crearImagen(src, alt, reemplazo, clase = '', fuentes = null) {
  const img = document.createElement('img');
  img.loading = 'lazy';
  img.decoding = 'async';
  img.alt = alt;
  if (clase) img.className = clase;
  img.addEventListener('error', () => {
    // Si falla una versión chica, probamos la original antes del genérico.
    const actual = img.currentSrc || img.src;
    if (SUFIJO_CHICO.test(actual) && !img.dataset.reintento) {
      img.dataset.reintento = '1';
      img.removeAttribute('srcset');
      img.removeAttribute('sizes');
      img.src = actual.replace(SUFIJO_CHICO, '');
      return;
    }
    img.removeAttribute('srcset');
    if (!img.src.endsWith(reemplazo)) img.src = reemplazo;
  });
  if (fuentes?.srcset) {
    img.sizes = fuentes.sizes || '100vw';
    img.srcset = fuentes.srcset;
  }
  img.src = src || reemplazo;
  return img;
}
