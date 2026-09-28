// Datos de recetas para las páginas que ve Google (api/pagina.js) y el
// sitemap (api/sitemap.js). Lee los mismos archivos que la web.
// El "_" del nombre hace que Vercel no lo publique como ruta.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const SITIO = (process.env.SITIO_URL || 'https://www.amanorecetas.com.ar').replace(/\/$/, '');

// Los mismos datos públicos que js/config.js (la anon key es pública por diseño).
const SUPABASE_URL = 'https://hvkytxfkiylbyaleihyw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3l0eGZraXlsYnlhbGVpaHl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNTA0MDAsImV4cCI6MjEwNTgyNjQwMH0.iJapf5vlTjG_K8QsjWWmP8qQcybD1Y7FXIwavP7d4_g';

// Igual que CATEGORIAS en js/traducciones.js.
export const CATEGORIAS = {
  Beef: 'Carne vacuna', Breakfast: 'Desayuno', Chicken: 'Pollo', Dessert: 'Postres', Goat: 'Cabra',
  Lamb: 'Cordero', Miscellaneous: 'Varios', Pasta: 'Pastas', Pork: 'Cerdo', Seafood: 'Pescados y mariscos',
  Side: 'Guarniciones', Starter: 'Entradas', Vegan: 'Veganas', Vegetarian: 'Vegetarianas',
};

// Igual que slug() y rutaReceta() de js/rutas.js: las direcciones tienen que coincidir.
export function slug(texto) {
  return String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ñ/g, 'n').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);
}
export function rutaReceta(id, nombre = '') {
  const s = String(id);
  if (s.startsWith('c-') || !nombre) return `/receta/${s}`;
  return `/receta/${s}-${slug(nombre)}`;
}
export function idDeRuta(parametro) {
  const p = String(parametro);
  const uuid = p.match(/^u-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (uuid) return uuid[0].toLowerCase();
  const numero = p.match(/^\d+(?=-|$)/);
  if (numero) return numero[0];
  return p;
}

const raiz = (...partes) => join(process.cwd(), ...partes);
const cache = new Map();
function leerJson(...partes) {
  const clave = partes.join('/');
  if (!cache.has(clave)) {
    try { cache.set(clave, JSON.parse(readFileSync(raiz(...partes), 'utf8'))); } catch { cache.set(clave, null); }
  }
  return cache.get(clave);
}

export function indexHtml() {
  if (!cache.has('index.html')) cache.set('index.html', readFileSync(raiz('index.html'), 'utf8'));
  return cache.get('index.html');
}

// Formato común: { id, nombre, descripcion, categoria, origen, imagen, porciones, minutos, ingredientes: [texto], pasos: [texto], etiquetas, autor }
export function recetasDeLaCasa() {
  return (leerJson('data', 'recetas-casa.json') || []).map((r) => ({
    id: `c-${r.slug}`,
    nombre: r.nombre,
    descripcion: r.descripcion || '',
    categoria: r.categoria || '',
    origen: r.origen || '',
    imagen: r.imagen || '',
    porciones: r.porciones,
    minutos: r.minutos,
    ingredientes: (r.ingredientes || []).map((i) => [i.medida, i.nombre].filter(Boolean).join(' ')),
    pasos: r.pasos || [],
    etiquetas: r.etiquetas || [],
  }));
}

export function indiceDelMundo() {
  const indice = leerJson('data', 'mealdb', 'indice.json');
  if (!indice) return [];
  const campos = indice.campos;
  return indice.recetas.map((fila) => Object.fromEntries(campos.map((c, i) => [c, fila[i]])));
}

function recetaDelMundo(id) {
  if (!/^\d+$/.test(id)) return null;
  const r = leerJson('data', 'mealdb', `${id}.json`);
  if (!r) return null;
  return {
    id: r.id,
    nombre: r.nombre,
    descripcion: '',
    categoria: r.categoria || '',
    origen: r.origen || '',
    imagen: r.imagen || '',
    ingredientes: (r.ingredientes || []).map(([nombre, medida]) => [medida, nombre].filter(Boolean).join(' ')),
    pasos: r.pasos || [],
    etiquetas: r.etiquetas || [],
  };
}

async function supabase(ruta) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    signal: AbortSignal.timeout(2000),
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}`);
  return r.json();
}

async function recetaDeLaComunidad(id) {
  const uuid = id.slice(2);
  const [f] = await supabase(`recetas?id=eq.${uuid}&publica=eq.true&select=id,nombre,descripcion,categoria,origen,porciones,minutos,imagen_url,ingredientes,pasos,autor_nombre`);
  if (!f) return null;
  return {
    id,
    nombre: f.nombre,
    descripcion: f.descripcion || '',
    categoria: f.categoria || '',
    origen: f.origen || '',
    imagen: f.imagen_url || '',
    porciones: f.porciones,
    minutos: f.minutos,
    ingredientes: (f.ingredientes || []).map((i) => [i.medida, i.nombre].filter(Boolean).join(' ')),
    pasos: f.pasos || [],
    etiquetas: [],
    autor: f.autor_nombre || '',
  };
}

// Foto cargada desde la web por un administrador (reemplaza la original).
async function fotoCargada(id) {
  try {
    const [f] = await supabase(`fotos_recetas?receta_id=eq.${encodeURIComponent(id)}&select=url`);
    return f?.url || '';
  } catch {
    return '';
  }
}

export async function buscarReceta(id) {
  let receta = null;
  if (id.startsWith('c-')) receta = recetasDeLaCasa().find((r) => r.id === id) || null;
  else if (id.startsWith('u-')) receta = await recetaDeLaComunidad(id).catch(() => null);
  else receta = recetaDelMundo(id);
  if (receta) receta.imagen = (await fotoCargada(id)) || receta.imagen;
  return receta;
}

export async function recetasPublicasDeLaComunidad() {
  try {
    return await supabase('recetas?publica=eq.true&select=id,nombre,updated_at&order=updated_at.desc&limit=1000');
  } catch {
    return [];
  }
}
