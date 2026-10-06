// Manitas, el asistente de cocina: función de Vercel que recibe la charla desde la web,
// comprueba la sesión de Supabase y el límite diario, y le pregunta a la IA:
// primero Groq (gratis y rápido) y, si no puede, Gemini (también gratis).
//
// Variables de entorno (Vercel → Settings → Environment Variables):
//   GEMINI_API_KEY  clave gratuita de Google AI Studio
//   GROQ_API_KEY    clave gratuita de console.groq.com (respaldo)
//   GEMINI_MODELO / GROQ_MODELO  opcionales; si no, se prueban las listas de abajo
// Hace falta al menos una de las dos claves. Nunca van en el código ni llegan al navegador.
//
// Abrir /api/ayudante en el navegador muestra si la configuración funciona.

import { instrucciones, limpiarPais, TRATOS_VALIDOS } from './_manitas.js';

// Los mismos datos públicos que js/config.js (la anon key es pública por diseño).
const SUPABASE_URL = 'https://hvkytxfkiylbyaleihyw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3l0eGZraXlsYnlhbGVpaHl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNTA0MDAsImV4cCI6MjEwNTgyNjQwMH0.iJapf5vlTjG_K8QsjWWmP8qQcybD1Y7FXIwavP7d4_g';

// Cada modelo tiene su propio cupo gratis y su propia demanda: si uno está
// saturado o agotado, se prueba el siguiente.
const MODELOS = [...new Set([
  process.env.GEMINI_MODELO, 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-flash-lite-latest', 'gemini-2.5-flash-lite', 'gemini-2.0-flash',
].filter(Boolean))];
const API_GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODELOS_GROQ = [...new Set([
  process.env.GROQ_MODELO, 'llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'llama-3.1-8b-instant',
].filter(Boolean))];
const API_GROQ = 'https://api.groq.com/openai/v1';
const TIEMPO_MAXIMO = 25000; // ms para todo el pedido
const ESPERA_POR_INTENTO = 12000; // ms máximos por modelo de Gemini
const ESPERA_GROQ = 9000; // Groq suele tardar 1-2 s; si pasa esto, está trabado
const LIMITE_DIARIO = 40;
const MAX_MENSAJES = 20;
const MAX_LARGO_MENSAJE = 1500;
const MAX_LARGO_RECETA = 6000;
const MAX_CANDIDATAS = 12;

// El modelo que funcionó la última vez (se reutiliza mientras la función siga viva).
let modeloQueAnda = null;
let modeloGroqQueAnda = null;

// Valida la lista de recetas candidatas que manda el navegador.
function limpiarCandidatas(lista) {
  if (!Array.isArray(lista)) return [];
  return lista.slice(0, MAX_CANDIDATAS)
    .filter((c) => c && typeof c.id === 'string' && /^[\w-]{1,80}$/.test(c.id) && typeof c.nombre === 'string')
    .map((c) => ({
      id: c.id,
      nombre: c.nombre.replace(/[\n\r\[\]]/g, ' ').slice(0, 120),
      detalle: typeof c.detalle === 'string' ? c.detalle.replace(/[\n\r\[\]]/g, ' ').slice(0, 80) : '',
    }));
}

// Pone primero el modelo que anduvo la última vez.
const ordenar = (lista, preferido) => (preferido ? [preferido, ...lista.filter((m) => m !== preferido)] : lista);

function responder(res, estado, cuerpo) {
  res.status(estado).setHeader('Cache-Control', 'no-store').json(cuerpo);
}

// Valida la charla que manda el navegador: alterna usuario/ayudante y termina en el usuario.
function limpiarMensajes(mensajes) {
  if (!Array.isArray(mensajes) || !mensajes.length) return null;
  const recientes = mensajes.slice(-MAX_MENSAJES);
  while (recientes.length && recientes[0].rol !== 'usuario') recientes.shift();
  const limpios = [];
  for (const m of recientes) {
    if (!m || (m.rol !== 'usuario' && m.rol !== 'ayudante') || typeof m.texto !== 'string') return null;
    const texto = m.texto.trim().slice(0, MAX_LARGO_MENSAJE);
    if (!texto) return null;
    const rol = m.rol === 'usuario' ? 'user' : 'model';
    if (limpios.length && limpios[limpios.length - 1].role === rol) return null;
    limpios.push({ role: rol, parts: [{ text: texto }] });
  }
  if (!limpios.length || limpios[limpios.length - 1].role !== 'user') return null;
  return limpios;
}

// Suma un mensaje al contador del día. La función de la base usa la sesión
// del token, así que esto también comprueba que el usuario esté logueado.
async function contarUso(token) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/usar_ayudante`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  if (r.status === 401 || r.status === 403) return { error: 401 };
  if (r.status === 404) return { error: 'sin-tabla' };
  if (!r.ok) return { error: 500, detalle: `Supabase ${r.status}: ${(await r.text()).slice(0, 200)}` };
  return { usados: Number(await r.json()) };
}

// Traduce un error de Google a algo entendible.
async function errorDeGemini(r) {
  let mensaje = '';
  try { mensaje = (await r.json()).error?.message || ''; } catch { /* sin cuerpo */ }
  const detalle = `Gemini ${r.status}: ${mensaje.slice(0, 200)}`;
  if (r.status === 429 || r.status >= 500) return { error: 'ocupado', detalle };
  if (/api key|api_key|permission|unauthori[sz]ed/i.test(mensaje) || r.status === 401 || r.status === 403) {
    return { error: 'clave', detalle };
  }
  if (r.status === 404 || /not found|not supported/i.test(mensaje)) return { error: 'modelo', detalle };
  if (/location|region|country/i.test(mensaje)) return { error: 'region', detalle };
  return { error: 'falla', detalle };
}

// fetch con tiempo máximo: no más de maxMs ni pasado el límite total del pedido.
// Devuelve null si se cortó por tiempo.
async function pedir(url, opciones, limite, maxMs) {
  const ms = Math.min(maxMs, limite - Date.now());
  if (ms < 1000) return null;
  try {
    return await fetch(url, { ...opciones, signal: AbortSignal.timeout(ms) });
  } catch (err) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') return null;
    throw err;
  }
}

async function llamarModelo(modelo, cuerpo, limite) {
  const r = await pedir(`${API_GEMINI}/${encodeURIComponent(modelo)}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  }, limite, ESPERA_POR_INTENTO);
  if (!r) return { error: 'ocupado', detalle: 'Gemini no respondió a tiempo' };
  if (!r.ok) return errorDeGemini(r);
  const datos = await r.json();
  const candidato = datos.candidates?.[0];
  const texto = (candidato?.content?.parts || [])
    .filter((p) => typeof p.text === 'string' && !p.thought)
    .map((p) => p.text)
    .join('')
    .trim();
  if (!texto) {
    const motivo = datos.promptFeedback?.blockReason || candidato?.finishReason;
    return { error: motivo && motivo !== 'MAX_TOKENS' ? 'bloqueado' : 'falla', detalle: `Gemini sin texto (${motivo || 'vacío'})` };
  }
  return { texto };
}

// Si hay otro proveedor disponible no vale la pena esperar para reintentar Gemini.
async function preguntarAGemini(contenidos, sistema, limite, { reintentar = true } = {}) {
  const cuerpo = {
    systemInstruction: { parts: [{ text: sistema }] },
    contents: contenidos,
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
  };
  // Si un modelo no existe (Google los renombra seguido), está saturado o se
  // quedó sin cupo, se prueba el siguiente.
  const candidatos = ordenar(MODELOS, modeloQueAnda);
  let peor = null;
  const intentos = [];
  // Dos vueltas: la saturación suele durar segundos, así que se espera un poco
  // y se reintentan los modelos que existen.
  for (let vuelta = 0; vuelta < (reintentar ? 2 : 1); vuelta++) {
    if (vuelta) {
      if (limite - Date.now() < 6000) break;
      await new Promise((listo) => setTimeout(listo, 2000));
    }
    for (const modelo of candidatos) {
      if (vuelta && intentos.some((i) => i.modelo === modelo && i.error === 'modelo')) continue;
      if (limite - Date.now() < 1000) break;
      const resultado = await llamarModelo(modelo, cuerpo, limite);
      if (resultado.error !== 'modelo' && resultado.error !== 'ocupado') {
        if (!resultado.error || resultado.error === 'bloqueado') modeloQueAnda = modelo;
        return resultado;
      }
      intentos.push({ modelo, error: resultado.error, detalle: resultado.detalle });
      // Si alguno existía pero estaba saturado, ese es el motivo a informar.
      if (!peor || resultado.error === 'ocupado') peor = resultado;
    }
    if (!intentos.some((i) => i.error === 'ocupado')) break;
  }
  if (!peor) return { error: 'ocupado', detalle: 'Gemini: sin tiempo para probar' };
  // Resumen corto: el último código de cada modelo y el mensaje de Google una sola vez.
  const porModelo = new Map(intentos.map((i) => [i.modelo, (i.detalle.match(/Gemini (\d+)/) || [])[1] || i.error]));
  const resumen = [...porModelo].map(([m, codigo]) => `${m} ${codigo}`).join(' · ');
  return { ...peor, detalle: `${resumen} — ${peor.detalle}` };
}

// ---------- Groq (respaldo, API compatible con OpenAI) ----------

async function errorDeGroq(r) {
  let error = {};
  try { error = (await r.json()).error || {}; } catch { /* sin cuerpo */ }
  const mensaje = String(error.message || '');
  const detalle = `Groq ${r.status}: ${mensaje.slice(0, 160)}`;
  if (r.status === 401 || r.status === 403 || error.code === 'invalid_api_key') return { error: 'clave', detalle };
  if (r.status === 404 || /model_not_found|decommissioned|does not exist/i.test(`${error.code} ${mensaje}`)) {
    return { error: 'modelo', detalle };
  }
  if (r.status === 429 || r.status === 413 || r.status >= 500) return { error: 'ocupado', detalle };
  return { error: 'falla', detalle };
}

async function preguntarAGroq(contenidos, sistema, limite) {
  const mensajes = [
    { role: 'system', content: sistema },
    ...contenidos.map((c) => ({ role: c.role === 'model' ? 'assistant' : 'user', content: c.parts[0].text })),
  ];
  let peor = null;
  for (const modelo of ordenar(MODELOS_GROQ, modeloGroqQueAnda)) {
    if (limite - Date.now() < 1000) break;
    const r = await pedir(`${API_GROQ}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelo, messages: mensajes, temperature: 0.7, max_tokens: 1500 }),
    }, limite, ESPERA_GROQ);
    // Si Groq no contesta a tiempo, se pasa directo a Gemini en vez de probar otro modelo.
    if (!r) return { error: 'ocupado', detalle: `${modelo}: Groq no respondió a tiempo` };
    const resultado = r.ok ? await leerGroq(r) : await errorDeGroq(r);
    if (resultado.error === 'modelo' || resultado.error === 'ocupado') {
      if (!peor || resultado.error === 'ocupado') peor = { ...resultado, detalle: `${modelo}: ${resultado.detalle}` };
      continue;
    }
    if (!resultado.error) modeloGroqQueAnda = modelo;
    return resultado;
  }
  return peor || { error: 'ocupado', detalle: 'Groq: sin tiempo para probar' };
}

async function leerGroq(r) {
  const datos = await r.json();
  const texto = String(datos.choices?.[0]?.message?.content || '').trim();
  return texto ? { texto } : { error: 'falla', detalle: `Groq sin texto (${datos.choices?.[0]?.finish_reason || 'vacío'})` };
}

// Groq primero porque suele contestar en uno o dos segundos; si no puede,
// Gemini. Todo el pedido tiene un tiempo máximo para no dejar esperando.
async function preguntar(contenidos, sistema) {
  const limite = Date.now() + TIEMPO_MAXIMO;
  const hayGroq = Boolean(process.env.GROQ_API_KEY);
  const proveedores = [
    hayGroq && (() => preguntarAGroq(contenidos, sistema, limite)),
    process.env.GEMINI_API_KEY && (() => preguntarAGemini(contenidos, sistema, limite, { reintentar: !hayGroq })),
  ].filter(Boolean);
  const fallas = [];
  for (const proveedor of proveedores) {
    const resultado = await proveedor();
    if (!resultado.error || resultado.error === 'bloqueado') return resultado;
    fallas.push(resultado);
  }
  // Un problema de configuración (clave o modelo) se informa antes que la saturación.
  const principal = fallas.find((f) => f.error === 'clave') || fallas.find((f) => f.error === 'modelo') || fallas[0];
  return { error: principal.error, detalle: fallas.map((f) => f.detalle).join(' | ') };
}

// GET /api/ayudante: diagnóstico sin gastar mensajes (no muestra la clave).
async function diagnostico(res) {
  const estado = { claveCargada: Boolean(process.env.GEMINI_API_KEY), modelos: {} };
  if (estado.claveCargada) {
    for (const modelo of MODELOS) {
      const r = await fetch(`${API_GEMINI}/${encodeURIComponent(modelo)}`, {
        headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY },
      });
      estado.modelos[modelo] = r.ok ? 'ok' : (await errorDeGemini(r)).detalle;
    }
  }
  estado.groq = { claveCargada: Boolean(process.env.GROQ_API_KEY), modelos: {} };
  if (estado.groq.claveCargada) {
    const r = await fetch(`${API_GROQ}/models`, { headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` } });
    if (r.ok) {
      const disponibles = new Set(((await r.json()).data || []).map((m) => m.id));
      for (const modelo of MODELOS_GROQ) estado.groq.modelos[modelo] = disponibles.has(modelo) ? 'ok' : 'no disponible';
    } else {
      estado.groq.error = (await errorDeGroq(r)).detalle;
    }
  }
  const algunoAnda = Object.values(estado.modelos).includes('ok') || Object.values(estado.groq.modelos).includes('ok');
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/usar_ayudante`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: '{}',
  });
  // Sin sesión tiene que rechazar (401/403); 404 significa que falta ejecutar el SQL.
  estado.supabase = r.status === 404 ? 'falta ejecutar supabase/esquema.sql' : 'ok';
  estado.listo = algunoAnda && estado.supabase === 'ok';
  return responder(res, 200, estado);
}

const MENSAJES_ERROR = {
  ocupado: [503, 'Manitas tiene mucha demanda en este momento. Probá en un rato.'],
  clave: [503, 'Una clave de la IA no es válida. Revisá GEMINI_API_KEY / GROQ_API_KEY en Vercel.'],
  modelo: [503, 'El modelo de IA no está disponible. Revisá GEMINI_MODELO / GROQ_MODELO en Vercel.'],
  region: [503, 'La IA no está disponible desde la región del servidor.'],
  falla: [502, 'El ayudante no pudo responder. Probá de nuevo.'],
};

async function atender(req, res) {
  if (req.method === 'GET') return diagnostico(res);
  if (req.method !== 'POST') return responder(res, 405, { error: 'Método no permitido.' });
  if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) {
    return responder(res, 503, { error: 'El ayudante todavía no está configurado (falta GEMINI_API_KEY o GROQ_API_KEY en Vercel).' });
  }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return responder(res, 401, { error: 'Iniciá sesión para usar el ayudante.' });

  let cuerpo = req.body || {};
  if (typeof cuerpo === 'string') {
    try { cuerpo = JSON.parse(cuerpo); } catch { cuerpo = {}; }
  }
  const contenidos = limpiarMensajes(cuerpo.mensajes);
  if (!contenidos) return responder(res, 400, { error: 'El mensaje no es válido.' });
  const receta = typeof cuerpo.receta === 'string' ? cuerpo.receta.slice(0, MAX_LARGO_RECETA) : '';
  const candidatas = limpiarCandidatas(cuerpo.candidatas);
  const pais = limpiarPais(cuerpo.pais);
  const trato = TRATOS_VALIDOS.includes(cuerpo.trato) ? cuerpo.trato : 'neutro';

  const uso = await contarUso(token);
  if (uso.error === 401) return responder(res, 401, { error: 'Tu sesión venció. Volvé a entrar.' });
  if (uso.error === 'sin-tabla') {
    return responder(res, 503, { error: 'El ayudante todavía no está configurado (falta ejecutar el SQL en Supabase).' });
  }
  if (uso.error) return responder(res, 502, { error: 'No se pudo verificar tu cuenta. Probá de nuevo.', detalle: uso.detalle });
  if (uso.usados > LIMITE_DIARIO) {
    return responder(res, 429, { error: `Llegaste al límite de ${LIMITE_DIARIO} mensajes por hoy. Mañana seguimos.` });
  }

  const respuesta = await preguntar(contenidos, instrucciones({ receta, candidatas, pais, trato }));
  if (respuesta.error === 'bloqueado') {
    return responder(res, 200, { texto: 'Con eso no puedo ayudar. Con alguna receta, sí.' });
  }
  if (respuesta.error) {
    console.error('Ayudante:', respuesta.detalle);
    const [estado, error] = MENSAJES_ERROR[respuesta.error] || MENSAJES_ERROR.falla;
    return responder(res, estado, { error, detalle: respuesta.detalle });
  }
  return responder(res, 200, { texto: respuesta.texto, restantes: Math.max(0, LIMITE_DIARIO - uso.usados) });
}

export default async function handler(req, res) {
  try {
    await atender(req, res);
  } catch (err) {
    console.error('Ayudante: error inesperado', err);
    responder(res, 500, { error: 'El ayudante no pudo responder. Probá de nuevo.', detalle: String(err?.message || err).slice(0, 200) });
  }
}
