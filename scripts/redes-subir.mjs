// Sube los archivos de una semana de redes al bucket público "redes" de
// Supabase Storage y carga su calendario en la tabla publicaciones_redes.
// Hace lo mismo que "Cargar semana" en /admin/redes, desde la consola.
//
//   node scripts/redes-subir.mjs docs/marca/instagram/semana-3-… [--simulacro]
//
// · Antes: node scripts/redes-calendario.mjs <carpeta> (genera calendario.json).
// · Los PNG se convierten a JPG (Instagram sólo acepta JPEG) con ffmpeg, que
//   tiene que estar instalado (Windows: winget install ffmpeg).
// · Entra con tu cuenta de administrador de A Mano (email y contraseña; se
//   piden al correr o se toman de REDES_EMAIL / REDES_CLAVE). No usa la
//   service_role: los permisos los dan las políticas de supabase/redes.sql.
// · --simulacro: convierte y muestra qué subiría, sin conectarse a nada.
import { readFileSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline';

const SUPABASE_URL = 'https://hvkytxfkiylbyaleihyw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3l0eGZraXlsYnlhbGVpaHl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNTA0MDAsImV4cCI6MjEwNTgyNjQwMH0.iJapf5vlTjG_K8QsjWWmP8qQcybD1Y7FXIwavP7d4_g';
const MAX_BYTES = 50 * 1024 * 1024; // límite por archivo del plan gratis de Supabase

const args = process.argv.slice(2);
const carpeta = args.find((a) => !a.startsWith('--'));
const simulacro = args.includes('--simulacro');
if (!carpeta) {
  console.error('Uso: node scripts/redes-subir.mjs <carpeta-de-la-semana> [--simulacro]');
  process.exit(1);
}

const calendario = JSON.parse(readFileSync(join(carpeta, 'calendario.json'), 'utf8'));
const semana = calendario.semana || basename(carpeta.replace(/[\\/]+$/, ''));
if (!/^[A-Za-z0-9_.-]{1,80}$/.test(semana)) throw new Error(`Nombre de semana inválido: ${semana}`);

// Nombre con el que queda en el bucket: los PNG pasan a JPG.
const destino = (nombre) => `${semana}/${nombre.replace(/\.png$/i, '.jpg')}`;
const tipoDe = (nombre) => (/\.mp4$/i.test(nombre) ? 'video/mp4' : 'image/jpeg');

function preguntar(texto, oculto = false) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (oculto) rl._writeToOutput = (s) => rl.output.write(s.includes(texto) ? s : '');
  return new Promise((listo) => rl.question(texto, (r) => { rl.close(); if (oculto) process.stdout.write('\n'); listo(r.trim()); }));
}

async function entrar() {
  const email = process.env.REDES_EMAIL || await preguntar('Email de administrador: ');
  const password = process.env.REDES_CLAVE || await preguntar('Contraseña: ', true);
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`No se pudo entrar: ${d.error_description || d.msg || r.status}`);
  return d.access_token;
}

const archivos = [...new Set(calendario.publicaciones.flatMap((p) => [...p.archivos, p.portada].filter(Boolean)))];
const temporal = mkdtempSync(join(tmpdir(), 'redes-'));
try {
  // 1. Preparar (convertir a JPG y controlar tamaños).
  const listos = archivos.map((nombre) => {
    let ruta = join(carpeta, nombre);
    if (/\.png$/i.test(nombre)) {
      const jpg = join(temporal, nombre.replace(/\.png$/i, '.jpg'));
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', ruta, '-q:v', '2', jpg]);
      ruta = jpg;
    }
    const bytes = statSync(ruta).size;
    if (bytes > MAX_BYTES) throw new Error(`${nombre} pesa ${(bytes / 1048576).toFixed(1)} MB (máximo 50 MB).`);
    return { nombre, ruta, destino: destino(nombre), bytes };
  });
  for (const a of listos) console.log(`${a.destino.padEnd(70)} ${(a.bytes / 1024).toFixed(0).padStart(6)} KB`);

  const carga = {
    semana,
    solo_prueba: Boolean(calendario.solo_prueba),
    publicaciones: calendario.publicaciones.map((p) => ({ ...p, archivos: p.archivos.map(destino), portada: p.portada ? destino(p.portada) : null })),
  };
  if (simulacro) {
    console.log(`\nSimulacro: ${listos.length} archivos y ${carga.publicaciones.length} publicaciones${carga.solo_prueba ? ' (sólo prueba)' : ''}. No se subió nada.`);
    rmSync(temporal, { recursive: true, force: true });
    process.exit(0);
  }

  // 2. Subir.
  const jwt = await entrar();
  for (const a of listos) {
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/redes/${a.destino.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${jwt}`, 'Content-Type': tipoDe(a.nombre), 'x-upsert': 'true' },
      body: readFileSync(a.ruta),
    });
    if (!r.ok) throw new Error(`No se pudo subir ${a.nombre}: ${await r.text()}`);
    process.stdout.write('.');
  }

  // 3. Cargar el calendario.
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/redes_cargar`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p: carga }),
  });
  if (!r.ok) throw new Error(`No se pudo cargar el calendario: ${await r.text()}`);
  console.log(`\nListo: ${listos.length} archivos subidos y ${await r.json()} publicaciones cargadas${carga.solo_prueba ? ' en modo "sólo prueba"' : ''}.`);
  console.log('Revisalas en https://amanorecetas.com.ar/admin/redes');
} finally {
  rmSync(temporal, { recursive: true, force: true });
}
