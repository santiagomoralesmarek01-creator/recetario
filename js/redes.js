// Datos del panel de redes (/admin/redes): calendario de Instagram, estado del
// token y carga de semanas. Todo pasa por las funciones de supabase/redes.sql,
// que controlan que quien llama sea administrador; el token nunca vuelve al
// navegador. El modo de prueba y la carga del token los hace api/redes.js con
// la sesión del administrador.
import { cliente } from './supabase.js';

const BUCKET = 'redes';

async function sb() {
  const c = await cliente();
  if (!c) throw new Error('No hay conexión con la base de datos.');
  return c;
}

function revisar({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

export async function publicaciones() {
  const c = await sb();
  return revisar(await c.from('publicaciones_redes').select('*').order('fecha'));
}

export async function estadoToken() {
  const c = await sb();
  const [fila] = revisar(await c.rpc('redes_estado_token')) || [];
  return fila || { hay_token: false };
}


export async function accion(id, cual, fecha = null) {
  const c = await sb();
  return revisar(await c.rpc('redes_admin', { p_id: id, p_accion: cual, p_fecha: fecha }));
}

// Llama a api/redes.js con la sesión del administrador.
async function api(accionApi, { metodo = 'GET', id, cuerpo } = {}) {
  const c = await sb();
  const { data } = await c.auth.getSession();
  const r = await fetch(`/api/redes?accion=${accionApi}${id ? `&id=${id}` : ''}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${data.session?.access_token || ''}`, ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const respuesta = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(respuesta.error || `Error ${r.status}`);
  return respuesta;
}
export const probar = (id) => api('probar', { metodo: 'POST', id });
export const cupo = () => api('estado');
// El servidor valida el token con Meta (y si es de Facebook lo cambia por el de
// la página, que no vence) y lo guarda. Devuelve { usuario, modo, vence_en }.
export const guardarToken = (token) => api('token', { metodo: 'POST', cuerpo: { token } });

export const urlPublica = (ruta, base) => `${base}/storage/v1/object/public/${BUCKET}/${ruta.split('/').map(encodeURIComponent).join('/')}`;

// PNG → JPG del mismo tamaño (Instagram sólo acepta JPEG).
async function aJpg(archivo) {
  const bitmap = await createImageBitmap(archivo);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // fondo para PNG con transparencia (no es un color de la interfaz)
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  const blob = await new Promise((listo) => canvas.toBlob(listo, 'image/jpeg', 0.92));
  if (!blob) throw new Error(`No se pudo convertir ${archivo.name}.`);
  return blob;
}

// Sube una semana: los archivos de la carpeta elegida + su calendario.json.
// avance(texto) informa cada paso. Devuelve cuántas publicaciones se cargaron.
export async function cargarSemana(archivos, avance = () => {}) {
  const porNombre = new Map([...archivos].map((a) => [a.name, a]));
  const json = porNombre.get('calendario.json');
  if (!json) throw new Error('En la carpeta no está calendario.json (generalo con scripts/redes-calendario.mjs).');
  const calendario = JSON.parse(await json.text());
  const semana = calendario.semana;
  if (!/^[A-Za-z0-9_.-]{1,80}$/.test(semana || '')) throw new Error('El calendario no tiene un nombre de semana válido.');
  const destino = (nombre) => `${semana}/${nombre.replace(/\.png$/i, '.jpg')}`;

  const nombres = [...new Set(calendario.publicaciones.flatMap((p) => [...p.archivos, p.portada].filter(Boolean)))];
  const faltan = nombres.filter((n) => !porNombre.has(n));
  if (faltan.length) throw new Error(`Faltan archivos en la carpeta: ${faltan.join(', ')}`);

  const c = await sb();
  let i = 0;
  for (const nombre of nombres) {
    avance(`Subiendo ${++i} de ${nombres.length}: ${nombre}`);
    const original = porNombre.get(nombre);
    const esVideo = /\.mp4$/i.test(nombre);
    if (original.size > 50 * 1024 * 1024) throw new Error(`${nombre} pesa más de 50 MB.`);
    const cuerpo = /\.png$/i.test(nombre) ? await aJpg(original) : original;
    revisar(await c.storage.from(BUCKET).upload(destino(nombre), cuerpo, {
      upsert: true, contentType: esVideo ? 'video/mp4' : 'image/jpeg', cacheControl: '3600',
    }));
  }
  avance('Cargando el calendario…');
  return revisar(await c.rpc('redes_cargar', {
    p: {
      semana,
      solo_prueba: Boolean(calendario.solo_prueba),
      publicaciones: calendario.publicaciones.map((p) => ({ ...p, archivos: p.archivos.map(destino), portada: p.portada ? destino(p.portada) : null })),
    },
  }));
}
