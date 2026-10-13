// Plantillas HTML de las piezas de redes de A Mano (mismo estilo que la
// semana 2): láminas de carrusel 1080×1350, historias 1080×1920, imágenes
// sueltas del feed y escenas de reel. Las usa scripts/redes/generar-semana.mjs.
//
// Los colores salen del bloque :root de css/estilos.css (var(--aji), etc.)
// y los íconos, de js/iconos.js: nada de valores sueltos.
import { readFileSync } from 'node:fs';
import { trazos } from '../../js/iconos.js';

const raiz = new URL('../../', import.meta.url);
const raizCss = readFileSync(new URL('css/estilos.css', raiz), 'utf8').match(/:root\s*\{[\s\S]*?\n\}/)[0];
const isotipoSvg = readFileSync(new URL('img/isotipo.svg', raiz), 'utf8').replace(/<title>.*?<\/title>/, '');

export const FEED = { ancho: 1080, alto: 1350 };
export const VERTICAL = { ancho: 1080, alto: 1920 };

const escapar = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// *texto* resalta en Maíz o Ají según el fondo (clase .resalte).
const rico = (s) => escapar(s).replace(/\*(.+?)\*/g, '<span class="resalte">$1</span>').replace(/\n/g, '<br>');

export const icono = (nombre, tam = 64) =>
  `<svg class="icono" width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${trazos(nombre)}</svg>`;
const isotipo = (tam = 64) => `<span class="isotipo" style="width:${tam}px;height:${tam}px">${isotipoSvg.replace(/#C8401F/g, 'currentColor')}</span>`;

function pagina({ ancho, alto }, fuentes, cuerpo, clase = '') {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${fuentes}
${raizCss}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${ancho}px;height:${alto}px;overflow:hidden}
body{font-family:var(--fuente-texto);color:var(--texto);-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}
.l{position:relative;width:${ancho}px;height:${alto}px;padding:84px 90px;display:flex;flex-direction:column;background:var(--fondo)}
.l.aji{background:var(--aji);color:var(--texto-sobre-aji)}
.l.hierba{background:var(--hierba-bloque);color:var(--texto-sobre-hierba)}
.l.crema{background:var(--fondo)}
h1,h2,.titulo{font-family:var(--fuente-titulos);font-weight:800;letter-spacing:-0.04em;line-height:.94}
.cursiva{font-family:var(--fuente-detalle);font-style:italic;font-weight:400}
.ceja{font-weight:700;font-size:25px;letter-spacing:.16em;text-transform:uppercase}
.arriba{display:flex;justify-content:space-between;align-items:center}
.isotipo{display:inline-block}.isotipo svg{width:100%;height:100%}
.crema .isotipo,.crema .ceja{color:var(--aji)}
.aji .isotipo,.hierba .isotipo{color:var(--texto-sobre-aji)}
.aji .ceja,.hierba .ceja{color:var(--maiz)}
.crema .resalte{color:var(--aji)}
.aji .resalte,.hierba .resalte{color:var(--maiz)}
.tarjeta .resalte{color:var(--aji-texto)}
.chips{display:flex;flex-wrap:wrap;gap:14px}
.chip{display:inline-flex;align-items:center;gap:10px;padding:12px 20px;border-radius:999px;font-weight:700;font-size:26px;background:var(--fondo-2)}
.chip .icono{width:28px;height:28px}
.aji .chip{background:rgba(255,255,255,.16)}.hierba .chip{background:rgba(255,255,255,.12)}
.url{font-family:var(--fuente-titulos);font-weight:700;letter-spacing:-0.01em}
.aji .url,.hierba .url{color:var(--maiz)}
.pildora{display:inline-flex;align-items:center;gap:14px;background:var(--superficie);color:var(--aji-texto);padding:22px 38px;border-radius:999px;font-weight:700;font-size:32px}
.pildora .icono{width:32px;height:32px}
.empuje{flex:1}
</style></head><body><div class="l ${clase}">${cuerpo}</div></body></html>`;
}

// ---------- carrusel (4 láminas: portada, ingredientes, pasos, secreto) ----------

export function carrusel(c, fuentes) {
  const chips = [
    ['reloj', `${c.minutos} min`], ['porciones', `${c.porciones} porciones`], [c.chipIcono || 'canasta', c.chip],
  ].filter(([, t]) => t);
  const portada = pagina(FEED, fuentes, `
    <div class="arriba">${isotipo(66)}<span class="ceja">${escapar(c.ceja)}</span></div>
    <div class="empuje"></div>
    <div style="color:var(--aji);margin-bottom:34px">${icono(c.icono || 'olla', 96)}</div>
    <h1 style="font-size:${c.tamTitulo || 150}px">${rico(c.titulo)}</h1>
    <p class="cursiva" style="font-size:50px;margin:30px 0 40px;color:var(--texto)">${escapar(c.bajada)}</p>
    <div class="chips">${chips.map(([i, t]) => `<span class="chip">${icono(i)}${escapar(t)}</span>`).join('')}</div>
    <div class="empuje"></div>
    <div style="align-self:flex-end;font-weight:700;font-size:28px;display:flex;align-items:center;gap:10px">Deslizá ${icono('flecha', 30)}</div>`, 'crema');

  const ings = c.ingredientes;
  const mitad = Math.ceil(ings.length / 2);
  const columna = (lista) => lista.map(([medida, nombre]) => `
    <div style="padding:20px 0 18px;border-bottom:2px solid var(--borde)">
      <div class="titulo" style="color:var(--aji);font-size:40px;letter-spacing:-0.02em">${escapar(medida)}</div>
      <div style="font-size:28px;margin-top:6px;line-height:1.2">${escapar(nombre)}</div>
    </div>`).join('');
  const ingredientes = pagina(FEED, fuentes, `
    <div class="arriba">${isotipo(66)}<span class="ceja">${escapar(c.nombreCorto || c.titulo.replace(/\*/g, ''))}</span></div>
    <h2 style="font-size:96px;margin-top:40px">Ingredientes</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;column-gap:56px;margin-top:56px">
      <div>${columna(ings.slice(0, mitad))}</div><div>${columna(ings.slice(mitad))}</div>
    </div>
    ${c.notaIngredientes ? `<p style="margin-top:34px;font-size:27px;color:var(--texto-suave)">${rico(c.notaIngredientes)}</p>` : ''}`, 'crema');

  const pasos = pagina(FEED, fuentes, `
    <div class="arriba">${isotipo(66)}<span class="ceja">${escapar(c.nombreCorto || c.titulo.replace(/\*/g, ''))}</span></div>
    <h2 style="font-size:96px;margin-top:40px">Paso a paso</h2>
    <ol style="list-style:none;margin-top:${c.pasos.length > 5 ? 44 : 60}px;display:flex;flex-direction:column;gap:${c.pasos.length > 5 ? 30 : 40}px">
      ${c.pasos.map((p, i) => `<li style="display:flex;gap:30px;align-items:flex-start">
        <span style="flex:none;width:60px;height:60px;border-radius:50%;background:var(--hierba-bloque);color:var(--texto-sobre-hierba);display:grid;place-items:center;font-weight:700;font-size:28px">${i + 1}</span>
        <span style="font-size:33px;line-height:1.32;padding-top:6px">${rico(p)}</span></li>`).join('')}
    </ol>`, 'crema');

  const secreto = pagina(FEED, fuentes, `
    <div class="arriba">${isotipo(66)}<span class="ceja">El secreto</span></div>
    <div class="empuje"></div>
    <div style="text-align:center;display:flex;flex-direction:column;align-items:center">
      <h2 style="font-size:116px">${rico(c.secreto.titulo)}</h2>
      <p style="font-size:38px;line-height:1.4;margin:40px 30px 56px">${rico(c.secreto.texto)}</p>
      <span class="pildora">${icono('guardada')}${escapar(c.cta || 'Guardala para después')}</span>
      <span class="url" style="font-size:36px;margin-top:44px">amanorecetas.com.ar</span>
    </div>
    <div class="empuje"></div>`, 'aji');

  return [portada, ingredientes, pasos, secreto];
}

// ---------- historias ----------

// Tip con lista numerada (fondo Hierba).
export function historiaTip(h, fuentes) {
  return pagina(VERTICAL, fuentes, `
    <div class="ceja" style="display:flex;align-items:center;gap:16px;margin-top:150px">${icono(h.icono || 'reemplazo', 46)}${escapar(h.ceja || 'Tip de reemplazo')}</div>
    <h1 style="font-size:${h.tamTitulo || 118}px;margin-top:50px">${rico(h.titulo)}</h1>
    <p class="cursiva" style="font-size:50px;margin-top:30px">${escapar(h.bajada || 'Con lo que hay, alcanza.')}</p>
    <div class="tarjeta" style="background:var(--fondo);color:var(--texto);border-radius:36px;padding:48px 52px;margin-top:70px;display:flex;flex-direction:column;gap:40px">
      ${h.opciones.map(([t, s], i) => `<div style="display:flex;gap:30px;align-items:flex-start">
        <span style="flex:none;width:64px;height:64px;border-radius:50%;background:var(--aji);color:var(--texto-sobre-aji);display:grid;place-items:center;font-weight:700;font-size:30px">${i + 1}</span>
        <div><div class="titulo" style="font-size:46px;letter-spacing:-0.02em;line-height:1.05">${escapar(t)}</div>
        ${s ? `<div style="font-size:32px;color:var(--texto-suave);margin-top:8px;line-height:1.3">${escapar(s)}</div>` : ''}</div></div>`).join('')}
    </div>
    <div class="empuje"></div>
    <div class="arriba" style="margin-bottom:120px"><span class="url" style="font-size:32px">amanorecetas.com.ar</span><span class="cursiva" style="font-size:32px;color:var(--maiz)">${escapar(h.pie || 'Más tips en destacadas')}</span></div>`, 'hierba');
}

// Pregunta con opciones para responder la historia (fondo Ají o crema).
export function historiaPregunta(h, fuentes) {
  const fondo = h.fondo || 'aji';
  return pagina(VERTICAL, fuentes, `
    <div class="arriba" style="margin-top:150px">${isotipo(76)}<span class="ceja">${escapar(h.ceja || 'Respondé esta historia')}</span></div>
    <div class="empuje"></div>
    <h1 style="font-size:${h.tamTitulo || 132}px">${rico(h.titulo)}</h1>
    ${h.bajada ? `<p class="cursiva" style="font-size:50px;margin-top:30px">${escapar(h.bajada)}</p>` : ''}
    <div style="display:flex;flex-direction:column;gap:26px;margin-top:70px">
      ${h.opciones.map((o, i) => `<div style="display:flex;align-items:center;gap:28px;background:${fondo === 'aji' ? 'rgba(255,255,255,.14)' : 'var(--superficie)'};border-radius:30px;padding:34px 40px">
        <span class="titulo" style="font-size:44px;color:${fondo === 'aji' ? 'var(--maiz)' : 'var(--aji)'};width:56px">${String.fromCharCode(65 + i)}</span>
        <span class="titulo" style="font-size:52px;letter-spacing:-0.02em">${escapar(o)}</span></div>`).join('')}
    </div>
    <div class="empuje"></div>
    <div style="margin-bottom:130px;font-size:34px;font-weight:700;text-align:center">${escapar(h.pie || 'Contestá con la letra por mensaje')}</div>`, fondo);
}

// ---------- imágenes sueltas del feed ----------

// "Un plato, mil nombres": cómo se dice algo en cada país.
export function imagenNombres(p, fuentes) {
  return pagina(FEED, fuentes, `
    <div class="arriba">${isotipo(66)}<span class="ceja">Un plato, mil nombres</span></div>
    <h1 style="font-size:128px;margin-top:60px">${rico(p.titulo)}</h1>
    <p class="cursiva" style="font-size:46px;margin-top:22px;color:var(--texto-suave)">${escapar(p.bajada)}</p>
    <div style="margin-top:56px;display:flex;flex-direction:column">
      ${p.nombres.map(([nombre, paises]) => `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:40px;padding:24px 0;border-bottom:2px solid var(--borde)">
        <span class="titulo" style="font-size:62px;color:var(--aji);letter-spacing:-0.02em">${escapar(nombre)}</span>
        <span style="font-size:28px;text-align:right;color:var(--texto-suave);max-width:520px;line-height:1.3">${escapar(paises)}</span></div>`).join('')}
    </div>
    <div class="empuje"></div>
    <div class="arriba"><span style="font-weight:700;font-size:30px">${escapar(p.pregunta)}</span><span class="url" style="font-size:28px;color:var(--aji-texto)">amanorecetas.com.ar</span></div>`, 'crema');
}

// "Reemplazo de la semana" (fondo Hierba).
export function imagenReemplazo(p, fuentes) {
  return pagina(FEED, fuentes, `
    <div class="arriba">${isotipo(66)}<span class="ceja">Reemplazo de la semana</span></div>
    <div class="empuje"></div>
    <div style="display:flex;align-items:center;gap:30px;font-size:44px;font-weight:700">
      <span style="text-decoration:line-through;opacity:.75">${escapar(p.falta)}</span>${icono('flecha', 54)}<span style="color:var(--maiz)">${escapar(p.usar)}</span></div>
    <h1 style="font-size:120px;margin-top:36px">${rico(p.titulo)}</h1>
    <p style="font-size:36px;line-height:1.4;margin-top:36px;max-width:860px">${rico(p.texto)}</p>
    <div class="tarjeta" style="background:var(--fondo);color:var(--texto);border-radius:30px;padding:34px 40px;margin-top:50px;display:flex;gap:26px;align-items:center">
      <span style="color:var(--aji)">${icono('tilde', 52)}</span><span style="font-size:32px;line-height:1.35">${rico(p.dato)}</span></div>
    <div class="empuje"></div>
    <div class="arriba"><span class="cursiva" style="font-size:34px">Con lo que hay, alcanza.</span><span class="url" style="font-size:30px">amanorecetas.com.ar</span></div>`, 'hierba');
}

// Promo de una función de la web (fondo Ají).
export function imagenFuncion(p, fuentes) {
  return pagina(FEED, fuentes, `
    <div class="arriba">${isotipo(66)}<span class="ceja">${escapar(p.ceja)}</span></div>
    <div class="empuje"></div>
    <div style="color:var(--maiz)">${icono(p.icono || 'canasta', 110)}</div>
    <h1 style="font-size:132px;margin-top:30px">${rico(p.titulo)}</h1>
    <p style="font-size:38px;line-height:1.4;margin-top:36px;max-width:860px">${rico(p.texto)}</p>
    <div class="chips" style="margin-top:44px">${p.chips.map((t) => `<span class="chip">${escapar(t)}</span>`).join('')}</div>
    <div class="empuje"></div>
    <span class="url" style="font-size:40px">${escapar(p.url)}</span>`, 'aji');
}

// ---------- reels: escenas 1080×1920 (la barra de progreso la anima ffmpeg) ----------

const BARRA = { x: 90, y: 306, ancho: 900, alto: 8 };
export const barraReel = BARRA;

function escena(fondo, cuerpo, fuentes) {
  const claro = fondo === 'crema';
  return pagina(VERTICAL, fuentes, `
    <div style="margin-top:150px;font-family:var(--fuente-titulos);font-weight:800;font-size:44px;letter-spacing:-0.03em;${claro ? 'color:var(--aji)' : ''}">a mano</div>
    <div style="position:absolute;left:${BARRA.x}px;top:${BARRA.y}px;width:${BARRA.ancho}px;height:${BARRA.alto}px;border-radius:9px;background:${claro ? 'var(--borde)' : 'rgba(255,255,255,.22)'}"></div>
    ${cuerpo}`, fondo);
}

export function escenasReel(r, fuentes) {
  const n = r.pasos.length;
  const escenas = [];
  escenas.push({ seg: 2.6, html: escena('aji', `<div class="empuje"></div>
    <h1 style="font-size:${r.tamGancho || 150}px">${rico(r.gancho)}</h1><div class="empuje"></div><div class="empuje"></div>`, fuentes) });
  escenas.push({ seg: 3.2, html: escena('aji', `<div class="empuje"></div>
    <div style="color:var(--maiz)">${icono(r.icono || 'olla', 120)}</div>
    <h1 style="font-size:${r.tamTitulo || 140}px;margin-top:34px">${rico(r.titulo)}</h1>
    <p class="cursiva" style="font-size:52px;margin-top:26px">${escapar(r.bajada)}</p>
    <div class="chips" style="margin-top:44px">
      <span class="chip">${icono('reloj')}${r.minutos} min</span><span class="chip">${icono('porciones')}${r.porciones} porciones</span>
      ${r.chip ? `<span class="chip">${icono('canasta')}${escapar(r.chip)}</span>` : ''}</div>
    <div class="empuje"></div><div class="empuje"></div>`, fuentes) });
  escenas.push({ seg: 4.2, html: escena('crema', `
    <h2 style="font-size:120px;color:var(--aji);margin-top:150px">Necesitás</h2>
    <div style="margin-top:50px">${r.necesitas.map(([m, t]) => `<div style="display:flex;gap:40px;align-items:baseline;padding:26px 0;border-bottom:2px solid var(--borde)">
      <span class="titulo" style="font-size:52px;color:var(--aji);width:230px;letter-spacing:-0.02em">${escapar(m)}</span><span style="font-size:44px">${escapar(t)}</span></div>`).join('')}</div>`, fuentes) });
  r.pasos.forEach(([texto, ic], i) => escenas.push({ seg: 2.8, html: escena('hierba', `
    <h2 style="font-size:110px;margin-top:150px">Paso a paso</h2>
    <div class="tarjeta" style="background:var(--fondo);color:var(--texto);border-radius:40px;padding:50px 52px;margin-top:60px">
      <span style="width:76px;height:76px;border-radius:50%;background:var(--aji);color:var(--texto-sobre-aji);display:grid;place-items:center;font-weight:700;font-size:36px">${i + 1}</span>
      <div class="titulo" style="font-size:64px;letter-spacing:-0.025em;line-height:1.08;margin-top:34px">${rico(texto)}</div></div>
    <div style="display:flex;flex-direction:column;align-items:center;margin-top:90px;gap:28px">
      <span style="width:150px;height:150px;border-radius:50%;background:rgba(255,255,255,.08);color:var(--maiz);display:grid;place-items:center">${icono(ic || 'olla', 74)}</span>
      <span class="ceja" style="font-size:28px">Paso ${i + 1} de ${n}</span>
      <span style="display:flex;gap:12px">${r.pasos.map((_, j) => `<i style="width:16px;height:16px;border-radius:50%;background:${j === i ? 'var(--maiz)' : j < i ? 'var(--texto-sobre-hierba)' : 'rgba(255,255,255,.3)'}"></i>`).join('')}</span>
    </div>`, fuentes) }));
  escenas.push({ seg: 3.4, html: escena('aji', `<div class="empuje"></div>
    <div style="text-align:center"><div class="ceja" style="font-size:30px">El secreto</div>
    <h1 style="font-size:${r.tamSecreto || 124}px;margin-top:30px">${rico(r.secreto)}</h1></div>
    <div class="empuje"></div><div class="empuje"></div>`, fuentes) });
  escenas.push({ seg: 3.6, html: escena('aji', `<div class="empuje"></div>
    <div style="display:flex;flex-direction:column;align-items:center;text-align:center">${isotipo(150)}
    <h1 style="font-size:88px;margin-top:40px">La receta completa<br>está en</h1>
    <span class="url" style="font-size:56px;margin-top:30px">amanorecetas.com.ar</span>
    <span class="pildora" style="margin-top:56px">${icono('guardada')}${escapar(r.cta || 'Guardala para después')}</span></div>
    <div class="empuje"></div><div class="empuje"></div>`, fuentes) });
  return escenas;
}

// Portada del reel: lo importante queda en el centro (la grilla recorta 3:4).
export function portadaReel(r, fuentes) {
  return pagina(VERTICAL, fuentes, `
    <div class="empuje"></div>
    <div style="display:flex;flex-direction:column;align-items:flex-start">
      <div style="color:var(--maiz)">${icono(r.icono || 'olla', 130)}</div>
      <h1 style="font-size:${r.tamPortada || 156}px;margin-top:34px">${rico(r.titulo)}</h1>
      <p class="cursiva" style="font-size:56px;margin-top:28px">${escapar(r.bajada)}</p>
      <span class="ceja" style="margin-top:50px;font-size:30px">Receta paso a paso</span>
    </div>
    <div class="empuje"></div>
    <div class="arriba" style="margin-bottom:120px">${isotipo(80)}<span class="url" style="font-size:34px">amanorecetas.com.ar</span></div>`, 'aji');
}
