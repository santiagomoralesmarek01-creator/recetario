import { el, mostrar, aviso, nuevaNavegacion } from './dom.js';
import * as repo from './repositorio.js';
import { iniciarAuth, alCambiarSesion, usuario, nombreVisible, salir, cambiarClave } from './auth.js';
import { hayBackend } from './supabase.js';
import { vistaInicio, vistaCategoria, vistaBusqueda, vistaPaises, vistaPais, vistaCasa, vistaFaciles } from './vistas/listados.js';
import { vistaReceta } from './vistas/receta.js';
import { vistaEntrar, vistaMisRecetas, vistaNuevaClave } from './vistas/cuenta.js';
import { vistaFormulario } from './vistas/formulario.js';
import { vistaComunidad, vistaPerfil } from './vistas/comunidad.js';
import { vistaDespensa } from './vistas/despensa.js';
import { iniciarPanel } from './panelCocina.js';
import { iniciarTema } from './tema.js';
import { iniciarAyudante, contextoReceta } from './ayudante.js';
import { iniciarTemporizadores } from './temporizador.js';
import { vistaJuegos, vistaJuego } from './vistas/juegos.js';
import { vistaMedallas } from './vistas/medallas.js';
import { iniciarMedallas } from './medallas.js';
import { vistaFotos } from './vistas/fotosRecetas.js';
import { vistaTorneo, vistaBases, vistaAdminTorneo } from './vistas/torneo.js';
import { vistaAdminRedes } from './vistas/redes.js';
import { soyAdmin } from './fotos.js';
import { icono } from './iconos.js';
import { t, aplicarTextos } from './textos.js';
import { iniciarPreferencias, EVENTO as CAMBIO_PREFERENCIAS } from './preferencias.js';
import { vistaPreferencias } from './vistas/preferencias.js';
import { iniciarAnalitica } from './analitica.js';
import { ir, ruta as rutaActual, alCambiarRuta, iniciarRutas, idDeRuta, rutaReceta } from './rutas.js';
import { vistaPrivacidad, vistaTerminos } from './vistas/legales.js';

iniciarTema();
aplicarTextos();
const menu = document.getElementById('menu');
const enlacesNav = [...document.querySelectorAll('.nav-principal a')];
if (!hayBackend) enlacesNav.find((a) => a.dataset.ruta.startsWith('comunidad'))?.remove();

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
      el('a', { class: 'boton', href: '/nueva' }, icono('mas'), t('cabecera.nueva')),
      menuUsuario(u),
    ]
    : [
      el('a', { class: 'boton boton-secundario', href: '/nueva' }, t('cabecera.crear')),
      el('a', { class: 'boton', href: '/entrar' }, t('cabecera.entrar')),
    ]));
}

// Botón con la inicial que despliega las opciones de la cuenta.
function menuUsuario(u) {
  const nombre = nombreVisible(u);
  // Sólo para administradores: se agrega cuando se confirma.
  const enlaceAdmin = el('a', { href: '/fotos', role: 'menuitem', hidden: true }, icono('foto'), 'Fotos de recetas');
  const enlaceTorneo = el('a', { href: '/admin/torneo', role: 'menuitem', hidden: true }, icono('trofeo'), 'Panel del torneo');
  const enlaceRedes = el('a', { href: '/admin/redes', role: 'menuitem', hidden: true }, icono('calendario'), 'Panel de redes');
  soyAdmin().then((si) => { enlaceAdmin.hidden = !si; enlaceTorneo.hidden = !si; enlaceRedes.hidden = !si; });
  const opciones = el('div', { class: 'usuario-opciones', role: 'menu', hidden: true },
    el('p', { class: 'usuario-nombre' }, el('small', {}, 'Sesión iniciada como'), el('strong', {}, nombre)),
    el('a', { href: '/mis-recetas', role: 'menuitem' }, icono('libro'), 'Mis recetas y favoritas'),
    el('a', { href: '/medallas', role: 'menuitem' }, icono('medalla'), 'Mis medallas'),
    el('a', { href: '/juegos', role: 'menuitem' }, icono('juegos'), 'Juegos'),
    el('a', { href: '/preferencias', role: 'menuitem' }, icono('ajustes'), 'Preferencias'),
    enlaceAdmin,
    enlaceTorneo,
    enlaceRedes,
    el('button', {
      type: 'button', role: 'menuitem',
      onclick: async () => {
        cerrar();
        await salir();
        aviso('Sesión cerrada');
        ir('/');
      },
    }, icono('salir'), 'Salir'));
  const boton = el('button', {
    type: 'button', class: 'usuario-boton', 'aria-haspopup': 'menu', 'aria-expanded': 'false',
    'aria-label': `Cuenta de ${nombre}`, title: nombre,
    onclick: () => (opciones.hidden ? abrir() : cerrar()),
  }, el('span', { class: 'usuario-inicial' }, (nombre[0] || '?').toUpperCase()), el('span', { 'aria-hidden': 'true' }, '▾'));
  const contenedor = el('div', { class: 'usuario-menu' }, boton, opciones);

  function abrir() {
    opciones.hidden = false;
    boton.setAttribute('aria-expanded', 'true');
    setTimeout(() => document.addEventListener('click', fuera));
  }
  function cerrar() {
    opciones.hidden = true;
    boton.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', fuera);
  }
  function fuera(e) { if (!contenedor.contains(e.target) || e.target.closest('a')) cerrar(); }
  contenedor.addEventListener('keydown', (e) => { if (e.key === 'Escape') { cerrar(); boton.focus(); } });
  alCambiarRuta(cerrar);
  return contenedor;
}

// ---------- ruteo (direcciones reales: /receta/…, ver js/rutas.js) ----------

const RUTAS_PRIVADAS = new Set(['mis-recetas', 'nueva', 'editar']);

async function router() {
  nuevaNavegacion();
  contextoReceta(null);
  const hash = location.hash;

  // Supabase vuelve de los emails (confirmación, recuperación) con datos en el #.
  if (/access_token=|type=recovery/.test(hash)) return;
  if (/error_description=/.test(hash)) {
    const params = new URLSearchParams(hash.slice(1));
    mostrar(el('div', { class: 'estado' },
      el('p', {}, `El enlace no es válido o ya venció (${params.get('error_description')}).`),
      el('a', { href: '/entrar' }, 'Volver a intentar')));
    return;
  }

  const [seccion, ...resto] = rutaActual().split('/');
  const param = decodeURIComponent(resto.join('/'));
  document.title = 'A Mano · Cocina latinoamericana a tu medida';
  for (const a of enlacesNav) a.classList.toggle('activo', a.dataset.ruta.split(' ').includes(seccion));
  try {
    switch (seccion) {
      case 'receta': return param ? await vistaReceta(idDeRuta(param)) : await vistaInicio();
      case 'categoria': return param ? await vistaCategoria(param) : await vistaInicio();
      case 'buscar': return param ? await vistaBusqueda(param) : await vistaInicio();
      case 'paises': return await vistaPaises();
      case 'que-tengo': return await vistaDespensa();
      case 'casa': return await vistaCasa();
      case 'faciles': return await vistaFaciles();
      case 'juegos': return param ? await vistaJuego(param) : vistaJuegos();
      case 'medallas': return await vistaMedallas();
      case 'fotos': return await vistaFotos();
      case 'torneo': return await vistaTorneo();
      case 'bases': return vistaBases();
      case 'admin':
        if (param === 'torneo') return await vistaAdminTorneo();
        if (param === 'redes') return await vistaAdminRedes();
        return await vistaInicio();
      case 'preferencias': return vistaPreferencias();
      case 'privacidad': return vistaPrivacidad();
      case 'terminos': return vistaTerminos();
      case 'comunidad': return await vistaComunidad(param);
      case 'perfil':
      case 'autor': return param ? await vistaPerfil(param) : await vistaComunidad();
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
  if (texto) ir(`/buscar/${encodeURIComponent(texto)}`);
});

// Cualquier botón con data-sorpresa lleva a una receta al azar.
document.addEventListener('click', async (e) => {
  if (!e.target.closest('[data-sorpresa]')) return;
  e.preventDefault();
  try {
    const r = await repo.aleatoria();
    ir(rutaReceta(r.id, r.nombre));
  } catch (err) {
    error(err);
  }
});

alCambiarRuta(router);

// Cambió el trato o el país: se redibujan los textos, el menú y la página.
window.addEventListener(CAMBIO_PREFERENCIAS, () => {
  aplicarTextos();
  dibujarMenu(usuario());
  if (rutaActual() !== 'preferencias') router();
});

// Al cambiar la sesión: redibujar el menú y, si estabas en una página privada, refrescarla.
let primeraVez = true;
let ultimoUsuario = null;
alCambiarSesion((u) => {
  const cambio = (u?.id ?? null) !== ultimoUsuario;
  ultimoUsuario = u?.id ?? null;
  dibujarMenu(u);
  if (primeraVez || !cambio) return;
  const seccion = rutaActual().split('/')[0];
  if (RUTAS_PRIVADAS.has(seccion) || seccion === 'receta') router();
});

iniciarRutas();

// Alto real de la cabecera (cambia cuando se acomoda en dos filas): lo usan
// la portada del inicio y el panel lateral.
const cabecera = document.querySelector('.cabecera');
if (cabecera && 'ResizeObserver' in window) {
  new ResizeObserver(() => document.documentElement.style.setProperty('--alto-cabecera', `${cabecera.offsetHeight}px`)).observe(cabecera);
}

(async () => {
  dibujarMenu(null);
  iniciarPanel();
  iniciarAyudante();
  iniciarTemporizadores();
  iniciarMedallas();
  iniciarPreferencias();
  iniciarAnalitica();
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
