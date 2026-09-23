import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const hayBackend = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let clientePromesa = null;

// Carga la librería sólo si hay backend configurado, así la web
// sigue andando aunque Supabase no esté configurado o no responda.
export function cliente() {
  if (!hayBackend) return Promise.resolve(null);
  clientePromesa ??= import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')
    .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY))
    .catch((err) => {
      clientePromesa = null;
      throw err;
    });
  return clientePromesa;
}
