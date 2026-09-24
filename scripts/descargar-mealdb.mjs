// Descarga el catálogo completo de TheMealDB (en inglés) a data/fuente/mealdb-en.json.
// Lo corre la GitHub Action "Descargar catálogo"; después se traduce a data/mealdb-es.json.
import { mkdir, writeFile } from 'node:fs/promises';

const BASE = 'https://www.themealdb.com/api/json/v1/1';
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function pedir(ruta) {
  for (let intento = 1; intento <= 4; intento++) {
    try {
      const r = await fetch(`${BASE}/${ruta}`);
      if (r.ok) return await r.json();
      console.warn(`${ruta}: HTTP ${r.status}`);
    } catch (err) {
      console.warn(`${ruta}: ${err.message}`);
    }
    await esperar(1000 * intento);
  }
  throw new Error(`No se pudo descargar ${ruta}`);
}

const recetas = new Map();
for (const letra of 'abcdefghijklmnopqrstuvwxyz0123456789') {
  const data = await pedir(`search.php?f=${letra}`);
  for (const m of data.meals || []) recetas.set(m.idMeal, m);
  await esperar(250);
}

const compactas = [...recetas.values()]
  .sort((a, b) => Number(a.idMeal) - Number(b.idMeal))
  .map((m) => {
    const ingredientes = [];
    for (let i = 1; i <= 20; i++) {
      const nombre = (m[`strIngredient${i}`] || '').trim();
      if (nombre) ingredientes.push([nombre, (m[`strMeasure${i}`] || '').trim()]);
    }
    return {
      id: m.idMeal,
      nombre: m.strMeal,
      categoria: m.strCategory || '',
      origen: m.strArea || '',
      imagen: m.strMealThumb || '',
      video: m.strYoutube || '',
      enlace: m.strSource || '',
      etiquetas: (m.strTags || '').split(',').map((t) => t.trim()).filter(Boolean),
      ingredientes,
      instrucciones: m.strInstructions || '',
    };
  });

const categorias = (await pedir('categories.php')).categories.map((c) => ({
  nombre: c.strCategory,
  imagen: c.strCategoryThumb,
}));

await mkdir('data/fuente', { recursive: true });
await writeFile('data/fuente/mealdb-en.json', JSON.stringify({ descargado: new Date().toISOString(), categorias, recetas: compactas }, null, 1));
console.log(`${compactas.length} recetas y ${categorias.length} categorías descargadas.`);
