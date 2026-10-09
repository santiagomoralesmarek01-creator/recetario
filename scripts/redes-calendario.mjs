// Convierte el 00-CALENDARIO-Y-TEXTOS.txt de una semana de redes en
// calendario.json, el formato que entiende el publicador automático.
//
//   node scripts/redes-calendario.mjs docs/marca/instagram/semana-2-7-al-13-oct [--anio 2026] [--solo-prueba]
//
// Entiende el formato de la semana 2 en adelante: bloques por día
// ("MIÉRCOLES 7") con líneas "HISTORIA · archivo · 10:00 · nota",
// "REEL · archivo.mp4 (portada: archivo.png) · 12:00" (+ "Instagram:" / "TikTok:")
// y "PUBLICACIÓN · prefijo-1 a 4 · 17:00" (carrusel) o "PUBLICACIÓN · archivo · 18:00".
//
// Formato de calendario.json (una entrada por publicación):
//   { semana, zona, solo_prueba, publicaciones: [{
//       clave,     identificador único (no cambiarlo una vez cargado)
//       fecha,     ISO con la zona horaria de Argentina, p. ej. 2026-10-07T10:00:00-03:00
//       tipo,      imagen | carrusel | reel | historia
//       archivos,  nombres de archivo en orden (los PNG se suben como JPG)
//       texto,     el texto de Instagram (las historias no llevan)
//       portada,   portada del reel (opcional)
//       manual,    true = no se publica sola: es una historia con sticker de enlace
//       nota,      recordatorio (sticker, enlace…)
//       tiktok     texto para TikTok (para más adelante; hoy no se usa)
//   }] }
// El estado (pendiente, publicada, error…) vive en Supabase, no en este archivo.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ZONA, isoEnZona } from '../js/zonaHoraria.js';

export { isoEnZona };

const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
const DIAS = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
const TIPOS = { HISTORIA: 'historia', REEL: 'reel', PUBLICACIÓN: 'imagen' };

const sinExtension = (n) => n.replace(/\.[A-Za-z0-9]+$/, '');

// Busca el archivo real de la carpeta para un nombre del calendario (con o sin extensión).
function archivo(nombre, nombres) {
  if (nombres.includes(nombre)) return nombre;
  const hallado = nombres.find((n) => sinExtension(n) === nombre);
  if (!hallado) throw new Error(`No encuentro el archivo "${nombre}" en la carpeta.`);
  return hallado;
}

// "Mi07-chipa-1 a 4" → los 4 archivos que empiezan con Mi07-chipa-1-, -2-…
function laminas(texto, nombres) {
  const m = texto.match(/^(.+)-(\d+) a (\d+)$/);
  if (!m) return [archivo(texto, nombres)];
  const lista = [];
  for (let n = Number(m[2]); n <= Number(m[3]); n++) {
    const hallado = nombres.find((x) => x.startsWith(`${m[1]}-${n}-`) || sinExtension(x) === `${m[1]}-${n}`);
    if (!hallado) throw new Error(`Falta la lámina ${n} de "${m[1]}".`);
    lista.push(hallado);
  }
  return lista;
}

const contarHashtags = (t) => (t.match(/#[\p{L}\p{N}_]+/gu) || []).length;

export function leerCalendario(texto, nombres, { semana, anio = new Date().getFullYear(), soloPrueba = false } = {}) {
  const lineas = texto.replace(/\r/g, '').split('\n');
  const mesTitulo = lineas.slice(0, 5).join(' ').toUpperCase().match(new RegExp(`DE (${MESES.join('|')})`));
  if (!mesTitulo) throw new Error('No encuentro el mes en el título (por ejemplo "… DE OCTUBRE").');
  let mes = MESES.indexOf(mesTitulo[1]) + 1;
  let diaAnterior = 0;
  let fecha = null;
  const avisos = [];
  const publicaciones = [];

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i].trim();
    const dia = linea.match(new RegExp(`^(${DIAS.join('|')})\\s+(\\d{1,2})$`));
    if (dia) {
      const n = Number(dia[2]);
      if (n < diaAnterior) mes = mes === 12 ? 1 : mes + 1;
      const a = mes < MESES.indexOf(mesTitulo[1]) + 1 ? anio + 1 : anio;
      diaAnterior = n;
      fecha = `${a}-${String(mes).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
      const real = DIAS[new Date(`${fecha}T12:00:00Z`).getUTCDay()];
      if (real !== dia[1]) avisos.push(`${dia[1]} ${n}: en ${a} ese día es ${real.toLowerCase()} (¿año equivocado? usá --anio).`);
      continue;
    }
    if (/^[A-ZÁÉÍÓÚÑ ]{6,}$/.test(linea) && !dia && fecha && !/^=+$/.test(linea)) fecha = null; // "DURANTE LA SEMANA…"
    const e = linea.match(/^(HISTORIA|REEL|PUBLICACIÓN)\s+·\s+(.+?)\s+·\s+(\d{1,2}:\d{2})(?:\s+·\s+(.*))?$/);
    if (!e || !fecha) continue;
    const [, clase, que, hora, resto = ''] = e;
    const pub = { clave: '', fecha: isoEnZona(fecha, hora.padStart(5, '0')), tipo: TIPOS[clase], archivos: [], texto: null, portada: null, manual: false, nota: null, tiktok: null };

    // El texto que sigue a la línea: hasta una línea vacía.
    const bloque = [];
    for (let j = i + 1; j < lineas.length && lineas[j].trim() !== ''; j++) bloque.push(lineas[j].trimEnd());

    if (clase === 'HISTORIA') {
      pub.archivos = [archivo(que, nombres)];
      pub.nota = resto || null;
      pub.manual = /sticker de enlace/i.test(resto);
    } else if (clase === 'REEL') {
      const r = que.match(/^(\S+)\s*(?:\(portada:\s*(\S+?)\))?$/);
      if (!r) throw new Error(`No entiendo la línea del reel: ${linea}`);
      pub.archivos = [archivo(r[1], nombres)];
      pub.portada = r[2] ? archivo(r[2], nombres) : null;
      const ig = bloque.indexOf('Instagram:');
      const tt = bloque.indexOf('TikTok:');
      pub.texto = (ig >= 0 ? bloque.slice(ig + 1, tt >= 0 ? tt : undefined) : bloque).join('\n').trim() || null;
      pub.tiktok = tt >= 0 ? bloque.slice(tt + 1).join('\n').trim() || null : null;
    } else {
      pub.archivos = laminas(que, nombres);
      if (pub.archivos.length > 1) pub.tipo = 'carrusel';
      pub.texto = bloque.join('\n').trim() || null;
    }
    pub.clave = `${fecha}-${pub.tipo}-${sinExtension(pub.archivos[0])}`.replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 120);
    publicaciones.push(pub);
  }

  // Controles con los límites de Instagram.
  for (const p of publicaciones) {
    const donde = `${p.fecha.slice(0, 16)} ${p.tipo}`;
    if (p.texto && p.texto.length > 2200) avisos.push(`${donde}: el texto tiene ${p.texto.length} caracteres (máximo 2200).`);
    if (p.texto && contarHashtags(p.texto) > 30) avisos.push(`${donde}: más de 30 hashtags.`);
    if (p.tipo === 'carrusel' && p.archivos.length > 10) avisos.push(`${donde}: un carrusel admite hasta 10 láminas.`);
    if (p.tipo === 'reel' && !/\.mp4$/i.test(p.archivos[0])) avisos.push(`${donde}: el reel tiene que ser .mp4.`);
    if (p.tipo !== 'reel' && p.tipo !== 'historia' && p.archivos.some((a) => /\.mp4$/i.test(a))) avisos.push(`${donde}: videos en el feed van como reel.`);
  }
  const claves = new Set();
  for (const p of publicaciones) {
    if (claves.has(p.clave)) avisos.push(`Clave repetida: ${p.clave}`);
    claves.add(p.clave);
  }
  publicaciones.sort((a, b) => a.fecha.localeCompare(b.fecha));
  return { calendario: { semana, zona: ZONA, solo_prueba: soloPrueba, publicaciones }, avisos };
}

// ---------- uso desde la consola ----------
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const args = process.argv.slice(2);
  const carpeta = args.find((a) => !a.startsWith('--'));
  if (!carpeta) {
    console.error('Uso: node scripts/redes-calendario.mjs <carpeta-de-la-semana> [--anio 2026] [--solo-prueba]');
    process.exit(1);
  }
  const iAnio = args.indexOf('--anio');
  const anio = iAnio >= 0 ? Number(args[iAnio + 1]) : new Date().getFullYear();
  const nombres = readdirSync(carpeta).filter((n) => /\.(png|jpe?g|mp4)$/i.test(n));
  const texto = readFileSync(join(carpeta, '00-CALENDARIO-Y-TEXTOS.txt'), 'utf8');
  const { calendario, avisos } = leerCalendario(texto, nombres, { semana: basename(carpeta.replace(/[\\/]+$/, '')), anio, soloPrueba: args.includes('--solo-prueba') });
  writeFileSync(join(carpeta, 'calendario.json'), `${JSON.stringify(calendario, null, 2)}\n`);
  for (const p of calendario.publicaciones) {
    console.log(`${p.fecha.slice(0, 16).replace('T', ' ')}  ${p.tipo.padEnd(9)} ${String(p.archivos.length).padStart(2)} archivo(s)${p.manual ? '  [a mano: sticker]' : ''}  ${p.clave}`);
  }
  console.log(`\n${calendario.publicaciones.length} publicaciones → ${join(carpeta, 'calendario.json')}${calendario.solo_prueba ? ' (sólo prueba)' : ''}`);
  if (avisos.length) { console.log('\nRevisar:'); for (const a of avisos) console.log(`  · ${a}`); }
}
