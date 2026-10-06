// Progreso de "modo cocina": qué ingredientes y pasos ya tildaste en cada receta.
// Se guarda en el navegador, así no se pierde si recargás la página.

const clave = (idReceta) => `recetario:cocina:${idReceta}`;
const CLAVE_ACTUAL = 'recetario:actual';
const EVENTO = 'recetario:cocina';

// Avisa al resto de la página (la ficha y el panel lateral) que algo cambió.
function avisar(detalle) {
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: detalle }));
}

export function alCambiarCocina(fn) {
  const manejar = (e) => fn(e.detail || {});
  window.addEventListener(EVENTO, manejar);
  return () => window.removeEventListener(EVENTO, manejar);
}

// Otra pestaña cambió el progreso o la receta actual.
window.addEventListener('storage', (e) => {
  if (e.key?.startsWith('recetario:cocina:') || e.key === CLAVE_ACTUAL) avisar({ id: e.key.split(':')[2] });
});

// ---------- receta que se está cocinando (la del panel lateral) ----------

export function recetaActual() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_ACTUAL));
  } catch {
    return null;
  }
}

export function fijarActual(r) {
  const actual = {
    id: r.id,
    nombre: r.nombre,
    imagen: r.imagen || '',
    ingredientes: r.ingredientes.map(({ nombre, medida, imagen }) => ({ nombre, medida, imagen })),
    pasos: r.pasos,
  };
  try { localStorage.setItem(CLAVE_ACTUAL, JSON.stringify(actual)); } catch { /* sin almacenamiento */ }
  avisar({ id: r.id, actual: true });
}

export function soltarActual() {
  try { localStorage.removeItem(CLAVE_ACTUAL); } catch { /* sin almacenamiento */ }
  avisar({ actual: true });
}

export function leerProgreso(idReceta) {
  try {
    const guardado = JSON.parse(localStorage.getItem(clave(idReceta)));
    return {
      ingredientes: new Set(guardado?.ingredientes || []),
      pasos: new Set(guardado?.pasos || []),
    };
  } catch {
    return { ingredientes: new Set(), pasos: new Set() };
  }
}

export function guardarProgreso(idReceta, progreso, origen = null) {
  guardarEnDisco(idReceta, progreso);
  avisar({ id: idReceta, origen });
}

function guardarEnDisco(idReceta, progreso) {
  try {
    if (!progreso.ingredientes.size && !progreso.pasos.size) {
      localStorage.removeItem(clave(idReceta));
      return;
    }
    localStorage.setItem(clave(idReceta), JSON.stringify({
      ingredientes: [...progreso.ingredientes],
      pasos: [...progreso.pasos],
      actualizado: Date.now(),
    }));
  } catch {
    // Navegación privada o almacenamiento lleno: el progreso vive sólo en memoria.
  }
}

// Mantiene la pantalla encendida mientras cocinás (si el navegador lo permite).
let bloqueo = null;

export const pantallaSoportada = () => 'wakeLock' in navigator;

export async function mantenerPantalla(activar) {
  try {
    if (activar) {
      bloqueo = await navigator.wakeLock.request('screen');
      bloqueo.addEventListener('release', () => { bloqueo = null; });
    } else if (bloqueo) {
      await bloqueo.release();
      bloqueo = null;
    }
  } catch {
    bloqueo = null;
  }
  return Boolean(bloqueo);
}

export const pantallaActiva = () => Boolean(bloqueo);

// Al volver a la pestaña el navegador suelta el bloqueo; lo pedimos de nuevo.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && bloqueo === null && sessionStorage.getItem('recetario:pantalla') === '1') {
    mantenerPantalla(true);
  }
});
