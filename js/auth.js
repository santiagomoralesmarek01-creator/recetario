import { cliente, hayBackend } from './supabase.js';

let usuarioActual = null;
const oyentes = new Set();

export const usuario = () => usuarioActual;

export function nombreVisible(u = usuarioActual) {
  if (!u) return '';
  return u.user_metadata?.nombre || u.email?.split('@')[0] || 'Cocinero/a';
}

export function alCambiarSesion(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

function actualizar(u) {
  usuarioActual = u ?? null;
  oyentes.forEach((fn) => fn(usuarioActual));
}

export async function iniciarAuth() {
  if (!hayBackend) return;
  const sb = await cliente();
  const { data } = await sb.auth.getSession();
  actualizar(data.session?.user);
  sb.auth.onAuthStateChange((evento, sesion) => {
    actualizar(sesion?.user);
    // El enlace de "recuperar contraseña" abre la web con una sesión temporal.
    if (evento === 'PASSWORD_RECOVERY') location.hash = '#/nueva-clave';
  });
}

function mensajeError(error) {
  const m = error?.message || '';
  if (/invalid login credentials/i.test(m)) return 'Email o contraseña incorrectos.';
  if (/email not confirmed/i.test(m)) return 'Tenés que confirmar tu email antes de entrar (revisá tu casilla).';
  if (/already registered/i.test(m)) return 'Ya existe una cuenta con ese email.';
  if (/password should be at least/i.test(m)) return 'La contraseña debe tener al menos 6 caracteres.';
  if (/rate limit/i.test(m)) return 'Demasiados intentos. Esperá unos minutos.';
  return m || 'Ocurrió un error inesperado.';
}

export async function entrar(email, password) {
  const sb = await cliente();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(mensajeError(error));
  actualizar(data.user);
}

// Devuelve true si la cuenta quedó activa, false si hay que confirmar el email.
export async function registrarse(nombre, email, password) {
  const sb = await cliente();
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { nombre }, emailRedirectTo: location.origin + location.pathname },
  });
  if (error) throw new Error(mensajeError(error));
  if (data.session) actualizar(data.user);
  return Boolean(data.session);
}

export async function recuperarClave(email) {
  const sb = await cliente();
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: location.origin + location.pathname,
  });
  if (error) throw new Error(mensajeError(error));
}

export async function cambiarClave(password) {
  const sb = await cliente();
  const { error } = await sb.auth.updateUser({ password });
  if (error) throw new Error(mensajeError(error));
}

export async function salir() {
  const sb = await cliente();
  await sb.auth.signOut();
  actualizar(null);
}
