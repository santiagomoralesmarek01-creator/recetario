// Cliente mínimo de la API de Instagram (Instagram API con inicio de sesión
// de Instagram, host graph.instagram.com). Sin dependencias: sólo fetch.
//
// Publicar es siempre en dos pasos: crear un "contenedor" con la URL pública
// del archivo y después publicarlo con media_publish.
//   https://developers.facebook.com/docs/instagram-platform/content-publishing

const HOST = 'https://graph.instagram.com';
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

async function llamar(metodo, ruta, parametros, token) {
  const url = new URL(`${HOST}/${version()}/${ruta}`);
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

export const yo = (token) => llamar('GET', 'me', { fields: 'user_id,username' }, token);

// Cuántas publicaciones quedan en las últimas 24 horas.
export async function cupo(igId, token) {
  const { data } = await llamar('GET', `${igId}/content_publishing_limit`, { fields: 'config,quota_usage' }, token);
  const d = data?.[0] || {};
  return { usadas: d.quota_usage ?? 0, total: d.config?.quota_total ?? null };
}

export const crearContenedor = (igId, parametros, token) => llamar('POST', `${igId}/media`, parametros, token).then((d) => d.id);

// status_code: EXPIRED, ERROR, FINISHED, IN_PROGRESS o PUBLISHED.
export const estadoContenedor = (id, token) => llamar('GET', id, { fields: 'status_code,status' }, token);

export const publicarContenedor = (igId, contenedorId, token) =>
  llamar('POST', `${igId}/media_publish`, { creation_id: contenedorId }, token).then((d) => d.id);

export const enlaceDe = (mediaId, token) =>
  llamar('GET', mediaId, { fields: 'permalink' }, token).then((d) => d.permalink).catch(() => null);

// Renueva un token de larga duración por otros 60 días. El token tiene que
// tener al menos 24 horas y no estar vencido.
export async function renovarToken(token) {
  const url = new URL(`${HOST}/refresh_access_token`);
  url.searchParams.set('grant_type', 'ig_refresh_token');
  url.searchParams.set('access_token', token);
  const r = await fetch(url, { signal: AbortSignal.timeout(25_000) });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok || datos.error) throw new ErrorInstagram(datos.error, r.status);
  return { token: datos.access_token, segundos: Number(datos.expires_in) || 60 * 24 * 3600 };
}
