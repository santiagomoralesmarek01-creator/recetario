// Catálogo de TheMealDB ya traducido al español (data/mealdb/, lo genera
// scripts/traducir-catalogo.py). Si no está disponible, repositorio.js usa
// la API original en inglés como respaldo.
import { urlIngrediente } from './imagenes.js';

let indicePromesa = null;

function cargarIndice() {
  indicePromesa ??= fetch('data/mealdb/indice.json')
    .then((r) => {
      if (!r.ok) throw new Error(`Catálogo no disponible (${r.status})`);
      return r.json();
    })
    .then(({ categorias, recetas }) => ({
      categorias,
      recetas: recetas.map(([id, nombre, categoria, origen, imagen, ingredientes]) => ({
        id,
        origenDatos: 'mealdb',
        nombre,
        categoria,
        origen,
        imagen,
        nombresIngredientes: ingredientes ? ingredientes.split('|') : [],
      })),
    }))
    .catch((err) => {
      indicePromesa = null;
      throw err;
    });
  return indicePromesa;
}

export async function disponible() {
  try {
    await cargarIndice();
    return true;
  } catch {
    return false;
  }
}

export async function categorias() {
  return (await cargarIndice()).categorias;
}

export async function todas() {
  return (await cargarIndice()).recetas;
}

export async function obtener(id) {
  const r = await fetch(`data/mealdb/${encodeURIComponent(id)}.json`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`No se pudo cargar la receta (${r.status})`);
  const d = await r.json();
  return {
    id: d.id,
    origenDatos: 'mealdb',
    nombre: d.nombre,
    nombreOriginal: d.original,
    categoria: d.categoria,
    origen: d.origen,
    imagen: d.imagen,
    video: d.video,
    enlace: d.enlace,
    etiquetas: d.etiquetas || [],
    ingredientes: d.ingredientes.map(([nombre, medida, claveImagen]) => ({
      nombre, medida, imagen: urlIngrediente(claveImagen),
    })),
    pasos: d.pasos,
    pasosEnIngles: Boolean(d.pasosEnIngles),
  };
}

const normalizar = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Busca todas las palabras en el nombre o los ingredientes. Primero las que
// coinciden en el nombre.
export async function buscar(texto) {
  const palabras = normalizar(texto).split(/\s+/).filter((p) => p.length > 1);
  if (!palabras.length) return [];
  const conPuntaje = [];
  for (const r of await todas()) {
    const nombre = normalizar(r.nombre);
    const ingredientes = normalizar(r.nombresIngredientes.join(' '));
    let puntaje = 0;
    for (const p of palabras) {
      if (nombre.includes(p)) puntaje += 2;
      else if (ingredientes.includes(p)) puntaje += 1;
      else { puntaje = 0; break; }
    }
    if (puntaje) conPuntaje.push([puntaje, r]);
  }
  return conPuntaje.sort((a, b) => b[0] - a[0]).map(([, r]) => r);
}

export async function deCategoria(categoria) {
  return (await todas()).filter((r) => r.categoria === categoria);
}

export async function dePais(pais) {
  return (await todas()).filter((r) => r.origen === pais);
}

export async function aleatoria() {
  const lista = await todas();
  return obtener(lista[Math.floor(Math.random() * lista.length)].id);
}
