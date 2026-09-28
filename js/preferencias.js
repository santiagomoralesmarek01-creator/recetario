// Preferencias de cada persona: trato (neutro, vos o tú) y país.
// Se guardan en el dispositivo (localStorage) y, con sesión, también en
// Supabase (tabla perfiles) para que sigan en otro celular o computadora.
import { cliente, hayBackend } from './supabase.js';
import { usuario, alCambiarSesion } from './auth.js';
import { trato, TRATOS } from './textos.js';
import { paisDelUsuario, CLAVE_PAIS } from './paises.js';

const CLAVE_TRATO = 'amano:trato';
export const EVENTO = 'amano:preferencias';

export function preferencias() {
  let pais = '';
  try { pais = localStorage.getItem(CLAVE_PAIS) || ''; } catch { /* sin almacenamiento */ }
  return { trato: trato(), pais, paisDetectado: paisDelUsuario() };
}

function guardarLocal({ trato: nuevoTrato, pais }) {
  try {
    if (nuevoTrato in TRATOS) localStorage.setItem(CLAVE_TRATO, nuevoTrato);
    if (pais !== undefined) {
      if (pais) localStorage.setItem(CLAVE_PAIS, pais);
      else localStorage.removeItem(CLAVE_PAIS);
    }
  } catch { /* sin almacenamiento */ }
}

const avisarCambio = () => window.dispatchEvent(new CustomEvent(EVENTO));

// Guarda y avisa para redibujar. Devuelve false si no se pudo guardar en la cuenta.
export async function guardarPreferencias(cambios) {
  guardarLocal(cambios);
  avisarCambio();
  const u = usuario();
  if (!hayBackend || !u) return true;
  try {
    const sb = await cliente();
    const { trato: tr, pais } = preferencias();
    const { error } = await sb.from('perfiles').upsert({ user_id: u.id, trato: tr, pais: pais || null, updated_at: new Date().toISOString() });
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('No se pudieron guardar las preferencias en la cuenta:', err.message);
    return false;
  }
}

// Al entrar, trae las preferencias guardadas en la cuenta.
async function traerDeLaCuenta(u) {
  try {
    const sb = await cliente();
    const { data, error } = await sb.from('perfiles').select('trato, pais').eq('user_id', u.id).maybeSingle();
    if (error || !data || usuario()?.id !== u.id) return;
    const antes = preferencias();
    guardarLocal({ trato: data.trato, pais: data.pais || '' });
    const ahora = preferencias();
    if (antes.trato !== ahora.trato || antes.pais !== ahora.pais) avisarCambio();
  } catch { /* sin tabla todavía o sin conexión: quedan las del dispositivo */ }
}

export function iniciarPreferencias() {
  if (!hayBackend) return;
  let ultimo = null;
  alCambiarSesion((u) => {
    if (u && u.id !== ultimo) traerDeLaCuenta(u);
    ultimo = u?.id ?? null;
  });
}
