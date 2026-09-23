// Recetas creadas por los usuarios, guardadas en Supabase (tabla "recetas").
// Las políticas RLS hacen que cada uno sólo pueda editar las suyas y que
// las marcadas como públicas las pueda ver cualquiera.
import { cliente } from './supabase.js';
import { normalizarIngredientesPropios } from './recetasCasa.js';

const TABLA = 'recetas';
const BUCKET = 'fotos-recetas';
const COLUMNAS_RESUMEN = 'id, nombre, categoria, origen, imagen_url, ingredientes, publica, autor_nombre, user_id';

export function normalizarFila(f) {
  return {
    id: `u-${f.id}`,
    uuid: f.id,
    origenDatos: 'usuario',
    nombre: f.nombre,
    categoria: f.categoria || '',
    origen: f.origen || '',
    descripcion: f.descripcion || '',
    porciones: f.porciones,
    minutos: f.minutos,
    imagen: f.imagen_url || '',
    etiquetas: [],
    ingredientes: normalizarIngredientesPropios(f.ingredientes || []),
    ingredientesCrudos: f.ingredientes || [],
    pasos: f.pasos || [],
    publica: f.publica,
    autor: f.autor_nombre || '',
    userId: f.user_id,
  };
}

async function consultar(armar) {
  const sb = await cliente();
  if (!sb) return [];
  const { data, error } = await armar(sb.from(TABLA));
  if (error) throw error;
  return (data || []).map(normalizarFila);
}

export function listarMias(userId) {
  return consultar((q) => q.select(COLUMNAS_RESUMEN).eq('user_id', userId).order('created_at', { ascending: false }));
}

export function listarPublicas(limite = 12) {
  return consultar((q) => q.select(COLUMNAS_RESUMEN).eq('publica', true).order('created_at', { ascending: false }).limit(limite));
}

// Devuelve las públicas y (por RLS) también las propias privadas.
export function buscar(texto) {
  const limpio = texto.replace(/[%_,()]/g, ' ').trim();
  if (!limpio) return Promise.resolve([]);
  return consultar((q) => q.select(COLUMNAS_RESUMEN).ilike('nombre', `%${limpio}%`).limit(30));
}

export function deCategoria(categoria) {
  return consultar((q) => q.select(COLUMNAS_RESUMEN).eq('categoria', categoria).limit(50));
}

export async function obtener(uuid) {
  const filas = await consultar((q) => q.select('*').eq('id', uuid).limit(1));
  return filas[0] || null;
}

export async function subirFoto(userId, archivo) {
  const sb = await cliente();
  const extension = (archivo.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const ruta = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await sb.storage.from(BUCKET).upload(ruta, archivo, {
    cacheControl: '31536000',
    contentType: archivo.type,
  });
  if (error) throw error;
  return sb.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl;
}

// Crea o actualiza (si trae uuid). Devuelve la receta guardada ya normalizada.
export async function guardar(datos, uuid = null) {
  const sb = await cliente();
  const consulta = uuid
    ? sb.from(TABLA).update(datos).eq('id', uuid)
    : sb.from(TABLA).insert(datos);
  const { data, error } = await consulta.select('*').single();
  if (error) throw error;
  return normalizarFila(data);
}

export async function borrar(uuid) {
  const sb = await cliente();
  const { error } = await sb.from(TABLA).delete().eq('id', uuid);
  if (error) throw error;
}
