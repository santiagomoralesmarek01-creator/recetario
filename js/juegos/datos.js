// Datos y utilidades compartidas por los juegos.
import * as catalogo from '../catalogo.js';
import * as casa from '../recetasCasa.js';
import { cargarIngredientes, normalizar } from '../ingredientes.js';
import { urlIngrediente, urlPlato, IMG_INGREDIENTE_GENERICO } from '../imagenes.js';
import { traducirCategoria } from '../traducciones.js';
import { NOMBRES_PAISES } from '../paises.js';
import { aviso } from '../dom.js';

// Ingredientes que están en casi todo: no sirven como pista ni como pregunta.
const TRIVIAL = /^(sal|pimienta|agua|aceite|hielo)( |$)/;
export const esTrivial = (nombre) => TRIVIAL.test(normalizar(nombre));

// "Huevo" y "huevos", "papa" y "papas" son lo mismo.
export const raiz = (nombre) => normalizar(nombre).split(' ')[0].replace(/(es|s)$/, '');

let promesa = null;

// Recetas con lo necesario para jugar: foto, país e ingredientes con imagen.
export function cargarDatos() {
  promesa ??= Promise.all([catalogo.todas().catch(() => []), casa.todas(), cargarIngredientes()])
    .then(([delCatalogo, deCasa, ingredientes]) => {
      const claves = new Map(ingredientes.map((i) => [i.normal, i.clave]));
      const usos = new Map();
      const recetas = [...deCasa, ...delCatalogo].map((r) => {
        const lista = r.nombresIngredientes
          ? r.nombresIngredientes.map((nombre) => {
            const clave = claves.get(normalizar(nombre));
            return { nombre, imagen: clave ? urlIngrediente(clave) : IMG_INGREDIENTE_GENERICO };
          })
          : (r.ingredientes || []).map((i) => ({ nombre: i.nombre, imagen: i.imagen }));
        for (const i of lista) usos.set(normalizar(i.nombre), (usos.get(normalizar(i.nombre)) || 0) + 1);
        return {
          id: r.id,
          nombre: r.nombre,
          categoria: r.categoria ? traducirCategoria(r.categoria) : '',
          origen: r.origen || '',
          imagen: r.imagen ? urlPlato(r.imagen, { miniatura: /themealdb\.com/.test(r.imagen) }) : '',
          imagenGrande: r.imagen || '',
          ingredientes: lista,
        };
      });
      for (const r of recetas) {
        for (const i of r.ingredientes) i.usos = usos.get(normalizar(i.nombre)) || 1;
      }
      // Ingredientes para usar como opciones falsas: conocidos y con foto.
      const vistos = new Set();
      const comunes = [];
      for (const r of recetas) {
        for (const i of r.ingredientes) {
          const n = normalizar(i.nombre);
          if (i.usos >= 5 && !esTrivial(i.nombre) && !vistos.has(n) && i.imagen !== IMG_INGREDIENTE_GENERICO) {
            vistos.add(n);
            comunes.push(i);
          }
        }
      }
      const paises = new Set(NOMBRES_PAISES);
      return { recetas, comunes, paisesConRecetas: [...new Set(recetas.map((r) => r.origen))].filter((p) => paises.has(p)) };
    })
    .catch((err) => { promesa = null; throw err; });
  return promesa;
}

// ---------- azar ----------

// Generador con semilla: el mismo número da siempre la misma secuencia
// (así el Plato del día es igual para todos).
export function azarConSemilla(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mezclar(lista, azar = Math.random) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export const elegir = (lista, azar = Math.random) => lista[Math.floor(azar() * lista.length)];

// Opciones falsas: ingredientes que no estén (ni parecidos) en la receta.
export function ingredientesFalsos(comunes, receta, cantidad, azar = Math.random) {
  const propias = new Set(receta.ingredientes.map((i) => raiz(i.nombre)));
  const elegidos = [];
  const usadas = new Set();
  for (const i of mezclar(comunes, azar)) {
    const r = raiz(i.nombre);
    if (propias.has(r) || usadas.has(r)) continue;
    usadas.add(r);
    elegidos.push(i);
    if (elegidos.length >= cantidad) break;
  }
  return elegidos;
}

// ---------- puntajes locales ----------

const CLAVE = 'recetario:juegos';

export function leerRecords() {
  try { return JSON.parse(localStorage.getItem(CLAVE) || '{}') || {}; } catch { return {}; }
}

export function guardarRecord(juego, puntos) {
  const records = leerRecords();
  const anterior = records[juego]?.mejor || 0;
  records[juego] = { mejor: Math.max(anterior, puntos), partidas: (records[juego]?.partidas || 0) + 1 };
  try { localStorage.setItem(CLAVE, JSON.stringify(records)); } catch { /* sin almacenamiento */ }
  return puntos > anterior;
}

// ---------- compartir ----------

export async function compartir(texto) {
  const url = `${location.origin}${location.pathname}#/juegos`;
  const completo = `${texto}\n${url}`;
  if (navigator.share) {
    try { await navigator.share({ text: completo }); return; } catch (err) { if (err?.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(completo);
    aviso('Resultado copiado: pegalo donde quieras 📋');
  } catch {
    window.open(`https://wa.me/?text=${encodeURIComponent(completo)}`, '_blank', 'noopener');
  }
}
