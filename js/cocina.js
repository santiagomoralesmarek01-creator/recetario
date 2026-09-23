// Progreso de "modo cocina": qué ingredientes y pasos ya tildaste en cada receta.
// Se guarda en el navegador, así no se pierde si recargás la página.

const clave = (idReceta) => `recetario:cocina:${idReceta}`;

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

export function guardarProgreso(idReceta, progreso) {
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
