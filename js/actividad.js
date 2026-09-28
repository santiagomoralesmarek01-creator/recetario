// Me gusta, actividad (recetas cocinadas, partidas) y ranking, en Supabase.
// Ver supabase/esquema.sql: tablas me_gusta y actividad, y sus funciones.
import { cliente, hayBackend } from './supabase.js';
import { usuario } from './auth.js';

const oyentes = new Set();

// Avisa cuando cambió algo que puede dar una medalla.
export function alCambiarActividad(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}
const avisar = () => oyentes.forEach((fn) => { try { fn(); } catch (err) { console.warn(err); } });

function errorLegible(error) {
  const m = `${error?.message || ''} ${error?.code || ''}`;
  if (/does not exist|42P01|PGRST205|PGRST202|schema cache/i.test(m)) {
    return new Error('Falta actualizar la base de datos (ejecutar supabase/esquema.sql en Supabase).');
  }
  return error instanceof Error ? error : new Error(error?.message || 'Error inesperado');
}

// ---------- me gusta ----------

let misMeGustaPromesa = null;
let misMeGustaDe = null;

// Ids de las recetas que likeó el usuario (se pide una vez por sesión).
export function misMeGusta() {
  const u = usuario();
  if (!hayBackend || !u) return Promise.resolve(new Set());
  if (misMeGustaDe !== u.id) { misMeGustaPromesa = null; misMeGustaDe = u.id; }
  misMeGustaPromesa ??= cliente()
    .then((sb) => sb.from('me_gusta').select('receta_id').order('created_at', { ascending: false }))
    .then(({ data, error }) => {
      if (error) throw errorLegible(error);
      return new Set(data.map((f) => f.receta_id));
    })
    .catch((err) => { misMeGustaPromesa = null; throw err; });
  return misMeGustaPromesa;
}

// Cantidad de me gusta de varias recetas: Map id → cantidad.
export async function contarMeGusta(ids) {
  const conteo = new Map(ids.map((id) => [id, 0]));
  if (!hayBackend || !ids.length) return conteo;
  const sb = await cliente();
  const { data, error } = await sb.rpc('conteo_me_gusta', { ids });
  if (error) throw errorLegible(error);
  for (const f of data || []) conteo.set(f.receta_id, Number(f.cantidad));
  return conteo;
}

// Da o saca el me gusta. Devuelve true si quedó likeada.
export async function alternarMeGusta(recetaId) {
  const sb = await cliente();
  const mios = await misMeGusta();
  const tenia = mios.has(recetaId);
  const { error } = tenia
    ? await sb.from('me_gusta').delete().eq('receta_id', recetaId)
    : await sb.from('me_gusta').insert({ receta_id: recetaId });
  // Si ya estaba (otra pestaña), no es un error.
  if (error && error.code !== '23505') throw errorLegible(error);
  if (tenia) mios.delete(recetaId); else mios.add(recetaId);
  avisar();
  return !tenia;
}

// ---------- actividad ----------

// Registra algo que suma para las medallas. Sin sesión no hace nada.
// Devuelve true si se guardó (false si ya estaba o no hay sesión).
export async function registrarActividad(tipo, { detalle = null, puntos = 0, dia = null } = {}) {
  if (!hayBackend || !usuario()) return false;
  const sb = await cliente();
  const fila = { tipo, detalle, puntos: Math.max(0, Math.min(1000, Math.round(puntos))) };
  if (dia) fila.dia = dia;
  const { error } = await sb.from('actividad').insert(fila);
  if (error?.code === '23505') return false; // ya registrado (plato del día, receta cocinada)
  if (error) throw errorLegible(error);
  avisar();
  return true;
}

export async function misLogros() {
  if (!hayBackend || !usuario()) return null;
  const sb = await cliente();
  const { data, error } = await sb.rpc('mis_logros');
  if (error) throw errorLegible(error);
  return data;
}

// Ranking de la semana, general o de un país: los 5 primeros y el puesto
// propio con dos arriba y dos abajo. Si falta la función nueva en Supabase,
// usa la anterior (top 10, sin países).
export async function rankingSemanal(pais = null) {
  if (!hayBackend) return [];
  const sb = await cliente();
  const { data, error } = await sb.rpc('ranking_semanal_puestos', { p_pais: pais });
  if (!error) {
    return (data || []).map((f) => ({ puesto: Number(f.puesto), nombre: f.nombre, pais: f.pais, puntos: Number(f.puntos), soyYo: Boolean(f.soy_yo) }));
  }
  if (pais) throw errorLegible(error);
  const viejo = await sb.rpc('ranking_semanal');
  if (viejo.error) throw errorLegible(viejo.error);
  return (viejo.data || []).map((f, i) => ({ puesto: i + 1, nombre: f.nombre, puntos: Number(f.puntos), soyYo: Boolean(f.soy_yo) }));
}
