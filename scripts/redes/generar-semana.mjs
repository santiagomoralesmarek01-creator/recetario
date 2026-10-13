// Genera las piezas de una semana de redes a partir de su contenido.json:
// láminas de carrusel, historias, imágenes del feed, reels MP4 (con portada)
// y el 00-CALENDARIO-Y-TEXTOS.txt con días, horas y textos. Al final arma el
// calendario.json que se sube en /admin/redes (ver docs/redes-instagram.md).
//
//   node scripts/redes/generar-semana.mjs docs/marca/instagram/semana-3-14-al-20-oct [--solo archivo]
//
// Necesita Chromium con Playwright (para dibujar las piezas) y ffmpeg (para
// los reels). Las tipografías de la marca se bajan de Google Fonts la primera
// vez y quedan en la carpeta temporal del sistema.
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, execSync } from 'node:child_process';
import {
  FEED, VERTICAL, carrusel, historiaTip, historiaPregunta, imagenNombres, imagenReemplazo, imagenFuncion,
  escenasReel, portadaReel, barraReel,
} from './plantillas.mjs';
import { leerCalendario } from '../redes-calendario.mjs';

const args = process.argv.slice(2);
const carpeta = args.find((a) => !a.startsWith('--'));
const solo = args.includes('--solo') ? args[args.indexOf('--solo') + 1] : null;
if (!carpeta) {
  console.error('Uso: node scripts/redes/generar-semana.mjs <carpeta-de-la-semana> [--solo archivo]');
  process.exit(1);
}
const contenido = JSON.parse(readFileSync(join(carpeta, 'contenido.json'), 'utf8'));
const paleta = Object.fromEntries([...readFileSync(new URL('../../css/estilos.css', import.meta.url), 'utf8')
  .matchAll(/--(maiz):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2]]));

// ---------- tipografías (Bricolage Grotesque, DM Sans, Fraunces) ----------
async function fuentes() {
  const cache = join(tmpdir(), 'amano-fuentes.css');
  if (existsSync(cache)) return readFileSync(cache, 'utf8');
  const url = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&family=Fraunces:ital,opsz,wght@1,9..144,400&display=block';
  const ua = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36' };
  let css = await (await fetch(url, { headers: ua })).text();
  for (const archivo of new Set(css.match(/https:\/\/fonts\.gstatic\.com[^)]+/g))) {
    const datos = Buffer.from(await (await fetch(archivo)).arrayBuffer()).toString('base64');
    css = css.split(archivo).join(`data:font/woff2;base64,${datos}`);
  }
  writeFileSync(cache, css);
  return css;
}

// ---------- Chromium ----------
async function navegador() {
  let pw;
  try { pw = await import('playwright'); } catch {
    pw = await import(join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'));
  }
  return pw.chromium.launch();
}

async function dibujar(nav, html, { ancho, alto }, destino) {
  const p = await nav.newPage({ viewport: { width: ancho, height: alto } });
  await p.setContent(html, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: destino, type: 'png' });
  await p.close();
}

// ---------- reels: escenas → MP4 con fundidos, barra de progreso y audio mudo ----------
function armarReel(escenas, destino, temporal) {
  const T = 0.35; // fundido entre escenas
  const total = escenas.reduce((s, e) => s + e.seg, 0) - T * (escenas.length - 1);
  const entradas = escenas.flatMap((e) => ['-loop', '1', '-framerate', '30', '-t', String(e.seg), '-i', e.archivo]);
  let filtro = '';
  let previo = '[0:v]';
  let desfase = 0;
  escenas.slice(1).forEach((e, i) => {
    desfase += escenas[i].seg - T;
    const salida = `[x${i}]`;
    filtro += `${previo}[${i + 1}:v]xfade=transition=fade:duration=${T}:offset=${desfase.toFixed(3)}${salida};`;
    previo = salida;
  });
  // Barra de progreso: una tira de color que entra de izquierda a derecha,
  // recortada al largo de la barra dibujada en cada escena.
  const { x, y, ancho, alto } = barraReel;
  const color = paleta.maiz.replace('#', '0x');
  filtro += `${previo}format=yuv420p,split[base][tira];[tira]crop=${ancho}:${alto}:${x}:${y}[tirac];`
    + `color=c=${color}:s=${ancho}x${alto}:r=30[barra];`
    + `[tirac][barra]overlay=x='-${ancho}+${ancho}*t/${total.toFixed(3)}':y=0:eval=frame:shortest=1[tiralista];`
    + `[base][tiralista]overlay=${x}:${y}:shortest=1,format=yuv420p[v]`;
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...entradas,
    '-f', 'lavfi', '-t', total.toFixed(3), '-i', 'anullsrc=r=44100:cl=stereo',
    '-filter_complex', filtro, '-map', '[v]', '-map', `${escenas.length}:a`,
    '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', '30', '-crf', '20',
    '-c:a', 'aac', '-b:a', '96k', '-t', total.toFixed(3), '-movflags', '+faststart', destino], { cwd: temporal });
  return total;
}

// ---------- calendario en texto (mismo formato que la semana 2) ----------
const DIAS = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
function calendarioTexto() {
  const linea = '='.repeat(64);
  const partes = [contenido.titulo, '='.repeat(contenido.titulo.length), ...contenido.intro, ''];
  for (const dia of contenido.dias) {
    const fecha = new Date(`${dia.fecha}T12:00:00Z`);
    partes.push('', linea, `${DIAS[fecha.getUTCDay()]} ${fecha.getUTCDate()}`, linea);
    for (const it of [...dia.items].sort((a, b) => a.hora.localeCompare(b.hora))) {
      if (it.clase === 'HISTORIA') {
        partes.push(`HISTORIA · ${it.archivo} · ${it.hora} · ${it.nota || 'sin sticker'}`, '');
      } else if (it.clase === 'REEL') {
        partes.push(`REEL · ${it.archivo}.mp4 (portada: ${it.archivo}-portada.png) · ${it.hora}`, 'Instagram:', it.texto, 'TikTok:', it.tiktok, '');
      } else {
        const que = it.plantilla === 'carrusel' ? `${it.archivo}-1 a 4` : it.archivo;
        partes.push(`PUBLICACIÓN · ${que} · ${it.hora}`, it.texto, '');
      }
    }
  }
  partes.push('', linea, 'DURANTE LA SEMANA (10 minutos por día, a mano)', linea, ...contenido.cierre);
  return `${partes.join('\n').replace(/\n{3,}/g, '\n\n')}\n`;
}

// ---------- principal ----------
const css = await fuentes();
const nav = await navegador();
const temporal = mkdtempSync(join(tmpdir(), 'amano-reel-'));
const hechos = [];
try {
  for (const dia of contenido.dias) {
    for (const it of dia.items) {
      if (solo && it.archivo !== solo) continue;
      const d = it.datos;
      if (it.clase === 'HISTORIA') {
        const html = it.plantilla === 'pregunta' ? historiaPregunta(d, css) : historiaTip(d, css);
        await dibujar(nav, html, VERTICAL, join(carpeta, `${it.archivo}.png`));
        hechos.push(`${it.archivo}.png`);
      } else if (it.clase === 'REEL') {
        const escenas = escenasReel(d, css);
        for (const [i, e] of escenas.entries()) {
          e.archivo = join(temporal, `${it.archivo}-${String(i).padStart(2, '0')}.png`);
          await dibujar(nav, e.html, VERTICAL, e.archivo);
        }
        const seg = armarReel(escenas, resolve(carpeta, `${it.archivo}.mp4`), temporal);
        await dibujar(nav, portadaReel(d, css), VERTICAL, join(carpeta, `${it.archivo}-portada.png`));
        hechos.push(`${it.archivo}.mp4 (${seg.toFixed(1)} s) + portada`);
      } else if (it.plantilla === 'carrusel') {
        const nombres = ['portada', 'ingredientes', 'pasos', 'secreto'];
        for (const [i, html] of carrusel(d, css).entries()) {
          await dibujar(nav, html, FEED, join(carpeta, `${it.archivo}-${i + 1}-${nombres[i]}.png`));
        }
        hechos.push(`${it.archivo}-1 a 4`);
      } else {
        const plantilla = { nombres: imagenNombres, reemplazo: imagenReemplazo, funcion: imagenFuncion }[it.plantilla];
        await dibujar(nav, plantilla(d, css), FEED, join(carpeta, `${it.archivo}.png`));
        hechos.push(`${it.archivo}.png`);
      }
      console.log(`✔ ${hechos.at(-1)}`);
    }
  }
} finally {
  await nav.close();
  rmSync(temporal, { recursive: true, force: true });
}

if (!solo) {
  const texto = calendarioTexto();
  writeFileSync(join(carpeta, '00-CALENDARIO-Y-TEXTOS.txt'), texto);
  const nombres = readdirSync(carpeta).filter((n) => /\.(png|jpe?g|mp4)$/i.test(n));
  const { calendario, avisos } = leerCalendario(texto, nombres, { semana: basename(carpeta.replace(/[\\/]+$/, '')), anio: Number(contenido.dias[0].fecha.slice(0, 4)) });
  writeFileSync(join(carpeta, 'calendario.json'), `${JSON.stringify(calendario, null, 2)}\n`);
  console.log(`\n${hechos.length} piezas · ${calendario.publicaciones.length} publicaciones en calendario.json`);
  if (avisos.length) { console.log('Revisar:'); for (const a of avisos) console.log(`  · ${a}`); }
}
