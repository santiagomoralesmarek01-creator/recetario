// Navegación con direcciones reales (/receta/…, /categoria/…) en lugar de
// /#/…, para que Google pueda indexar cada receta. Los enlaces internos son
// <a href="/…"> comunes: un clic se intercepta y cambia de página sin
// recargar. Las direcciones viejas con # se convierten al entrar.

const EVENTO = 'amano:ruta';

// Ruta actual sin la barra inicial ni la final: "receta/52772", "" en el inicio.
export function ruta() {
  return location.pathname.replace(/^\/+|\/+$/g, '');
}

// ir('/receta/52772') o ir('#/receta/52772') (formato viejo, por destinos guardados).
export function ir(destino, { reemplazar = false } = {}) {
  let camino = String(destino || '/').replace(/^#/, '');
  if (!camino.startsWith('/')) camino = `/${camino}`;
  if (camino === location.pathname + location.search && !reemplazar) {
    window.dispatchEvent(new CustomEvent(EVENTO));
    return;
  }
  history[reemplazar ? 'replaceState' : 'pushState'](null, '', camino);
  window.dispatchEvent(new CustomEvent(EVENTO));
  window.scrollTo(0, 0);
}

export function alCambiarRuta(fn) {
  window.addEventListener(EVENTO, fn);
  window.addEventListener('popstate', fn);
}

// Nombre legible para la dirección: "Pollo teriyaki al horno" → "pollo-teriyaki-al-horno".
export function slug(texto) {
  return String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ñ/g, 'n').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);
}

// Dirección de una receta. Las del catálogo y la comunidad suman el nombre:
// /receta/52772-pollo-teriyaki-al-horno. Las de la casa ya tienen el nombre en el id.
export function rutaReceta(id, nombre = '') {
  const s = String(id);
  if (s.startsWith('c-') || !nombre) return `/receta/${s}`;
  return `/receta/${s}-${slug(nombre)}`;
}

// De "52772-pollo-teriyaki" o "u-<uuid>-tarta" vuelve al id.
export function idDeRuta(parametro) {
  const p = String(parametro);
  const uuid = p.match(/^u-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (uuid) return uuid[0];
  const numero = p.match(/^\d+(?=-|$)/);
  if (numero) return numero[0];
  return p;
}

function esInterno(a, e) {
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  if (a.target && a.target !== '_self') return false;
  if (a.hasAttribute('download')) return false;
  const href = a.getAttribute('href');
  if (!href || !href.startsWith('/') || href.startsWith('//')) return false;
  // Archivos y funciones del servidor van directo.
  if (/^\/(api|data|img|css|js|docs)\//.test(href) || /\.[a-z0-9]{2,5}$/i.test(href.split('?')[0])) return false;
  return true;
}

export function iniciarRutas() {
  // Enlaces viejos: /#/receta/52772 → /receta/52772 (sin tocar los datos que
  // Supabase deja en el # al volver de un email).
  if (location.hash.startsWith('#/')) {
    history.replaceState(null, '', location.hash.slice(1));
  }
  // Y si se abre un enlace viejo estando ya en la web (sólo cambia el #).
  window.addEventListener('hashchange', () => {
    if (location.hash.startsWith('#/')) ir(location.hash.slice(1), { reemplazar: true });
  });
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href]');
    if (!esInterno(a, e)) return;
    e.preventDefault();
    ir(a.getAttribute('href'));
  });
}
