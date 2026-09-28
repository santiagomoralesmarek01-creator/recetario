// Analítica sin cookies: Plausible (secciones y eventos) o Cloudflare Web
// Analytics (sólo visitas). Se configura en js/config.js; si está vacío no
// se carga nada. No se manda ningún dato personal: sólo el nombre del evento
// y datos generales (qué juego, cuántos ingredientes).
import { ANALITICA } from './config.js';

function cargarScript(src, atributos) {
  const s = document.createElement('script');
  s.defer = true;
  s.src = src;
  for (const [k, v] of Object.entries(atributos)) s.setAttribute(k, v);
  document.head.append(s);
}

export function iniciarAnalitica() {
  const { plausible, cloudflare } = ANALITICA || {};
  if (plausible) {
    // Cola para los eventos que pasen antes de que cargue el script.
    window.plausible = window.plausible || function (...args) { (window.plausible.q = window.plausible.q || []).push(args); };
    // La versión "hash" cuenta cada sección (#/receta/…, #/que-tengo…).
    cargarScript('https://plausible.io/js/script.hash.js', { 'data-domain': plausible });
  }
  if (cloudflare) {
    cargarScript('https://static.cloudflareinsights.com/beacon.min.js', { 'data-cf-beacon': JSON.stringify({ token: cloudflare }) });
  }
}

// evento('Manitas', { tipo: 'rápido' }). Sin Plausible no hace nada.
export function evento(nombre, datos) {
  try {
    if (ANALITICA?.plausible && typeof window.plausible === 'function') window.plausible(nombre, datos ? { props: datos } : undefined);
  } catch { /* la analítica nunca rompe la página */ }
}
