// Cliente mínimo de la API de Instagram. Sin dependencias: sólo fetch.
//
// Funciona con los dos inicios de sesión que ofrece Meta:
//   · "facebook": la cuenta de Instagram está vinculada a una página de
//     Facebook; se publica en graph.facebook.com con el token de esa página
//     (no vence si sale de un token de usuario de larga duración).
//   · "instagram": inicio de sesión de Instagram, en graph.instagram.com, con
//     un token de 60 días que hay que renovar.
// Los pedidos para publicar son los mismos en los dos casos.
//
// Publicar es siempre en dos pasos: crear un "contenedor" con la URL pública
// del archivo y después publicarlo con media_publish.
//   https://developers.facebook.com/docs/instagram-platform/content-publishing

const HOSTS = { facebook: 'https://graph.facebook.com', instagram: 'https://graph.instagram.com' };
const version = () => process.env.IG_API_VERSION || 'v24.0';

// Error de la API con lo necesario para decidir si reintentar.
export class ErrorInstagram extends Error {
  constructor(error = {}, http = 0) {
    super(error.error_user_msg || error.message || `Error ${http} de Instagram`);
    this.codigo = error.code;
    this.subcodigo = error.error_subcode;
    this.http = http;
    this.transitorio = Boolean(error.is_transient) || http >= 500;
  }
  // Token vencido, revocado o sin permisos: reintentar no sirve.
  get deToken() { return this.codigo === 190 || this.codigo === 10 || this.codigo === 200; }
  // Demasiados pedidos o límite de publicaciones del día: esperar y volver.
  get deLimite() { return [4, 9, 17, 32, 613].includes(this.codigo) || this.subcodigo === 2207042; }
}

// acceso: { token, modo } (modo "facebook" o "instagram").
async function llamar(metodo, ruta, parametros, { token, modo = 'facebook' }) {
  const url = new URL(`${HOSTS[modo] || HOSTS.facebook}/${version()}/${ruta}`);
  const cuerpo = new URLSearchParams();
  for (const [k, v] of Object.entries(parametros || {})) {
    if (v == null) continue;
    (metodo === 'GET' ? url.searchParams : cuerpo).set(k, String(v));
  }
  (metodo === 'GET' ? url.searchParams : cuerpo).set('access_token', token);
  let r;
  try {
    r = await fetch(url, { method: metodo, body: metodo === 'GET' ? undefined : cuerpo, signal: AbortSignal.timeout(25_000) });
  } catch (err) {
    const e = new ErrorInstagram({ message: `Sin respuesta de Instagram (${err.name === 'TimeoutError' ? 'tardó demasiado' : err.message})` });
    e.transitorio = true;
    throw e;
  }
  const datos = await r.json().catch(() => ({}));
  if (!r.ok || datos.error) throw new ErrorInstagram(datos.error, r.status);
  return datos;
}

// Datos de la cuenta de Instagram ({ id, username }).
export async function cuentaDe(acceso, igId) {
  if (acceso.modo === 'instagram') {
    const d = await llamar('GET', 'me', { fields: 'user_id,username' }, acceso);
    return { id: String(d.user_id || d.id), username: d.username || null };
  }
  const d = await llamar('GET', igId, { fields: 'id,username' }, acceso);
  return { id: String(d.id), username: d.username || null };
}

// Cuántas publicaciones quedan en las últimas 24 horas.
export async function cupo(igId, acceso) {
  const { data } = await llamar('GET', `${igId}/content_publishing_limit`, { fields: 'config,quota_usage' }, acceso);
  const d = data?.[0] || {};
  return { usadas: d.quota_usage ?? 0, total: d.config?.quota_total ?? null };
}

export const crearContenedor = (igId, parametros, acceso) => llamar('POST', `${igId}/media`, parametros, acceso).then((d) => d.id);

// status_code: EXPIRED, ERROR, FINISHED, IN_PROGRESS o PUBLISHED.
export const estadoContenedor = (id, acceso) => llamar('GET', id, { fields: 'status_code,status' }, acceso);

export const publicarContenedor = (igId, contenedorId, acceso) =>
  llamar('POST', `${igId}/media_publish`, { creation_id: contenedorId }, acceso).then((d) => d.id);

export const enlaceDe = (mediaId, acceso) =>
  llamar('GET', mediaId, { fields: 'permalink' }, acceso).then((d) => d.permalink).catch(() => null);

// ---------- tokens ----------

async function pedir(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(25_000) });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok || datos.error) throw new ErrorInstagram(datos.error, r.status);
  return datos;
}

// Inicio de sesión de Instagram: renueva un token de larga duración por otros
// 60 días. El token tiene que tener al menos 24 horas y no estar vencido.
export async function renovarToken(token) {
  const url = new URL(`${HOSTS.instagram}/refresh_access_token`);
  url.searchParams.set('grant_type', 'ig_refresh_token');
  url.searchParams.set('access_token', token);
  const datos = await pedir(url);
  return { token: datos.access_token, segundos: Number(datos.expires_in) || 60 * 24 * 3600 };
}

// Inicio de sesión con Facebook: del token de usuario que da el Explorador de
// la API Graph (dura 1-2 horas) al token de la página vinculada a Instagram,
// que no vence. Pasos: token de usuario de larga duración (necesita el id y la
// clave secreta de la app) → /me/accounts → la página que tiene Instagram.
export async function tokenDePagina(tokenUsuario, preferido = '') {
  const idApp = process.env.META_APP_ID;
  const secreto = process.env.META_APP_SECRET;
  if (!idApp || !secreto) throw new Error('Faltan las variables META_APP_ID y META_APP_SECRET en Vercel.');
  const canje = new URL(`${HOSTS.facebook}/${version()}/oauth/access_token`);
  canje.searchParams.set('grant_type', 'fb_exchange_token');
  canje.searchParams.set('client_id', idApp);
  canje.searchParams.set('client_secret', secreto);
  canje.searchParams.set('fb_exchange_token', tokenUsuario);
  const { access_token: largo } = await pedir(canje);

  const cuentas = new URL(`${HOSTS.facebook}/${version()}/me/accounts`);
  cuentas.searchParams.set('fields', 'name,access_token,instagram_business_account{id,username}');
  cuentas.searchParams.set('access_token', largo);
  const { data = [] } = await pedir(cuentas);
  const conInstagram = data.filter((p) => p.instagram_business_account?.id);
  if (!conInstagram.length) {
    throw new Error(data.length
      ? `Ninguna de tus páginas (${data.map((p) => p.name).join(', ')}) tiene una cuenta de Instagram profesional vinculada, o falta darle permiso a la app al generar el token.`
      : 'El token no ve ninguna página de Facebook. Al generarlo, elegí la página de A Mano y la cuenta de Instagram.');
  }
  const pagina = conInstagram.find((p) => p.instagram_business_account.username === preferido) || conInstagram[0];
  return {
    token: pagina.access_token,
    pagina: pagina.name,
    igId: String(pagina.instagram_business_account.id),
    usuario: pagina.instagram_business_account.username || null,
  };
}
