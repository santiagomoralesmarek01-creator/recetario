// Cuentas oficiales (tabla cuentas_verificadas): llevan un tilde junto al
// nombre. Se pide una sola vez, directo a la API, sin frenar la página.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { hayBackend } from './supabase.js';
import { el } from './dom.js';
import { icono } from './iconos.js';

let promesa = null;

function verificadas() {
  if (!hayBackend) return Promise.resolve(new Set());
  promesa ??= fetch(`${SUPABASE_URL}/rest/v1/cuentas_verificadas?select=user_id`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  })
    .then((r) => (r.ok ? r.json() : []))
    .then((filas) => new Set(filas.map((f) => f.user_id)))
    .catch(() => new Set());
  return promesa;
}

// Tilde que aparece solo si la cuenta es oficial (se completa cuando llega la lista).
export function marcaVerificada(userId) {
  const marca = el('span', { class: 'verificada', hidden: true, title: 'Cuenta oficial de A Mano' },
    icono('tilde'), el('span', { class: 'solo-lectores' }, ' (cuenta oficial)'));
  if (userId) verificadas().then((s) => { if (s.has(userId)) marca.hidden = false; });
  return marca;
}
