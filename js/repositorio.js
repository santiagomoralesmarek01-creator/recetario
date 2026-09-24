// Punto único para obtener recetas, vengan de donde vengan.
// Los ids llevan un prefijo que indica el origen:
//   "c-<slug>"  → recetas de la casa (data/recetas-casa.json)
//   "u-<uuid>"  → recetas de usuarios (Supabase)
//   "<número>"  → TheMealDB: primero el catálogo traducido (data/mealdb/),
//                 y si no está disponible, la API original en inglés.
//
// Formato común de una receta:
// { id, origenDatos, nombre, categoria, origen, descripcion, porciones, minutos,
//   imagen, video, enlace, etiquetas[], ingredientes[{nombre, medida, imagen}],
//   pasos[], autor, userId, publica }
import * as mealdb from './api.js';
import * as catalogo from './catalogo.js';
import * as casa from './recetasCasa.js';
import * as comunidad from './misRecetas.js';
import { hayBackend } from './supabase.js';
import { terminoDeBusqueda } from './traducciones.js';

// Una fuente que falla no debe tirar abajo toda la página.
const seguro = (promesa) => promesa.catch((err) => { console.warn(err); return []; });

export async function obtenerReceta(id) {
  if (id.startsWith('c-')) return casa.obtener(id.slice(2));
  if (id.startsWith('u-')) return comunidad.obtener(id.slice(2));
  if (await catalogo.disponible()) {
    const receta = await catalogo.obtener(id).catch(() => null);
    if (receta) return receta;
  }
  return mealdb.obtenerReceta(id);
}

// Respaldo en inglés: busca por nombre y, si no hay nada, por ingrediente.
async function buscarEnApi(texto) {
  const termino = terminoDeBusqueda(texto);
  const porNombre = await seguro(mealdb.buscarPorNombre(termino));
  if (porNombre.length) return porNombre;
  return seguro(mealdb.buscarPorIngrediente(termino.replace(/\s+/g, '_')));
}

export async function buscar(texto) {
  const [deCasa, deComunidad, internacionales] = await Promise.all([
    casa.buscar(texto),
    hayBackend ? seguro(comunidad.buscar(texto)) : [],
    catalogo.disponible().then((ok) => (ok ? catalogo.buscar(texto) : buscarEnApi(texto))),
  ]);
  return { deCasa, deComunidad, internacionales };
}

export async function deCategoria(categoria) {
  const [deCasa, deComunidad, internacionales] = await Promise.all([
    casa.deCategoria(categoria),
    hayBackend ? seguro(comunidad.deCategoria(categoria)) : [],
    catalogo.disponible().then((ok) => (ok ? catalogo.deCategoria(categoria) : seguro(mealdb.recetasDeCategoria(categoria)))),
  ]);
  return [...deCasa, ...deComunidad, ...internacionales];
}

export const recetasDeLaCasa = () => casa.todas();
export const recetasDeLaComunidad = () => (hayBackend ? seguro(comunidad.listarPublicas()) : Promise.resolve([]));

export async function categorias() {
  return (await catalogo.disponible()) ? catalogo.categorias() : seguro(mealdb.listarCategorias());
}

// Mezcla recetas de la casa con las del mundo; si el catálogo no responde, usa las de la casa.
export async function aleatoria() {
  const locales = await casa.todas();
  const elegirLocal = () => locales[Math.floor(Math.random() * locales.length)];
  if (locales.length && Math.random() < 0.2) return elegirLocal();
  try {
    return (await catalogo.disponible()) ? await catalogo.aleatoria() : await mealdb.recetaAleatoria();
  } catch (err) {
    if (locales.length) return elegirLocal();
    throw err;
  }
}
