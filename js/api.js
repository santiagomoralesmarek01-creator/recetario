// Cliente mínimo de TheMealDB (https://www.themealdb.com/api.php).
// La clave "1" es la de prueba/desarrollo. Para publicar el sitio conviene
// conseguir una clave propia (se obtiene apoyando el proyecto en Patreon).
const API_KEY = '1';
const BASE = `https://www.themealdb.com/api/json/v1/${API_KEY}`;

const cache = new Map();

async function pedir(ruta) {
  if (cache.has(ruta)) return cache.get(ruta);
  const promesa = fetch(`${BASE}/${ruta}`)
    .then((r) => {
      if (!r.ok) throw new Error(`Error ${r.status} al consultar ${ruta}`);
      return r.json();
    })
    .catch((err) => {
      cache.delete(ruta);
      throw err;
    });
  cache.set(ruta, promesa);
  return promesa;
}

// Convierte el formato plano de TheMealDB (strIngredient1..20 / strMeasure1..20)
// en un objeto más cómodo de usar.
export function normalizarReceta(m) {
  const ingredientes = [];
  for (let i = 1; i <= 20; i++) {
    const nombre = (m[`strIngredient${i}`] || '').trim();
    if (!nombre) continue;
    ingredientes.push({ nombre, medida: (m[`strMeasure${i}`] || '').trim() });
  }
  return {
    id: m.idMeal,
    nombre: m.strMeal,
    categoria: m.strCategory || '',
    origen: m.strArea || '',
    instrucciones: m.strInstructions || '',
    imagen: m.strMealThumb || '',
    video: m.strYoutube || '',
    fuente: m.strSource || '',
    etiquetas: (m.strTags || '').split(',').map((t) => t.trim()).filter(Boolean),
    ingredientes,
  };
}

// Resumen liviano (lo que devuelve filter.php): sólo id, nombre e imagen.
function normalizarResumen(m) {
  return { id: m.idMeal, nombre: m.strMeal, imagen: m.strMealThumb || '' };
}

export async function buscarPorNombre(texto) {
  const data = await pedir(`search.php?s=${encodeURIComponent(texto)}`);
  return (data.meals || []).map(normalizarReceta);
}

export async function buscarPorIngrediente(ingrediente) {
  const data = await pedir(`filter.php?i=${encodeURIComponent(ingrediente)}`);
  return (data.meals || []).map(normalizarResumen);
}

export async function recetasDeCategoria(categoria) {
  const data = await pedir(`filter.php?c=${encodeURIComponent(categoria)}`);
  return (data.meals || []).map(normalizarResumen);
}

export async function obtenerReceta(id) {
  const data = await pedir(`lookup.php?i=${encodeURIComponent(id)}`);
  return data.meals && data.meals[0] ? normalizarReceta(data.meals[0]) : null;
}

export async function recetaAleatoria() {
  // No se cachea: cada llamada debe traer una receta distinta.
  const r = await fetch(`${BASE}/random.php`);
  if (!r.ok) throw new Error(`Error ${r.status} al pedir una receta aleatoria`);
  const data = await r.json();
  return normalizarReceta(data.meals[0]);
}

export async function listarCategorias() {
  const data = await pedir('categories.php');
  return (data.categories || []).map((c) => ({
    nombre: c.strCategory,
    imagen: c.strCategoryThumb,
  }));
}
