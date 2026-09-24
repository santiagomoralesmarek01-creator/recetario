import { el, mostrar, aviso, nuevaNavegacion } from './dom.js';
import * as repo from './repositorio.js';
import { iniciarAuth, alCambiarSesion, usuario, nombreVisible, salir, cambiarClave } from './auth.js';
import { hayBackend } from './supabase.js';
import { vistaInicio, vistaCategoria, vistaBusqueda, vistaPaises, vistaPais } from './vistas/listados.js';
import { vistaReceta } from './vistas/receta.js';
import { vistaEntrar, vistaMisRecetas, vistaNuevaClave } from './vistas/cuenta.js';
import { vistaFormulario } from './vistas/formulario.js';
import { iniciarPanel } from './panelCocina.js';

const menu = document.getElementById('menu');

function error(err) {
  console.error(err);
  mostrar(
    el('div', { class: 'estado' },
      el('p', {}, 'No se pudo cargar esta página. Revisá tu conexión.'),
      err?.message && el('p', { class: 'meta' }, err.message),
      el('button', { type: 'button', onclick: () => router() }, 'Reintentar'))
  );
}

// ---------- menú según la sesión ----------

function dibujarMenu(u) {
  if (!hayBackend) { menu.replaceChildren(); return; }
  menu.replaceChildren(...(u
    ? [
      el('a', { class: 'boton boton-secundario', href: '#/mis-recetas' }, 'Mis recetas'),
      el('a', { class: 'boton', href: '#/nueva' }, '+ Nueva'),
      el('button', {
        type: 'button',
        class: 'boton-texto',
        title: `Sesión de ${nombreVisible(u)}`,
        onclick: async () => {
          await salir();
          aviso('Sesión cerrada');
          location.hash = '#/';
        },
      }, 'Salir'),
    ]
    : [
      el('a', { class: 'boton boton-secundario', href: '#/nueva' }, 'Crear receta'),
      el('a', { class: 'boton', href: '#/entrar' }, 'Entrar'),
    ]));
}

// ---------- ruteo por hash ----------

const RUTAS_PRIVADAS = new Set(['mis-recetas', 'nueva', 'editar']);

async function router() {
  nuevaNavegacion();
  const hash = location.hash;

  // Supabase vuelve de los emails (confirmación, recuperación) con datos en el hash.
  if (/access_token=|type=recovery/.test(hash)) return;
  if (/error_description=/.test(hash)) {
    const params = new URLSearchParams(hash.slice(1));
    mostrar(el('div', { class: 'estado' },
      el('p', {}, `El enlace no es válido o ya venció (${params.get('error_description')}).`),
      el('a', { href: '#/entrar' }, 'Volver a intentar')));
    return;
  }

  const [ruta, ...resto] = hash.replace(/^#\/?/, '').split('/');
  const param = decodeURIComponent(resto.join('/'));
  document.title = 'Recetario';
  try {
    switch (ruta) {
      case 'receta': return param ? await vistaReceta(param) : await vistaInicio();
      case 'categoria': return param ? await vistaCategoria(param) : await vistaInicio();
      case 'buscar': return param ? await vistaBusqueda(param) : await vistaInicio();
      case 'paises': return await vistaPaises();
      case 'pais': return param ? await vistaPais(param) : await vistaPaises();
      case 'entrar': return vistaEntrar('entrar');
      case 'registro': return vistaEntrar('registro');
      case 'recuperar': return vistaEntrar('recuperar');
      case 'nueva-clave': return usuario() ? vistaNuevaClave(cambiarClave) : vistaEntrar('recuperar');
      case 'mis-recetas': return await vistaMisRecetas();
      case 'nueva': return await vistaFormulario();
      case 'editar': return await vistaFormulario(param);
      default: return await vistaInicio();
    }
  } catch (err) {
    error(err);
  }
}

document.getElementById('buscador').addEventListener('submit', (e) => {
  e.preventDefault();
  const texto = document.getElementById('busqueda').value.trim();
  if (texto) location.hash = `#/buscar/${encodeURIComponent(texto)}`;
});

document.getElementById('sorpresa').addEventListener('click', async () => {
  try {
    const r = await repo.aleatoria();
    location.hash = `#/receta/${r.id}`;
  } catch (err) {
    error(err);
  }
});

window.addEventListener('hashchange', router);

// Al cambiar la sesión: redibujar el menú y, si estabas en una página privada, refrescarla.
let primeraVez = true;
let ultimoUsuario = null;
alCambiarSesion((u) => {
  const cambio = (u?.id ?? null) !== ultimoUsuario;
  ultimoUsuario = u?.id ?? null;
  dibujarMenu(u);
  if (primeraVez || !cambio) return;
  const ruta = location.hash.replace(/^#\/?/, '').split('/')[0];
  if (RUTAS_PRIVADAS.has(ruta) || ruta === 'receta') router();
});

(async () => {
  dibujarMenu(null);
  iniciarPanel();
  try {
    await iniciarAuth();
  } catch (err) {
    console.warn('No se pudo iniciar la sesión:', err);
  }
  primeraVez = false;
  if (/access_token=/.test(location.hash) && !/type=recovery/.test(location.hash)) {
    history.replaceState(null, '', location.pathname);
  }
  router();
})();
