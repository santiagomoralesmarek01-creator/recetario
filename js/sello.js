// Sello circular de las medallas: borde levemente irregular (como estampado a
// mano) y el ícono de la medalla adentro. Estados: bloqueada (contorno),
// lograda (relleno Maíz, ícono Hierba) y especial (relleno Ají, ícono crema).
import { trazos } from './iconos.js';

const NS = 'http://www.w3.org/2000/svg';

// 24 ondas suaves con una irregularidad fija (siempre igual, no al azar).
const BORDE = (() => {
  const n = 24;
  const puntos = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const irregular = Math.sin(i * 2.3) * 0.45;
    const r = (i % 2 === 0 ? 29.5 : 27.4) + irregular;
    puntos.push([32 + r * Math.cos(a), 32 + r * Math.sin(a)]);
  }
  const f = (v) => v.toFixed(1);
  let d = `M${f(puntos[0][0])} ${f(puntos[0][1])}`;
  for (let i = 1; i <= puntos.length; i += 2) {
    const c = puntos[i % puntos.length];
    const p = puntos[(i + 1) % puntos.length];
    d += `Q${f(c[0])} ${f(c[1])} ${f(p[0])} ${f(p[1])}`;
  }
  return `${d}Z`;
})();

export function estadoSello(medalla) {
  if (!medalla.ganada) return 'bloqueada';
  return medalla.especial ? 'especial' : 'lograda';
}

export function sello(medalla, { estado = estadoSello(medalla), clase = '' } = {}) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.setAttribute('class', `sello sello-${estado}${clase ? ` ${clase}` : ''}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `<path class="sello-borde" d="${BORDE}"/><circle class="sello-aro" cx="32" cy="32" r="21.5"/>`
    + `<g class="sello-icono" transform="translate(17.6 17.6) scale(1.2)" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${trazos(medalla.icono)}</g>`;
  return svg;
}
