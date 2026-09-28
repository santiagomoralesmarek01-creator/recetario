// Fotos de recetas cargadas desde la web por los administradores (tabla
// fotos_recetas en Supabase). Reemplazan la imagen original de la receta.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { cliente, hayBackend } from './supabase.js';
import { usuario } from './auth.js';

const MAX_LADO = 1600;

// Achica la foto en el navegador antes de subirla: menos espera y menos espacio usado.
export async function reducirImagen(archivo) {
  if (!archivo.type.startsWith('image/') || archivo.type === 'image/gif') return archivo;
  try {
    const bitmap = await createImageBitmap(archivo);
    const escala = Math.min(1, MAX_LADO / Math.max(bitmap.width, bitmap.height));
    if (escala === 1 && archivo.size < 800_000) return archivo;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85));
    return blob ? new File([blob], 'foto.jpg', { type: 'image/jpeg' }) : archivo;
  } catch {
    return archivo;
  }
}

let fotosPromesa = null;

// Map receta_id → { url, credito }. Se pide directo a la API (sin esperar a
// que cargue la librería de Supabase) y si tarda o falla, se sigue sin fotos.
export function fotosDeRecetas() {
  if (!hayBackend) return Promise.resolve(new Map());
  fotosPromesa ??= Promise.race([
    fetch(`${SUPABASE_URL}/rest/v1/fotos_recetas?select=receta_id,url,credito`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    }).then((r) => (r.ok ? r.json() : [])),
    new Promise((listo) => setTimeout(() => listo([]), 3000)),
  ])
    .then((filas) => new Map(filas.map((f) => [f.receta_id, { url: f.url, credito: f.credito || '' }])))
    .catch(() => new Map());
  return fotosPromesa;
}

// Pone la foto cargada (si hay) en cada receta de la lista. Devuelve la misma lista.
export async function aplicarFotos(recetas) {
  const fotos = await fotosDeRecetas();
  if (!fotos.size) return recetas;
  for (const r of recetas) {
    const f = fotos.get(r.id);
    if (f) { r.imagen = f.url; r.creditoFoto = f.credito; r.fuenteFoto = ''; }
  }
  return recetas;
}

let adminDe = null;
let adminPromesa = null;

export function soyAdmin() {
  const u = usuario();
  if (!hayBackend || !u) return Promise.resolve(false);
  if (adminDe !== u.id) { adminDe = u.id; adminPromesa = null; }
  adminPromesa ??= cliente()
    .then((sb) => sb.from('administradores').select('user_id').eq('user_id', u.id).maybeSingle())
    .then(({ data }) => Boolean(data))
    .catch(() => false);
  return adminPromesa;
}

// Sube la foto (achicada) y la asigna a la receta. Devuelve la URL pública.
export async function guardarFoto(recetaId, archivo, credito = '') {
  const u = usuario();
  if (!u) throw new Error('Tenés que iniciar sesión.');
  const sb = await cliente();
  const foto = await reducirImagen(archivo);
  const ruta = `${u.id}/recetas/${recetaId}-${Date.now()}.jpg`;
  const subida = await sb.storage.from('fotos-recetas').upload(ruta, foto, { cacheControl: '31536000', contentType: foto.type });
  if (subida.error) throw new Error(subida.error.message);
  const url = sb.storage.from('fotos-recetas').getPublicUrl(ruta).data.publicUrl;
  const { error } = await sb.from('fotos_recetas').upsert({ receta_id: recetaId, url, credito: credito.trim() || null });
  if (error) {
    throw new Error(/row-level security|42501/.test(`${error.message} ${error.code}`)
      ? 'Tu cuenta no es administradora (ver README).'
      : /does not exist|PGRST205/.test(`${error.message} ${error.code}`)
        ? 'Falta ejecutar la última parte de supabase/esquema.sql.'
        : error.message);
  }
  // La próxima lectura trae la foto nueva.
  fotosPromesa = null;
  return url;
}
