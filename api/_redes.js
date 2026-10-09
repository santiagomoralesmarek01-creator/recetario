// Publicación automática en Instagram: toma del calendario (tabla
// publicaciones_redes de Supabase) lo que ya llegó a su hora y lo publica.
// La usa api/redes.js; el esquema está en supabase/redes.sql y la guía en
// docs/redes-instagram.md.
//
// Cada publicación avanza por pasos y guarda cada id apenas lo recibe, así una
// ejecución que se corta a la mitad sigue en la próxima sin repetir nada:
//   pendiente → (contenedor creado) procesando → (FINISHED) → publicada
// Antes de publicar se mira el estado del contenedor: si ya figura PUBLISHED
// (se publicó pero se perdió la respuesta) no se vuelve a publicar.
import * as ig from './_instagram.js';

// Los mismos datos públicos que js/config.js (la anon key es pública por diseño).
export const SUPABASE_URL = 'https://hvkytxfkiylbyaleihyw.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3l0eGZraXlsYnlhbGVpaHl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNTA0MDAsImV4cCI6MjEwNTgyNjQwMH0.iJapf5vlTjG_K8QsjWWmP8qQcybD1Y7FXIwavP7d4_g';
export const ZONA = 'America/Argentina/Buenos_Aires';
const BUCKET = 'redes';

const MAX_INTENTOS = 3;
const ESPERAS_MIN = [5, 20, 60];          // entre reintentos
const RENOVAR_CADA_DIAS = 7;              // el token dura 60; se renueva mucho antes
const AVISAR_SI_VENCE_EN_DIAS = 10;
const TIEMPO_MAX_MS = 45_000;             // margen antes del límite de la función
const tolerancia = () => Number(process.env.REDES_TOLERANCIA_HORAS || 6) * 3600_000;

// ---------- Supabase (con la service_role, sólo en el servidor) ----------

async function db(ruta, { metodo = 'GET', cuerpo, prefer } = {}) {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!clave) throw new Error('Falta la variable SUPABASE_SERVICE_ROLE_KEY en Vercel.');
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    method: metodo,
    headers: {
      // Las claves nuevas (sb_secret_…) van sólo en apikey; la service_role clásica (JWT), en los dos.
      apikey: clave, ...(clave.startsWith('sb_') ? {} : { Authorization: `Bearer ${clave}` }), 'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const texto = await r.text(); // 201/204 sin cuerpo al insertar o actualizar
  return texto ? JSON.parse(texto) : null;
}

const cambiar = (id, cambios) =>
  db(`publicaciones_redes?id=eq.${id}`, { metodo: 'PATCH', cuerpo: { ...cambios, actualizada_en: new Date().toISOString() } });

async function credenciales() {
  const [c] = await db('redes_credenciales?red=eq.instagram&select=*');
  return c || null;
}
const guardarCredenciales = (cambios) => db('redes_credenciales?red=eq.instagram', { metodo: 'PATCH', cuerpo: cambios });

// ¿El usuario de esta sesión de Supabase es administrador? (para el panel)
export async function esAdmin(jwt) {
  if (!jwt) return false;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${jwt}` }, signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!r?.ok) return false;
  const { id } = await r.json();
  if (!/^[0-9a-f-]{36}$/.test(id || '')) return false;
  const filas = await db(`administradores?user_id=eq.${id}&select=user_id`);
  return filas.length > 0;
}

export const urlPublica = (ruta) =>
  `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${ruta.split('/').map(encodeURIComponent).join('/')}`;

// ---------- avisos por mail (Resend, plan gratis) ----------

export async function avisar(asunto, texto) {
  const clave = process.env.RESEND_API_KEY;
  if (!clave) { console.warn(`[aviso sin mail] ${asunto}\n${texto}`); return false; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.AVISO_REMITENTE || 'A Mano <onboarding@resend.dev>',
      to: [process.env.AVISO_EMAIL || 'amanorecetas@gmail.com'],
      subject: `A Mano · ${asunto}`,
      text: `${texto}\n\nPanel: https://amanorecetas.com.ar/admin/redes`,
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch((err) => ({ ok: false, text: async () => err.message }));
  if (!r.ok) console.error('No se pudo mandar el aviso:', await r.text());
  return r.ok;
}

// ---------- token ----------

// Modo según el token: los del inicio de sesión de Instagram empiezan con "IG";
// los de Facebook (usuario o página), con "EAA".
export const modoDe = (token) => (/^IG/.test(token) ? 'instagram' : 'facebook');

async function cuenta() {
  const c = await credenciales();
  if (!c?.token) throw Object.assign(new Error('No hay token de Instagram cargado (cargalo en /admin/redes).'), { deToken: true });
  const acceso = { token: c.token, modo: c.modo || modoDe(c.token) };
  if (!c.ig_user_id) {
    if (acceso.modo !== 'instagram') throw new Error('Falta el id de la cuenta de Instagram: volvé a cargar el token desde el panel.');
    const yo = await ig.cuentaDe(acceso);
    c.ig_user_id = yo.id;
    c.usuario = yo.username;
    await guardarCredenciales({ ig_user_id: c.ig_user_id, usuario: c.usuario });
  }
  return { acceso, igId: c.ig_user_id, usuario: c.usuario };
}

// Guarda el token que se pega en el panel. Con Facebook, el token de usuario
// del Explorador de la API Graph se cambia por el de la página (que no vence);
// con Instagram, se guarda el de 60 días tal cual. Nunca se devuelve el token.
export async function guardarToken(pegado) {
  const token = String(pegado || '').trim();
  if (token.length < 50 || /\s/.test(token)) throw new Error('Ese token no parece válido.');
  const ahora = new Date().toISOString();
  let fila;
  if (modoDe(token) === 'instagram') {
    const yo = await ig.cuentaDe({ token, modo: 'instagram' });
    fila = { token, modo: 'instagram', ig_user_id: yo.id, usuario: yo.username, vence_en: new Date(Date.now() + 60 * 86400_000).toISOString() };
  } else {
    const p = await ig.tokenDePagina(token, process.env.IG_USUARIO || 'amanorecetas');
    fila = { token: p.token, modo: 'facebook', ig_user_id: p.igId, usuario: p.usuario, vence_en: null };
  }
  await db('redes_credenciales?on_conflict=red', {
    metodo: 'POST', prefer: 'resolution=merge-duplicates',
    cuerpo: { red: 'instagram', ...fila, cargado_en: ahora, ultimo_error: null, avisado_en: null },
  });
  return { usuario: fila.usuario, modo: fila.modo, vence_en: fila.vence_en };
}

// ---------- armado de contenedores ----------

const esVideo = (ruta) => /\.mp4$/i.test(ruta);

// Crea los contenedores de una publicación y devuelve el que se publica.
export async function crearContenedores(pub, { acceso, igId }) {
  const texto = pub.texto || undefined;
  const [primero] = pub.archivos;
  const crear = (p) => ig.crearContenedor(igId, p, acceso);
  switch (pub.tipo) {
    case 'imagen':
      return { contenedor: await crear({ image_url: urlPublica(primero), caption: texto }), hijos: null };
    case 'historia':
      return {
        contenedor: await crear(esVideo(primero)
          ? { media_type: 'STORIES', video_url: urlPublica(primero) }
          : { media_type: 'STORIES', image_url: urlPublica(primero) }),
        hijos: null,
      };
    case 'reel':
      return {
        contenedor: await crear({
          media_type: 'REELS', video_url: urlPublica(primero), caption: texto, share_to_feed: true,
          cover_url: pub.portada ? urlPublica(pub.portada) : undefined,
        }),
        hijos: null,
      };
    case 'carrusel': {
      if (pub.archivos.length < 2) throw new Error('Un carrusel necesita al menos 2 archivos.');
      const hijos = [];
      for (const a of pub.archivos) {
        hijos.push(await crear(esVideo(a)
          ? { media_type: 'VIDEO', video_url: urlPublica(a), is_carousel_item: true }
          : { image_url: urlPublica(a), is_carousel_item: true }));
      }
      // Los videos de un carrusel tienen que terminar de procesarse antes del padre.
      for (const h of hijos.filter((_, i) => esVideo(pub.archivos[i]))) await esperarContenedor(h, acceso, 30_000);
      return { contenedor: await crear({ media_type: 'CAROUSEL', children: hijos.join(','), caption: texto }), hijos };
    }
    default:
      throw new Error(`Tipo desconocido: ${pub.tipo}`);
  }
}

const pausa = (ms) => new Promise((listo) => setTimeout(listo, ms));

// Consulta el contenedor hasta que deja de estar IN_PROGRESS o se acaba el tiempo.
export async function esperarContenedor(id, acceso, hastaMs) {
  const limite = Date.now() + hastaMs;
  for (;;) {
    const e = await ig.estadoContenedor(id, acceso);
    if (e.status_code !== 'IN_PROGRESS' || Date.now() + 5000 > limite) return e;
    await pausa(Number(process.env.REDES_PAUSA_MS || 5000));
  }
}

// ---------- publicador ----------

async function registrarError(pub, err, extra = {}) {
  const mensaje = String(err.message || err).slice(0, 500);
  if (err.deLimite) {
    await cambiar(pub.id, { ...extra, proximo_intento: new Date(Date.now() + 3600_000).toISOString(), ultimo_error: mensaje, bloqueada_hasta: null });
    return 'esperando cupo';
  }
  const intentos = pub.intentos + 1;
  const final = err.deToken || intentos >= MAX_INTENTOS;
  await cambiar(pub.id, {
    ...extra,
    intentos,
    ultimo_error: mensaje,
    bloqueada_hasta: null,
    estado: final ? 'error' : pub.estado,
    proximo_intento: final ? null : new Date(Date.now() + ESPERAS_MIN[intentos - 1] * 60_000).toISOString(),
    avisado: final,
  });
  if (final) {
    await avisar(`No se pudo publicar "${pub.clave}"`,
      `La publicación ${pub.tipo} del ${fechaLocal(pub.fecha)} (${pub.clave}) quedó con error después de ${intentos} intento(s):\n\n${mensaje}\n\n`
      + (err.deToken ? 'Parece un problema del token: revisalo en el panel y volvé a cargarlo si hace falta.\n' : '')
      + 'Podés reintentarla o reprogramarla desde el panel.');
  }
  return final ? 'error' : 'reintento';
}

export const fechaLocal = (iso) => new Date(iso).toLocaleString('es-AR', {
  timeZone: ZONA, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
});

// Avanza una publicación todo lo que se pueda en esta ejecución.
async function avanzar(pub, ctx) {
  const ahora = Date.now();
  const hora = new Date(pub.fecha).getTime();
  if (pub.ig_media_id) { await cambiar(pub.id, { estado: 'publicada', bloqueada_hasta: null }); return 'publicada'; }

  // Si el disparador estuvo caído, no publicar de golpe cosas viejas.
  if (!pub.contenedor_id && ahora - hora > tolerancia()) {
    await cambiar(pub.id, { estado: 'vencida', bloqueada_hasta: null, avisado: true, ultimo_error: 'No salió a tiempo (el publicador no corrió a esa hora).' });
    await avisar(`Publicación vencida: ${pub.clave}`,
      `La publicación ${pub.tipo} del ${fechaLocal(pub.fecha)} no salió a tiempo y no se publicó para no llegar tarde.\nDesde el panel podés reprogramarla o marcarla como hecha.`);
    return 'vencida';
  }

  let contenedor = pub.contenedor_id;
  if (!contenedor) {
    const r = await crearContenedores(pub, ctx);
    contenedor = r.contenedor;
    await cambiar(pub.id, { estado: 'procesando', contenedor_id: contenedor, hijos: r.hijos });
    pub.estado = 'procesando';
  }

  const llego = hora <= ahora;
  const queda = TIEMPO_MAX_MS - (Date.now() - ctx.inicio);
  const estado = await esperarContenedor(contenedor, ctx.acceso, llego ? Math.max(0, Math.min(queda, 25_000)) : 0);
  switch (estado.status_code) {
    case 'PUBLISHED':
      // Se publicó en una ejecución anterior pero no llegamos a guardar el id.
      await cambiar(pub.id, { estado: 'publicada', publicada_en: new Date().toISOString(), bloqueada_hasta: null, ultimo_error: null, nota: [pub.nota, 'Publicada (no se pudo recuperar el enlace).'].filter(Boolean).join(' · ') });
      return 'publicada';
    case 'EXPIRED':
      await cambiar(pub.id, { contenedor_id: null, hijos: null, bloqueada_hasta: null });
      return 'contenedor vencido, se rearma';
    case 'ERROR':
      throw Object.assign(new Error(`Instagram no pudo procesar el archivo: ${estado.status || 'sin detalle'}`), { borrarContenedor: true });
    case 'FINISHED':
      break;
    default:
      await cambiar(pub.id, { bloqueada_hasta: null });
      return 'procesando video';
  }
  if (!llego) { await cambiar(pub.id, { bloqueada_hasta: null }); return 'lista, esperando la hora'; }

  ctx.cupo ??= await ig.cupo(ctx.igId, ctx.acceso).catch(() => ({ usadas: 0, total: null }));
  if (ctx.cupo.total != null && ctx.cupo.usadas >= ctx.cupo.total) {
    throw Object.assign(new Error(`Se llegó al límite de publicaciones de 24 horas (${ctx.cupo.usadas}/${ctx.cupo.total}).`), { deLimite: true });
  }
  const mediaId = await ig.publicarContenedor(ctx.igId, contenedor, ctx.acceso);
  // El id se guarda antes que nada: con eso ya no se puede publicar dos veces.
  await cambiar(pub.id, { estado: 'publicada', ig_media_id: mediaId, publicada_en: new Date().toISOString(), bloqueada_hasta: null, ultimo_error: null });
  ctx.cupo.usadas++;
  const enlace = await ig.enlaceDe(mediaId, ctx.acceso);
  if (enlace) await cambiar(pub.id, { enlace });
  return 'publicada';
}

// Lo que corre cada 10 minutos.
export async function publicarPendientes() {
  const inicio = Date.now();
  await guardarCredenciales({ ultima_corrida: new Date().toISOString() }).catch(() => {});
  const tomadas = await db('rpc/redes_tomar', { metodo: 'POST', cuerpo: { p_limite: 5 } });
  if (!tomadas.length) return { tomadas: 0, resultados: [] };

  let ctx;
  try {
    ctx = { ...(await cuenta()), inicio };
  } catch (err) {
    // Sin token (o token rechazado) no se puede nada: se liberan, se reintenta
    // en 10 minutos y se avisa como mucho cada 12 horas. Si no se arregla a
    // tiempo, cada publicación termina "vencida" con su propio aviso.
    for (const pub of tomadas) await cambiar(pub.id, { bloqueada_hasta: null, ultimo_error: err.message });
    const c = await credenciales().catch(() => null);
    if (!c?.avisado_en || Date.now() - new Date(c.avisado_en).getTime() > 12 * 3600_000) {
      await avisar('No se puede publicar en Instagram', `Hay publicaciones esperando y no se pudo usar la cuenta:\n\n${err.message}`);
      if (c) await guardarCredenciales({ avisado_en: new Date().toISOString() });
    }
    return { tomadas: tomadas.length, error: err.message };
  }

  const resultados = [];
  for (const pub of tomadas) {
    if (Date.now() - inicio > TIEMPO_MAX_MS) {
      await cambiar(pub.id, { bloqueada_hasta: null });
      resultados.push({ clave: pub.clave, resultado: 'queda para la próxima' });
      continue;
    }
    try {
      resultados.push({ clave: pub.clave, resultado: await avanzar(pub, ctx) });
    } catch (err) {
      const extra = err.borrarContenedor ? { contenedor_id: null, hijos: null } : {};
      resultados.push({ clave: pub.clave, resultado: await registrarError(pub, err, extra), error: err.message });
    }
  }
  return { tomadas: tomadas.length, resultados };
}

// ---------- modo de prueba ----------
// Arma los contenedores de verdad (Instagram descarga los archivos y procesa
// los videos) pero NUNCA llama a media_publish. Los contenedores sin publicar
// vencen solos a las 24 horas. El resultado queda en la columna "prueba".
export async function probar(id) {
  const [pub] = await db(`publicaciones_redes?id=eq.${Number(id)}&select=*`);
  if (!pub) throw new Error('No existe esa publicación.');
  if (pub.estado === 'publicada') throw new Error('Ya está publicada.');
  const inicio = Date.now();
  const resultado = { en: new Date().toISOString(), ok: false, pasos: [] };
  try {
    const ctx = await cuenta();
    resultado.pasos.push(`Cuenta: @${ctx.usuario || ctx.igId}`);
    for (const ruta of [...pub.archivos, pub.portada].filter(Boolean)) {
      const r = await fetch(urlPublica(ruta), { method: 'HEAD', signal: AbortSignal.timeout(10_000) });
      if (!r.ok) throw new Error(`El archivo ${ruta} no está en el bucket (HTTP ${r.status}).`);
      resultado.pasos.push(`Archivo OK: ${ruta} (${r.headers.get('content-type')}, ${Math.round(Number(r.headers.get('content-length') || 0) / 1024)} KB)`);
    }
    const c = await cupo(ctx);
    resultado.pasos.push(`Cupo de 24 h: ${c.usadas} de ${c.total ?? '?'} usadas`);
    const { contenedor, hijos } = await crearContenedores(pub, ctx);
    resultado.contenedor = contenedor;
    resultado.pasos.push(`Contenedor creado: ${contenedor}${hijos ? ` (láminas: ${hijos.join(', ')})` : ''}`);
    const e = await esperarContenedor(contenedor, ctx.acceso, Math.max(0, 50_000 - (Date.now() - inicio)));
    resultado.estado = e.status_code;
    resultado.pasos.push(`Estado del contenedor: ${e.status_code}${e.status ? ` (${e.status})` : ''}`);
    resultado.ok = e.status_code === 'FINISHED' || e.status_code === 'IN_PROGRESS';
    if (e.status_code === 'IN_PROGRESS') resultado.pasos.push('El video sigue procesándose; para la prueba alcanza con que Instagram lo haya aceptado.');
    resultado.pasos.push('No se publicó nada (modo de prueba).');
  } catch (err) {
    resultado.error = err.message;
  }
  await cambiar(pub.id, { prueba: resultado });
  return resultado;
}

const cupo = (ctx) => ig.cupo(ctx.igId, ctx.acceso);

// ---------- tarea diaria (Vercel Cron, una vez por día) ----------
// Renueva el token, revisa que el disparador esté corriendo y manda por mail
// lo que hay que subir a mano hoy.
export async function tareaDiaria() {
  const avisos = [];
  const informe = {};
  const c = await credenciales();
  if (!c?.token) {
    avisos.push('No hay token de Instagram cargado: no se puede publicar nada. Cargalo en el panel.');
  } else if ((c.modo || modoDe(c.token)) === 'facebook') {
    // El token de página no vence, pero se invalida si cambiás la contraseña de
    // Facebook o le sacás el permiso a la app: se comprueba que siga andando.
    try {
      await ig.cuentaDe({ token: c.token, modo: 'facebook' }, c.ig_user_id);
      informe.token = 'vigente (no vence)';
      if (c.ultimo_error) await guardarCredenciales({ ultimo_error: null });
    } catch (err) {
      await guardarCredenciales({ ultimo_error: `Token: ${err.message}` });
      avisos.push(`El token de Instagram dejó de funcionar: ${err.message}\nGenerá uno nuevo en el Explorador de la API Graph y cargalo en el panel.`);
      informe.token = `error: ${err.message}`;
    }
  } else {
    const edad = Date.now() - new Date(c.cargado_en || 0).getTime();
    if (edad > RENOVAR_CADA_DIAS * 86400_000) {
      try {
        const nuevo = await ig.renovarToken(c.token);
        await guardarCredenciales({
          token: nuevo.token, cargado_en: new Date().toISOString(),
          vence_en: new Date(Date.now() + nuevo.segundos * 1000).toISOString(), ultimo_error: null,
        });
        informe.token = 'renovado';
        c.vence_en = new Date(Date.now() + nuevo.segundos * 1000).toISOString();
      } catch (err) {
        await guardarCredenciales({ ultimo_error: `Renovación: ${err.message}` });
        avisos.push(`No se pudo renovar el token de Instagram: ${err.message}`);
        informe.token = `error: ${err.message}`;
      }
    } else {
      informe.token = 'vigente';
    }
    const dias = (new Date(c.vence_en).getTime() - Date.now()) / 86400_000;
    if (dias < AVISAR_SI_VENCE_EN_DIAS) {
      avisos.push(`El token de Instagram vence en ${Math.max(0, Math.floor(dias))} día(s). Si no se renueva solo, generá uno nuevo en Meta for Developers y cargalo en el panel.`);
    }
  }

  // ¿Está corriendo pg_cron? (sólo importa si hay algo por publicar)
  const proximas = await db(`publicaciones_redes?estado=in.(pendiente,procesando)&fecha=lt.${new Date(Date.now() + 2 * 86400_000).toISOString()}&select=id`);
  const corrida = c?.ultima_corrida ? new Date(c.ultima_corrida).getTime() : 0;
  if (proximas.length && Date.now() - corrida > 3600_000) {
    avisos.push(`El publicador no corre desde ${corrida ? fechaLocal(c.ultima_corrida) : 'nunca'} y hay ${proximas.length} publicación(es) en los próximos 2 días. Revisá la tarea "redes-publicar" de pg_cron en Supabase.`);
  }

  // Historias que van a mano hoy (las del sticker de enlace).
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: ZONA });
  const manuales = (await db(`publicaciones_redes?estado=eq.manual&fecha=gte.${new Date(Date.now() - 86400_000).toISOString()}&fecha=lt.${new Date(Date.now() + 2 * 86400_000).toISOString()}&select=*&order=fecha`))
    .filter((p) => new Date(p.fecha).toLocaleDateString('en-CA', { timeZone: ZONA }) === hoy);
  if (manuales.length) {
    avisos.push(`Hoy hay que subir a mano ${manuales.length} historia(s):\n${manuales.map((p) =>
      `• ${new Date(p.fecha).toLocaleTimeString('es-AR', { timeZone: ZONA, hour: '2-digit', minute: '2-digit' })} · ${p.nota || p.clave}\n  ${p.archivos.map(urlPublica).join('\n  ')}`).join('\n')}`);
  }
  informe.manuales = manuales.length;

  if (avisos.length) {
    informe.mail = await avisar(manuales.length && avisos.length === 1 ? 'Historias para subir hoy' : 'Avisos de Instagram', avisos.join('\n\n'));
  }
  informe.avisos = avisos;
  return informe;
}

export async function resumen() {
  const c = await credenciales();
  const r = { token: Boolean(c?.token), modo: c?.modo || null, usuario: c?.usuario || null, vence_en: c?.vence_en || null, ultima_corrida: c?.ultima_corrida || null };
  if (c?.token) {
    try { r.cupo = await cupo(await cuenta()); } catch (err) { r.error = err.message; }
  }
  return r;
}
