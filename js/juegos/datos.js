// Datos y utilidades compartidas por los juegos.
import * as catalogo from '../catalogo.js';
import * as casa from '../recetasCasa.js';
import { cargarIngredientes, normalizar } from '../ingredientes.js';
import { urlIngrediente, urlPlato, IMG_INGREDIENTE_GENERICO } from '../imagenes.js';
import { traducirCategoria } from '../traducciones.js';
import { NOMBRES_PAISES, LATINOAMERICA } from '../paises.js';
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
          latina: LATINOAMERICA.has(r.origen),
          codigoCategoria: r.categoria || '',
          categoria: r.categoria ? traducirCategoria(r.categoria) : '',
          origen: r.origen || '',
          imagen: r.imagen ? urlPlato(r.imagen, { miniatura: /themealdb\.com/.test(r.imagen) }) : '',
          imagenGrande: r.imagen || '',
          pasos: r.pasos || [],
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

// ---------- dificultad de las partidas ----------

// Las partidas priorizan recetas latinoamericanas: en fácil son todas de
// Latinoamérica y en difícil se suma más cocina del resto del mundo.
export const MODOS = {
  facil: { nombre: 'Fácil', icono: '🟢', latinas: 1 },
  normal: { nombre: 'Normal', icono: '🟡', latinas: 0.7 },
  dificil: { nombre: 'Difícil', icono: '🔴', latinas: 0.35 },
};

// Elige recetas al azar respetando la proporción de latinoamericanas.
export function elegirRecetas(lista, cantidad, proporcionLatina) {
  const latinas = mezclar(lista.filter((r) => r.latina));
  const delMundo = mezclar(lista.filter((r) => !r.latina));
  const cuantasLatinas = Math.min(latinas.length, Math.round(cantidad * proporcionLatina));
  const elegidas = [...latinas.slice(0, cuantasLatinas), ...delMundo.slice(0, cantidad - cuantasLatinas)];
  // Si faltan de un lado, se completa con el otro.
  for (const r of [...latinas.slice(cuantasLatinas), ...delMundo]) {
    if (elegidas.length >= cantidad) break;
    if (!elegidas.includes(r)) elegidas.push(r);
  }
  return mezclar(elegidas);
}

const CLAVE_MODO = 'recetario:modo-juego';
export function modoGuardado(juego) {
  try { return JSON.parse(localStorage.getItem(CLAVE_MODO) || '{}')[juego] || 'normal'; } catch { return 'normal'; }
}
export function guardarModo(juego, modo) {
  try {
    const modos = JSON.parse(localStorage.getItem(CLAVE_MODO) || '{}');
    modos[juego] = modo;
    localStorage.setItem(CLAVE_MODO, JSON.stringify(modos));
  } catch { /* sin almacenamiento */ }
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

// Guarda el récord del juego y el de ese modo. Devuelve true si superó el récord del modo.
export function guardarRecord(juego, puntos, modo = null) {
  const records = leerRecords();
  const clave = modo ? `${juego}:${modo}` : juego;
  const anterior = records[clave]?.mejor || 0;
  records[juego] = { mejor: Math.max(records[juego]?.mejor || 0, puntos), partidas: (records[juego]?.partidas || 0) + 1 };
  if (modo) records[clave] = { mejor: Math.max(anterior, puntos), partidas: (records[clave]?.partidas || 0) + 1 };
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
