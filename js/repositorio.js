// Punto único para obtener recetas, vengan de donde vengan.
// Los ids llevan un prefijo que indica el origen:
//   "c-<slug>"  → recetas de la casa (data/recetas-casa.json)
//   "u-<uuid>"  → recetas de usuarios (Supabase)
//   "<número>"  → TheMealDB
//
// Formato común de una receta:
// { id, origenDatos, nombre, categoria, origen, descripcion, porciones, minutos,
//   imagen, video, enlace, etiquetas[], ingredientes[{nombre, medida, imagen}],
//   pasos[], autor, userId, publica }
import * as mealdb from './api.js';
import * as casa from './recetasCasa.js';
import * as comunidad from './misRecetas.js';
import { hayBackend } from './supabase.js';
import { terminoDeBusqueda } from './traducciones.js';

// Una fuente que falla no debe tirar abajo toda la página.
const seguro = (promesa) => promesa.catch((err) => { console.warn(err); return []; });

export async function obtenerReceta(id) {
  if (id.startsWith('c-')) return casa.obtener(id.slice(2));
  if (id.startsWith('u-')) return comunidad.obtener(id.slice(2));
  return mealdb.obtenerReceta(id);
}

export async function buscar(texto) {
  const termino = terminoDeBusqueda(texto);
  const [deCasa, deComunidad, porNombre] = await Promise.all([
    casa.buscar(texto),
    hayBackend ? seguro(comunidad.buscar(texto)) : [],
    seguro(mealdb.buscarPorNombre(termino)),
  ]);

  let internacionales = porNombre;
  let porIngrediente = false;
  if (!internacionales.length) {
    internacionales = await seguro(mealdb.buscarPorIngrediente(termino.replace(/\s+/g, '_')));
    porIngrediente = internacionales.length > 0;
  }
  return { termino, deCasa, deComunidad, internacionales, porIngrediente };
}

export async function deCategoria(categoria) {
  const [deCasa, deComunidad, internacionales] = await Promise.all([
    casa.deCategoria(categoria),
    hayBackend ? seguro(comunidad.deCategoria(categoria)) : [],
    seguro(mealdb.recetasDeCategoria(categoria)),
  ]);
  return [...deCasa, ...deComunidad, ...internacionales];
}

export const recetasDeLaCasa = () => casa.todas();
export const recetasDeLaComunidad = () => (hayBackend ? seguro(comunidad.listarPublicas()) : Promise.resolve([]));
export const categorias = () => seguro(mealdb.listarCategorias());

// Mezcla recetas de la casa con las internacionales; si TheMealDB no responde, usa las de la casa.
export async function aleatoria() {
  const locales = await casa.todas();
  const elegirLocal = () => locales[Math.floor(Math.random() * locales.length)];
  if (locales.length && Math.random() < 0.3) return elegirLocal();
  try {
    return await mealdb.recetaAleatoria();
  } catch (err) {
    if (locales.length) return elegirLocal();
    throw err;
  }
}
