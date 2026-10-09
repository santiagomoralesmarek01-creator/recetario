// Prueba sin red del publicador de Instagram: simula Supabase (PostgREST) y
// la API de Instagram con un fetch falso y recorre todos los casos: imagen,
// carrusel, reel con portada, historia, idempotencia, reintentos, token,
// modo de prueba, tarea diaria y el secreto del endpoint. No publica nada.
//
//   node scripts/probar-redes.mjs
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { leerCalendario, isoEnZona } from './redes-calendario.mjs';

process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CRON_SECRET = 'secreto-de-prueba-0123456789';
process.env.RESEND_API_KEY = 'resend-de-prueba';
process.env.REDES_PAUSA_MS = '1';

const { publicarPendientes, probar, tareaDiaria, guardarToken, SUPABASE_URL } = await import('../api/_redes.js');
const { default: handler } = await import('../api/redes.js');

let fallos = 0;
async function caso(nombre, fn) {
  try { await fn(); console.log(`✔ ${nombre}`); } catch (err) { fallos++; console.log(`✘ ${nombre}\n  ${err.stack.split("\n").slice(0, 8).join('\n  ')}`); }
}

// ---------- calendario ----------
const CARPETA = 'docs/marca/instagram/semana-2-7-al-13-oct';
await caso('calendario: la semana 2 da 21 publicaciones bien armadas', () => {
  const nombres = readdirSync(CARPETA);
  const { calendario, avisos } = leerCalendario(readFileSync(`${CARPETA}/00-CALENDARIO-Y-TEXTOS.txt`, 'utf8'), nombres, { semana: 'semana-2', anio: 2026, soloPrueba: true });
  const p = calendario.publicaciones;
  assert.equal(p.length, 21);
  assert.deepEqual(avisos, []);
  const cuenta = (t) => p.filter((x) => x.tipo === t).length;
  assert.deepEqual([cuenta('historia'), cuenta('reel'), cuenta('carrusel'), cuenta('imagen')], [7, 7, 6, 1]);
  assert.equal(p.filter((x) => x.manual).length, 5);
  const chipa = p.find((x) => x.clave.includes('chipa'));
  assert.equal(chipa.fecha, '2026-10-07T17:00:00-03:00');
  assert.deepEqual(chipa.archivos, ['Mi07-chipa-1-portada.png', 'Mi07-chipa-2-ingredientes.png', 'Mi07-chipa-3-pasos.png', 'Mi07-chipa-4-secreto.png']);
  const reel = p.find((x) => x.clave.includes('guiso'));
  assert.equal(reel.portada, 'J08-reel-guiso-de-lentejas-portada.png');
  assert.match(reel.texto, /^Guiso de lentejas/);
  assert.doesNotMatch(reel.texto, /TikTok|#fyp/);
  assert.match(reel.tiktok, /#fyp/);
  assert.ok(p.every((x) => x.archivos.every((a) => nombres.includes(a))));
});
await caso('calendario: hora de Argentina en ISO', () => {
  assert.equal(isoEnZona('2026-12-31', '23:30'), '2026-12-31T23:30:00-03:00');
  assert.equal(new Date(isoEnZona('2026-10-07', '10:00')).toISOString(), '2026-10-07T13:00:00.000Z');
});

// ---------- simulador de Supabase + Instagram ----------
let filas, cred, contenedores, publicados, mails, renovaciones, fallas, llamadasPublicar, hosts;
let siguiente = 1000;

function reiniciar() {
  filas = []; contenedores = new Map(); publicados = []; mails = []; renovaciones = 0; fallas = {}; llamadasPublicar = 0; hosts = new Set();
  // Por defecto, como quedó la app: inicio de sesión con Facebook y token de página.
  cred = { red: 'instagram', token: 'EAA-pagina', modo: 'facebook', ig_user_id: '178', usuario: 'amanorecetas', cargado_en: new Date().toISOString(), vence_en: null };
}
const minutos = (m) => new Date(Date.now() + m * 60_000).toISOString();
function fila(d) {
  const f = { id: filas.length + 1, semana: 'prueba', archivos: ['prueba/a.jpg'], texto: 'Hola #amano', portada: null, nota: null, estado: 'pendiente',
    contenedor_id: null, hijos: null, ig_media_id: null, enlace: null, intentos: 0, proximo_intento: null, bloqueada_hasta: null,
    ultimo_error: null, avisado: false, prueba: null, ...d };
  filas.push(f);
  return f;
}
const json = (x, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'Content-Type': 'application/json' } });

function filtrar(lista, params) {
  return lista.filter((f) => [...params.entries()].every(([k, v]) => {
    if (['select', 'order'].includes(k)) return true;
    const [op, ...resto] = v.split('.');
    const valor = resto.join('.');
    if (op === 'eq') return String(f[k]) === valor;
    if (op === 'in') return valor.slice(1, -1).split(',').includes(String(f[k]));
    if (op === 'lt') return new Date(f[k]) < new Date(valor);
    if (op === 'gte') return new Date(f[k]) >= new Date(valor);
    throw new Error(`Filtro no simulado: ${k}=${v}`);
  }));
}

globalThis.fetch = async (direccion, opciones = {}) => {
  const url = new URL(direccion);
  const metodo = opciones.method || 'GET';
  const cuerpo = opciones.body instanceof URLSearchParams ? Object.fromEntries(opciones.body) : opciones.body ? JSON.parse(opciones.body) : {};

  if (url.origin === new URL(SUPABASE_URL).origin) {
    if (url.pathname.startsWith('/storage/v1/object/public/')) return new Response(null, { status: 200, headers: { 'content-type': 'image/jpeg', 'content-length': '2048' } });
    assert.equal(opciones.headers.apikey, 'service-role-de-prueba');
    const tabla = url.pathname.replace('/rest/v1/', '');
    if (tabla === 'rpc/redes_tomar') {
      const ahora = Date.now();
      const tomadas = filas.filter((f) => ['pendiente', 'procesando'].includes(f.estado) && new Date(f.fecha) <= ahora + 20 * 60_000
        && (!f.proximo_intento || new Date(f.proximo_intento) <= ahora) && (!f.bloqueada_hasta || new Date(f.bloqueada_hasta) < ahora))
        .sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(0, cuerpo.p_limite);
      for (const f of tomadas) f.bloqueada_hasta = minutos(4);
      return json(tomadas.map((f) => ({ ...f })));
    }
    if (metodo === 'POST' && tabla === 'redes_credenciales') { cred = { ...cred, ...cuerpo }; return new Response(null, { status: 201 }); }
    const lista = tabla === 'redes_credenciales' ? [cred] : filas;
    const elegidas = filtrar(lista, url.searchParams);
    if (metodo === 'PATCH') { for (const f of elegidas) Object.assign(f, cuerpo); return new Response(null, { status: 204 }); }
    return json(elegidas.map((f) => ({ ...f })));
  }

  if (url.origin === 'https://api.resend.com') { mails.push(cuerpo); return json({ id: 'mail' }); }

  if (url.origin === 'https://graph.instagram.com' || url.origin === 'https://graph.facebook.com') {
    hosts.add(url.origin);
    const token = url.searchParams.get('access_token') || cuerpo.access_token;
    if (url.pathname === '/refresh_access_token') { renovaciones++; return json({ access_token: `IGAA-${renovaciones + 1}`, expires_in: 5183944 }); }
    const ruta = url.pathname.replace('/v24.0/', '');
    if (ruta === 'oauth/access_token') {
      assert.equal(url.searchParams.get('client_secret'), 'secreto-app');
      return json({ access_token: 'EAA-usuario-largo', token_type: 'bearer', expires_in: 5183944 });
    }
    if (ruta === 'me/accounts') {
      assert.equal(token, 'EAA-usuario-largo');
      return json({ data: [
        { name: 'Otra página', access_token: 'EAA-otra', id: '1' },
        { name: 'A Mano', access_token: 'EAA-pagina-nueva', id: '2', instagram_business_account: { id: '178', username: 'amanorecetas' } },
      ] });
    }
    if (token === 'VENCIDO') return json({ error: { message: 'Error validating access token', code: 190 } }, 400);
    if (ruta === 'me' && url.origin === 'https://graph.instagram.com') return json({ user_id: '178', username: 'amanorecetas' });
    if (ruta === '178' && url.searchParams.get('fields') === 'id,username') return json({ id: '178', username: 'amanorecetas' });
    if (ruta === '178/content_publishing_limit') return json({ data: [{ quota_usage: publicados.length, config: { quota_total: 100 } }] });
    if (ruta === '178/media') {
      if (fallas.crear) { fallas.crear--; return json({ error: { message: 'Invalid parameter', code: 100 } }, 400); }
      const id = `C${siguiente++}`;
      const video = Boolean(cuerpo.video_url);
      contenedores.set(id, { params: cuerpo, pendientes: video ? 2 : 0, estado: 'IN_PROGRESS' });
      return json({ id });
    }
    if (ruta === '178/media_publish') {
      llamadasPublicar++;
      const c = contenedores.get(cuerpo.creation_id);
      assert.ok(c, 'publica un contenedor que existe');
      assert.notEqual(c.estado, 'PUBLISHED', 'no publica dos veces el mismo contenedor');
      c.estado = 'PUBLISHED';
      const media = `M${siguiente++}`;
      publicados.push({ media, ...c.params });
      if (fallas.perderRespuesta) { fallas.perderRespuesta--; throw new TypeError('fetch failed'); }
      return json({ id: media });
    }
    if (contenedores.has(ruta)) {
      const c = contenedores.get(ruta);
      if (c.estado === 'IN_PROGRESS') { if (c.pendientes > 0) c.pendientes--; else c.estado = 'FINISHED'; }
      return json({ status_code: c.estado, id: ruta });
    }
    if (/^M\d+$/.test(ruta)) return json({ permalink: `https://www.instagram.com/p/${ruta}/` });
  }
  throw new Error(`fetch no simulado: ${metodo} ${direccion}`);
};

// ---------- publicador ----------
await caso('publica imagen, carrusel, historia y reel con portada; prepara lo que viene y respeta lo que no va', async () => {
  reiniciar();
  const imagen = fila({ clave: 'imagen', tipo: 'imagen', fecha: minutos(-1) });
  const carrusel = fila({ clave: 'carrusel', tipo: 'carrusel', fecha: minutos(-2), archivos: ['p/1.jpg', 'p/2.jpg', 'p/3.jpg', 'p/4.jpg'] });
  const historia = fila({ clave: 'historia', tipo: 'historia', fecha: minutos(-3), texto: null });
  const reel = fila({ clave: 'reel', tipo: 'reel', fecha: minutos(-4), archivos: ['p/r.mp4'], portada: 'p/r-portada.jpg' });
  const futuro = fila({ clave: 'futuro', tipo: 'reel', fecha: minutos(10), archivos: ['p/f.mp4'] });
  const prueba = fila({ clave: 'prueba', tipo: 'imagen', fecha: minutos(-5), estado: 'solo_prueba' });
  const manual = fila({ clave: 'manual', tipo: 'historia', fecha: minutos(-5), estado: 'manual' });
  const pausada = fila({ clave: 'pausada', tipo: 'imagen', fecha: minutos(-5), estado: 'pausada' });
  const vieja = fila({ clave: 'vieja', tipo: 'imagen', fecha: minutos(-8 * 60) });

  const r = await publicarPendientes();
  assert.equal(r.tomadas, 5);
  for (const f of [imagen, carrusel, historia, reel]) {
    assert.equal(f.estado, 'publicada', f.clave);
    assert.match(f.ig_media_id, /^M/);
    assert.match(f.enlace, /instagram\.com/);
    assert.equal(f.bloqueada_hasta, null);
  }
  assert.equal(publicados.length, 4);
  const pub = (tipo) => publicados.find((p) => (p.media_type || 'IMAGE') === tipo);
  assert.equal(pub('IMAGE').caption, 'Hola #amano');
  assert.match(pub('IMAGE').image_url, /\/storage\/v1\/object\/public\/redes\/prueba\/a\.jpg$/);
  assert.equal(pub('CAROUSEL').children.split(',').length, 4);
  assert.deepEqual(carrusel.hijos, pub('CAROUSEL').children.split(','));
  assert.ok(carrusel.hijos.every((h) => contenedores.get(h).params.is_carousel_item === 'true'));
  assert.equal(pub('STORIES').caption, undefined);
  assert.match(pub('REELS').cover_url, /r-portada\.jpg$/);
  assert.equal(pub('REELS').share_to_feed, 'true');
  assert.equal(futuro.estado, 'pendiente', 'se toman 5 por corrida, por orden de fecha');
  assert.equal(vieja.estado, 'vencida');
  assert.equal(mails.length, 1);
  assert.match(mails[0].subject, /vencida/);
  assert.deepEqual(mails[0].to, ['amanorecetas@gmail.com']);
  assert.deepEqual([prueba.estado, manual.estado, pausada.estado], ['solo_prueba', 'manual', 'pausada']);
  assert.equal(cred.ig_user_id, '178');
  assert.ok(cred.ultima_corrida);
  assert.deepEqual([...hosts], ['https://graph.facebook.com'], 'con token de página publica en graph.facebook.com');

  // Segunda corrida: nada se repite y el reel que sale en 10 minutos ya queda preparado.
  await publicarPendientes();
  assert.equal(publicados.length, 4);
  assert.equal(futuro.estado, 'procesando');
  assert.ok(futuro.contenedor_id, 'el video del futuro ya quedó preparado');
  assert.equal(futuro.ig_media_id, null);
  // Llega la hora del reel preparado: se publica con el mismo contenedor.
  const contenedor = futuro.contenedor_id;
  futuro.fecha = minutos(-1);
  await publicarPendientes();
  assert.equal(futuro.estado, 'publicada');
  assert.equal(publicados.length, 5);
  assert.equal(contenedores.get(contenedor).estado, 'PUBLISHED');
});

await caso('idempotencia: si se pierde la respuesta de media_publish no se publica dos veces', async () => {
  reiniciar();
  const f = fila({ clave: 'perdida', tipo: 'imagen', fecha: minutos(-1) });
  fallas.perderRespuesta = 1;
  await publicarPendientes();
  assert.equal(publicados.length, 1, 'Instagram sí la publicó');
  assert.equal(f.estado, 'procesando');
  assert.equal(f.intentos, 1);
  assert.ok(new Date(f.proximo_intento) > Date.now(), 'espera antes de reintentar');
  f.proximo_intento = minutos(-1);
  await publicarPendientes();
  assert.equal(f.estado, 'publicada');
  assert.equal(publicados.length, 1, 'y no se volvió a publicar');
  assert.equal(llamadasPublicar, 1);
});

await caso('reintentos: 3 errores seguidos → estado error y un mail', async () => {
  reiniciar();
  const f = fila({ clave: 'falla', tipo: 'imagen', fecha: minutos(-1) });
  fallas.crear = 5;
  const esperas = [];
  for (let i = 0; i < 3; i++) {
    await publicarPendientes();
    if (f.proximo_intento) esperas.push(Math.round((new Date(f.proximo_intento) - Date.now()) / 60_000));
    f.proximo_intento = f.proximo_intento && minutos(-1);
  }
  assert.deepEqual(esperas, [5, 20]);
  assert.equal(f.estado, 'error');
  assert.equal(f.intentos, 3);
  assert.match(f.ultimo_error, /Invalid parameter/);
  assert.equal(mails.length, 1);
  assert.match(mails[0].subject, /No se pudo publicar/);
  await publicarPendientes();
  assert.equal(publicados.length, 0);
});

await caso('token rechazado: error enseguida, con aviso del token', async () => {
  reiniciar();
  cred.token = 'VENCIDO'; cred.ig_user_id = '178';
  const f = fila({ clave: 'token', tipo: 'imagen', fecha: minutos(-1) });
  await publicarPendientes();
  assert.equal(f.estado, 'error');
  assert.match(mails[0].text, /token/);
});

await caso('sin token cargado: no se publica, se avisa una sola vez', async () => {
  reiniciar();
  cred.token = null;
  const f = fila({ clave: 'sin-token', tipo: 'imagen', fecha: minutos(-1) });
  await publicarPendientes();
  await publicarPendientes();
  assert.equal(f.estado, 'pendiente');
  assert.equal(mails.length, 1);
});

await caso('modo de prueba: arma el contenedor y nunca publica', async () => {
  reiniciar();
  const f = fila({ clave: 'semana-2-reel', tipo: 'reel', fecha: minutos(-60 * 24), estado: 'solo_prueba', archivos: ['s2/r.mp4'], portada: 's2/p.jpg' });
  const c = fila({ clave: 'semana-2-carrusel', tipo: 'carrusel', fecha: minutos(-60), estado: 'solo_prueba', archivos: ['s2/1.jpg', 's2/2.jpg'] });
  const r1 = await probar(f.id);
  const r2 = await probar(c.id);
  assert.equal(r1.ok, true, JSON.stringify(r1));
  assert.equal(r1.estado, 'FINISHED');
  assert.equal(r2.ok, true);
  assert.equal(llamadasPublicar, 0);
  assert.equal(publicados.length, 0);
  assert.equal(f.estado, 'solo_prueba');
  assert.equal(f.contenedor_id, null, 'la prueba no deja contenedores para publicar');
  assert.ok(f.prueba.pasos.some((p) => /No se publicó nada/.test(p)));
  // Y el publicador real no toca las de "sólo prueba".
  await publicarPendientes();
  assert.equal(publicados.length, 0);
});

await caso('tarea diaria (inicio de sesión de Instagram): renueva el token, avisa las historias a mano y si el publicador no corre', async () => {
  reiniciar();
  Object.assign(cred, { token: 'IGAA-1', modo: 'instagram', vence_en: minutos(50 * 24 * 60), cargado_en: minutos(-8 * 24 * 60) });
  fila({ clave: 'hoy-manual', tipo: 'historia', fecha: minutos(1), estado: 'manual', nota: 'sticker de enlace a amanorecetas.com.ar/torneo' });
  fila({ clave: 'pendiente', tipo: 'imagen', fecha: minutos(60) });
  const r = await tareaDiaria();
  assert.equal(r.token, 'renovado');
  assert.equal(cred.token, 'IGAA-2');
  assert.ok(new Date(cred.vence_en) > Date.now() + 59 * 86400_000);
  assert.equal(mails.length, 1);
  assert.match(mails[0].text, /subir a mano/);
  assert.match(mails[0].text, /no corre/);
  // Al día siguiente no se vuelve a renovar.
  await tareaDiaria();
  assert.equal(renovaciones, 1);
});

await caso('tarea diaria: si la renovación falla, avisa por mail', async () => {
  reiniciar();
  Object.assign(cred, { token: 'VENCIDO', modo: 'instagram', vence_en: minutos(50 * 24 * 60), cargado_en: minutos(-8 * 24 * 60) });
  const orig = globalThis.fetch;
  globalThis.fetch = (u, o) => (String(u).includes('refresh_access_token')
    ? Promise.resolve(json({ error: { message: 'Session has expired', code: 190 } }, 400)) : orig(u, o));
  try { await tareaDiaria(); } finally { globalThis.fetch = orig; }
  assert.match(cred.ultimo_error, /expired/);
  assert.match(mails[0].text, /No se pudo renovar/);
});

await caso('tarea diaria (token de página): no renueva, comprueba que ande y avisa si dejó de andar', async () => {
  reiniciar();
  cred.cargado_en = minutos(-30 * 24 * 60);
  const r = await tareaDiaria();
  assert.equal(r.token, 'vigente (no vence)');
  assert.equal(renovaciones, 0);
  assert.equal(mails.length, 0);
  cred.token = 'VENCIDO';
  await tareaDiaria();
  assert.match(cred.ultimo_error, /validating access token/);
  assert.match(mails[0].text, /dejó de funcionar/);
});

await caso('cargar token de Facebook: lo cambia por el de la página con Instagram, que no vence', async () => {
  reiniciar();
  cred = null;
  await assert.rejects(guardarToken(`EAA${'x'.repeat(60)}`), /META_APP_ID/);
  process.env.META_APP_ID = '1410647951177080';
  process.env.META_APP_SECRET = 'secreto-app';
  const r = await guardarToken(`  EAA${'x'.repeat(60)}\n`);
  assert.deepEqual(r, { usuario: 'amanorecetas', modo: 'facebook', vence_en: null });
  assert.equal(cred.token, 'EAA-pagina-nueva', 'guarda el token de la página que tiene Instagram');
  assert.equal(cred.ig_user_id, '178');
  assert.equal(cred.vence_en, null);
  assert.ok(!JSON.stringify(r).includes('EAA'), 'el token no vuelve al navegador');
  await assert.rejects(guardarToken('corto'), /no parece válido/);
});

await caso('inicio de sesión de Instagram: guarda el token de 60 días y publica en graph.instagram.com', async () => {
  reiniciar();
  const r = await guardarToken(`IGAA${'x'.repeat(60)}`);
  assert.equal(r.modo, 'instagram');
  assert.equal(cred.ig_user_id, '178');
  assert.ok(new Date(cred.vence_en) > Date.now() + 59 * 86400_000);
  hosts.clear();
  const f = fila({ clave: 'ig', tipo: 'imagen', fecha: minutos(-1) });
  await publicarPendientes();
  assert.equal(f.estado, 'publicada');
  assert.deepEqual([...hosts], ['https://graph.instagram.com']);
});

await caso('endpoint: pide el secreto', async () => {
  reiniciar();
  const respuesta = () => { const r = { codigo: 0, cuerpo: null, status(c) { r.codigo = c; return r; }, setHeader() { return r; }, json(b) { r.cuerpo = b; return r; } }; return r; };
  const sin = respuesta();
  await handler({ query: { accion: 'publicar' }, headers: {}, method: 'POST' }, sin);
  assert.equal(sin.codigo, 401);
  const mal = respuesta();
  await handler({ query: { accion: 'publicar' }, headers: { authorization: 'Bearer otro-secreto-de-prueba-01' }, method: 'POST' }, mal);
  assert.equal(mal.codigo, 401);
  const bien = respuesta();
  await handler({ query: { accion: 'publicar' }, headers: { authorization: `Bearer ${process.env.CRON_SECRET}` }, method: 'POST' }, bien);
  assert.equal(bien.codigo, 200);
  assert.equal(bien.cuerpo.tomadas, 0);
});

console.log(fallos ? `\n${fallos} prueba(s) fallaron.` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
