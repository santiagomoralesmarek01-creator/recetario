// Torneo de juegos con premio (ver supabase/torneo.sql). Con sesión iniciada,
// las partidas de "Adiviná el país", "¿Qué le falta?" y "Armá el plato" las
// arma y las corrige el servidor: la web sólo muestra cada ronda y manda la
// respuesta. Sin sesión, los juegos siguen funcionando como práctica.
import { cliente, hayBackend } from './supabase.js';
import { usuario } from './auth.js';

// Versión de las bases que acepta quien se inscribe (cambiarla si cambian las bases).
export const VERSION_BASES = '2026-10';

function errorLegible(error) {
  const m = `${error?.message || ''} ${error?.code || ''}`;
  if (/does not exist|42P01|42883|PGRST205|PGRST202|schema cache/i.test(m)) {
    return new Error('El torneo todavía no está activado (falta ejecutar supabase/torneo.sql en Supabase).');
  }
  if (/Failed to fetch|NetworkError|network/i.test(m)) return new Error('Se cortó la conexión. Probá de nuevo.');
  return new Error(error?.message || 'Error inesperado');
}

async function rpc(nombre, args) {
  const sb = await cliente();
  const { data, error } = await sb.rpc(nombre, args);
  if (error) throw errorLegible(error);
  return data;
}

// Un identificador al azar de este navegador: sirve para detectar varias
// cuentas jugando desde el mismo dispositivo (lo ven sólo los administradores).
function dispositivo() {
  try {
    let id = localStorage.getItem('amano:dispositivo');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('amano:dispositivo', id);
    }
    return id;
  } catch {
    return null;
  }
}

export const juegaEnServidor = () => hayBackend && Boolean(usuario());

// Partida armada por el servidor. ronda() pide la ronda en juego (y empieza a
// correr el tiempo); responder() manda la respuesta y devuelve el resultado.
export async function nuevaPartida(juego, modo) {
  const inicio = await rpc('partida_empezar', { p_juego: juego, p_modo: modo, p_dispositivo: dispositivo() });
  return {
    id: inicio.id,
    oficial: Boolean(inicio.oficial),
    total: inicio.total,
    ronda: () => rpc('partida_ronda', { p_id: inicio.id }),
    responder: (indice, respuesta) => rpc('partida_responder', { p_id: inicio.id, p_indice: indice, p_respuesta: respuesta }),
  };
}

export const estadoTorneo = () => rpc('torneo_estado', {});

export async function rankingTorneo(numero = null) {
  const filas = await rpc('torneo_ranking', { p_numero: numero });
  return (filas || []).map((f) => ({
    puesto: Number(f.puesto), userId: f.user_id, nombre: f.nombre, puntos: Number(f.puntos),
    partidas: Number(f.partidas), segundos: Number(f.segundos), habilitado: Boolean(f.habilitado), soyYo: Boolean(f.soy_yo),
  }));
}

export const inscribirme = () => rpc('torneo_inscribirme', { p_mayor: true, p_argentina: true, p_bases: VERSION_BASES });

export async function ganadores() {
  const sb = await cliente();
  const { data, error } = await sb.from('ganadores').select('tipo, periodo, nombre, user_id, receta_id, receta_nombre, monto, pagado, created_at')
    .order('created_at', { ascending: false }).limit(50);
  if (error) throw errorLegible(error);
  return data || [];
}

// Si la receta ganó la receta del mes: { periodo } (o null).
export async function premioDeReceta(recetaId) {
  if (!hayBackend || !String(recetaId).startsWith('u-')) return null;
  try {
    const sb = await cliente();
    const { data } = await sb.from('ganadores').select('periodo').eq('tipo', 'receta').eq('receta_id', recetaId).maybeSingle();
    return data || null;
  } catch {
    return null;
  }
}

// ---------- administración ----------

export const panelTorneo = (numero = null) => rpc('torneo_admin', { p_numero: numero });
export const candidatasRecetaDelMes = (mes) => rpc('receta_mes_candidatas', { p_mes: mes });

export async function registrarGanador(fila) {
  const sb = await cliente();
  const { error } = await sb.from('ganadores').upsert(fila, { onConflict: 'tipo,periodo' });
  if (error) throw errorLegible(error);
}

export async function marcarPagado(tipo, periodo, pagado) {
  const sb = await cliente();
  const { error } = await sb.from('ganadores').update({ pagado }).eq('tipo', tipo).eq('periodo', periodo);
  if (error) throw errorLegible(error);
}

// "del 5 al 18 de octubre"
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export function textoPeriodo(inicio, fin) {
  const [, m1, d1] = inicio.split('-').map(Number);
  const [, m2, d2] = fin.split('-').map(Number);
  return m1 === m2 ? `del ${d1} al ${d2} de ${MESES[m2 - 1]}` : `del ${d1} de ${MESES[m1 - 1]} al ${d2} de ${MESES[m2 - 1]}`;
}
// "lunes 5 de octubre"
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export function fechaLarga(iso) {
  const f = new Date(`${iso}T12:00:00Z`);
  return `${DIAS[f.getUTCDay()]} ${f.getUTCDate()} de ${MESES[f.getUTCMonth()]}`;
}
// Día siguiente a una fecha ISO.
export function diaSiguiente(iso) {
  const f = new Date(`${iso}T12:00:00Z`);
  f.setUTCDate(f.getUTCDate() + 1);
  return f.toISOString().slice(0, 10);
}
export const nombreMes = (mes) => { const [a, m] = mes.split('-').map(Number); return `${MESES[m - 1]} ${a}`; };

// Tiempo que falta hasta el cierre (fin del último día, hora de Argentina).
export function faltaParaCierre(fin) {
  const cierre = Date.parse(`${fin}T23:59:59-03:00`);
  const s = Math.max(0, Math.floor((cierre - Date.now()) / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d} día${d === 1 ? '' : 's'} y ${h} h` : `${h} h ${String(m).padStart(2, '0')} min`;
}

export const pesos = (n) => `$${Number(n).toLocaleString('es-AR')}`;
