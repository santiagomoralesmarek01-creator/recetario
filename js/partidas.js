// Partidas armadas y corregidas en el servidor (ver supabase/torneo.sql). Con
// sesión iniciada, "Adiviná el país", "¿Qué le falta?" y "Armá el plato" los
// arma y los corrige el servidor (así suman a las medallas): la web sólo
// muestra cada ronda y manda la respuesta. Sin sesión, se juegan en el navegador.
import { cliente, hayBackend } from './supabase.js';
import { usuario } from './auth.js';

function errorLegible(error) {
  const m = `${error?.message || ''} ${error?.code || ''}`;
  if (/does not exist|42P01|42883|PGRST205|PGRST202|schema cache/i.test(m)) {
    return new Error('Los juegos con cuenta todavía no están activados (falta ejecutar supabase/torneo.sql en Supabase).');
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
