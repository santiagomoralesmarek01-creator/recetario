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
import { aplicarFotos } from './fotos.js';
import { expandirBusqueda } from './sinonimos.js';

// Una fuente que falla no debe tirar abajo toda la página.
const seguro = (promesa) => promesa.catch((err) => { console.warn(err); return []; });

export async function obtenerReceta(id) {
  if (id.startsWith('c-')) return casa.obtener(id.slice(2));
  if (id.startsWith('u-')) {
    const r = await comunidad.obtener(id.slice(2));
    return r && (await aplicarFotos([r]))[0];
  }
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

// Une resultados de varias búsquedas sin repetir, en el orden en que llegan.
const unir = (listas) => {
  const vistos = new Set();
  return listas.flat().filter((r) => !vistos.has(r.id) && vistos.add(r.id));
};

// También busca los sinónimos regionales ("elote" encuentra "choclo").
// `tambien` son las palabras que se sumaron, para mostrarlas.
export async function buscar(texto) {
  const { variantes, cambios } = expandirBusqueda(texto);
  const consultas = [texto, ...variantes.slice(1)];
  const hayCatalogo = await catalogo.disponible();
  const [deCasa, deComunidad, internacionales] = await Promise.all([
    Promise.all(consultas.map((q) => casa.buscar(q))).then(unir),
    hayBackend ? Promise.all(consultas.slice(0, 3).map((q) => seguro(comunidad.buscar(q)))).then(unir) : [],
    hayCatalogo ? Promise.all(consultas.map((q) => catalogo.buscar(q))).then(unir) : buscarEnApi(texto),
  ]);
  return { deCasa, deComunidad, internacionales, tambien: cambios };
}

export async function deCategoria(categoria) {
  const [deCasa, deComunidad, internacionales] = await Promise.all([
    casa.deCategoria(categoria),
    hayBackend ? seguro(comunidad.deCategoria(categoria)) : [],
    catalogo.disponible().then((ok) => (ok ? catalogo.deCategoria(categoria) : seguro(mealdb.recetasDeCategoria(categoria)))),
  ]);
  return [...deCasa, ...deComunidad, ...internacionales];
}

// Países con cantidad de recetas (casa + catálogo), de mayor a menor.
export async function paises() {
  const [deCasa, delMundo] = await Promise.all([
    casa.todas(),
    catalogo.disponible().then((ok) => (ok ? catalogo.todas() : [])),
  ]);
  const cuenta = new Map();
  for (const r of [...deCasa, ...delMundo]) {
    if (r.origen) cuenta.set(r.origen, (cuenta.get(r.origen) || 0) + 1);
  }
  return [...cuenta].map(([nombre, cantidad]) => ({ nombre, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre, 'es'));
}

export async function dePais(pais) {
  const [deCasa, deComunidad, internacionales] = await Promise.all([
    casa.dePais(pais),
    hayBackend ? seguro(comunidad.dePais(pais)) : [],
    catalogo.disponible().then((ok) => (ok ? catalogo.dePais(pais) : [])),
  ]);
  return { deCasa, deComunidad, internacionales };
}

export const recetasDeLaCasa = () => casa.todas();

// Las de la casa y las del catálogo, en ese orden.
export async function todasLasRecetas() {
  const [deCasa, delCatalogo] = await Promise.all([casa.todas(), seguro(catalogo.todas())]);
  return [...deCasa, ...delCatalogo];
}

// Resúmenes de varias recetas por id, en el mismo orden (las que no existen se omiten).
export async function resumenes(ids) {
  const [delCatalogo, deCasa] = await Promise.all([seguro(catalogo.todas()), casa.todas()]);
  const uuids = ids.filter((id) => id.startsWith('u-')).map((id) => id.slice(2));
  const deUsuarios = uuids.length && hayBackend ? await seguro(comunidad.porIds(uuids)) : [];
  const porId = new Map([...delCatalogo, ...deCasa, ...deUsuarios].map((r) => [r.id, r]));
  return ids.map((id) => porId.get(id)).filter(Boolean);
}
export const recetasDeLaComunidad = () => (hayBackend ? seguro(comunidad.listarPublicas()) : Promise.resolve([]));
export const explorarComunidad = (opciones) => comunidad.explorarComunidad(opciones);

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
