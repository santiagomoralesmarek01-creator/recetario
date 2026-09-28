import { el, mostrar, cargando, vigencia } from '../dom.js';
import * as repo from '../repositorio.js';
import { crearImagen, IMG_PLATO_GENERICO } from '../imagenes.js';
import { traducirCategoria } from '../traducciones.js';
import { usuario } from '../auth.js';
import { hayBackend } from '../supabase.js';
import { portada, metaReceta, grillaRecetas, listadoFiltrable } from './componentes.js';
import { bandera, chipPais, continenteDe, CONTINENTES, LATINOAMERICA } from '../paises.js';
import { rutaComunidad } from './comunidad.js';
import { icono } from '../iconos.js';
import { t } from '../textos.js';

// "¿Qué hay a mano hoy?" → ['¿Qué hay a mano ', <em>hoy</em>, '?'] (la palabra va en cursiva).
export function conPalabraDestacada(texto, palabra) {
  const i = texto.lastIndexOf(palabra);
  return i < 0 ? [texto] : [texto.slice(0, i), el('em', {}, palabra), texto.slice(i + palabra.length)];
}

export async function vistaInicio() {
  const vigente = vigencia();
  cargando();
  const [deCasa, deComunidad, categorias, destacada, paises] = await Promise.all([
    repo.recetasDeLaCasa(),
    repo.recetasDeLaComunidad(),
    repo.categorias(),
    repo.aleatoria().catch(() => null),
    repo.paises(),
  ]);
  if (!vigente()) return;

  const invitacion = hayBackend && el('section', { class: 'invitacion' },
    el('div', {},
      el('h2', {}, usuario() ? t('invitacion.titulo-usuario') : t('invitacion.titulo')),
      el('p', {}, usuario() ? t('invitacion.texto-usuario') : t('invitacion.texto'))),
    el('a', { class: 'boton', href: usuario() ? '#/nueva' : '#/entrar' },
      usuario() ? t('invitacion.cta-usuario') : t('invitacion.cta')));

  const totalRecetas = paises.reduce((suma, p) => suma + p.cantidad, 0);
  const buscar = el('input', { type: 'search', placeholder: t('inicio.buscar-ejemplo'), 'aria-label': 'Buscar recetas' });
  const portadaInicio = el('section', { class: 'portada-inicio' },
    el('div', { class: 'portada-texto' },
      el('p', { class: 'eyebrow' }, 'Cocina latinoamericana a tu medida'),
      el('h1', {}, ...conPalabraDestacada(t('buscar.titulo'), 'hoy')),
      el('p', { class: 'portada-bajada' },
        t('inicio.bajada')),
      el('div', { class: 'portada-acciones' },
        el('a', { class: 'boton boton-grande', href: '#/que-tengo' }, t('inicio.cta')),
        el('span', { class: 'meta' }, t('inicio.o-buscar'))),
      el('form', {
        class: 'buscador-grande', role: 'search',
        onsubmit: (e) => {
          e.preventDefault();
          const texto = buscar.value.trim();
          if (texto) location.hash = `#/buscar/${encodeURIComponent(texto)}`;
        },
      }, buscar, el('button', { type: 'submit' }, 'Buscar')),
      el('div', { class: 'accesos' },
        el('a', { class: 'acceso', href: '#/faciles' }, icono('faciles'), 'Fáciles'),
        el('a', { class: 'acceso acceso-destacado', href: '#/juegos/plato-del-dia' }, icono('plato'), 'Plato del día'),
        el('a', { class: 'acceso', href: '#/pais/Argentina' }, icono('ubicacion'), 'Argentinas'),
        el('a', { class: 'acceso', href: '#/categoria/Dessert' }, icono('postre'), 'Postres'),
        el('a', { class: 'acceso', href: '#/categoria/Pasta' }, icono('pasta'), 'Pastas'),
        el('a', { class: 'acceso', href: '#/categoria/Vegetarian' }, icono('hoja'), 'Vegetarianas'),
        el('button', { type: 'button', class: 'acceso', 'data-sorpresa': '' }, icono('sorpresa'), t('inicio.azar'))),
      totalRecetas > 0 && el('div', { class: 'cifras' },
        el('div', {}, el('strong', {}, `${Math.floor(totalRecetas / 50) * 50}+`), el('span', {}, 'recetas')),
        el('div', {}, el('strong', {}, String(paises.length)), el('span', {}, 'países')),
        el('div', {}, el('strong', {}, '100%'), el('span', {}, 'en español')))),
    destacada && el('a', { class: 'portada-destacada', href: `#/receta/${destacada.id}` },
      portada(destacada),
      el('div', { class: 'portada-destacada-texto' },
        el('p', { class: 'eyebrow' }, 'Receta del momento'),
        el('h2', {}, destacada.nombre),
        el('p', { class: 'meta' }, `${destacada.ingredientes.length} ingredientes · ${metaReceta(destacada)}`),
        el('span', { class: 'portada-destacada-ir' }, 'Ver receta →'))));

  mostrar(
    portadaInicio,
    deCasa.length > 0 && el('section', { class: 'seccion' },
      el('div', { class: 'seccion-titulo' },
        el('h2', {}, 'Clásicos latinoamericanos'),
        deCasa.length > 8 && el('a', { href: '#/casa' }, `Ver las ${deCasa.length} →`)),
      el('p', { class: 'seccion-bajada' }, 'Las recetas de siempre de nuestra región, probadas y explicadas a nuestra manera.'),
      grillaRecetas(elegirDelDia(deCasa, 8))),
    paises.length > 0 && el('section', { class: 'seccion' },
      el('div', { class: 'seccion-titulo' },
        el('h2', {}, 'Viajá por la cocina de Latinoamérica y el mundo'),
        el('a', { href: '#/paises' }, `Ver los ${paises.length} países →`)),
      el('div', { class: 'chips-paises' },
        // Primero Latinoamérica (Argentina adelante) y después el resto del mundo.
        [...paises].sort((a, b) => (b.nombre === 'Argentina') - (a.nombre === 'Argentina')
          || LATINOAMERICA.has(b.nombre) - LATINOAMERICA.has(a.nombre)
          || b.cantidad - a.cantidad).slice(0, 18).map(chipPais))),
    hayBackend && el('section', { class: 'seccion' },
      el('div', { class: 'seccion-titulo' },
        el('h2', {}, 'Recetas de la comunidad'),
        el('a', { href: rutaComunidad() }, deComunidad.length ? 'Ver todas →' : 'Ir a la comunidad →')),
      deComunidad.length
        ? grillaRecetas(deComunidad.slice(0, 10))
        : el('p', { class: 'meta' }, 'Todavía nadie compartió recetas. ¡Podés ser la primera persona en subir una!')),
    invitacion,
    categorias.length > 0 && el('section', { class: 'seccion' },
      el('h2', {}, 'Explorá por categoría'),
      el('div', { class: 'grilla grilla-categorias' },
        hayBackend && el('a', { class: 'tarjeta categoria categoria-comunidad', href: rutaComunidad() },
          el('img', { src: 'img/comunidad.svg', alt: '' }),
          el('h3', {}, 'Comunidad')),
        categorias.map((c) =>
          el('a', { class: 'tarjeta categoria', href: `#/categoria/${encodeURIComponent(c.nombre)}` },
            crearImagen(c.imagen, c.nombre, IMG_PLATO_GENERICO),
            el('h3', {}, traducirCategoria(c.nombre))))))
  );
}

// Una selección que cambia cada día (así la portada no muestra siempre las mismas).
function elegirDelDia(lista, cantidad) {
  if (lista.length <= cantidad) return lista;
  const dia = Math.floor(Date.now() / 86400000);
  const inicio = (dia * cantidad) % lista.length;
  return [...lista.slice(inicio), ...lista.slice(0, inicio)].slice(0, cantidad);
}

export async function vistaCategoria(nombre) {
  const vigente = vigencia();
  cargando();
  const recetas = await repo.deCategoria(nombre);
  if (!vigente()) return;
  mostrar(
    el('a', { class: 'volver', href: '#/' }, '← Inicio'),
    el('h1', {}, traducirCategoria(nombre)),
    listadoFiltrable([{ recetas, tanda: 24 }], { vacio: 'Todavía no hay recetas en esta categoría.' })
  );
}

export async function vistaCasa() {
  const vigente = vigencia();
  cargando();
  const recetas = await repo.recetasDeLaCasa();
  if (!vigente()) return;
  document.title = 'Clásicos latinoamericanos · A Mano';
  mostrar(
    el('a', { class: 'volver', href: '#/' }, '← Inicio'),
    el('h1', {}, 'Clásicos latinoamericanos'),
    el('p', { class: 'meta' }, 'Recetas de toda la región, escritas y probadas para cocinar con lo que se consigue acá.'),
    listadoFiltrable([{ recetas, tanda: 24 }])
  );
}

export async function vistaFaciles() {
  const vigente = vigencia();
  cargando();
  const todas = await repo.todasLasRecetas();
  if (!vigente()) return;
  document.title = 'Recetas fáciles · A Mano';
  const faciles = todas.filter((r) => r.dificultad === 1 && !r.dificiles);
  mostrar(
    el('a', { class: 'volver', href: '#/' }, '← Inicio'),
    el('h1', {}, 'Fáciles y con ingredientes de todos los días'),
    el('p', { class: 'meta' }, 'Recetas con pocos pasos, sin técnicas complicadas y con ingredientes que se consiguen en cualquier supermercado de Latinoamérica.'),
    listadoFiltrable([{ recetas: faciles, tanda: 24 }], { dificultad: false })
  );
}

export async function vistaBusqueda(texto) {
  const vigente = vigencia();
  document.getElementById('busqueda').value = texto;
  cargando(`Buscando “${texto}”…`);
  const { deCasa, deComunidad, internacionales } = await repo.buscar(texto);
  if (!vigente()) return;
  const total = deCasa.length + deComunidad.length + internacionales.length;

  mostrar(
    el('a', { class: 'volver', href: '#/' }, '← Inicio'),
    el('h1', {}, `Resultados para “${texto}”`),
    total === 0
      ? el('p', { class: 'estado' }, 'No encontramos recetas. Probá con otra palabra o con un ingrediente.')
      : listadoFiltrable([
        { titulo: 'De la casa', recetas: deCasa },
        { titulo: 'De la comunidad', recetas: deComunidad },
        { titulo: 'Del mundo', recetas: internacionales, tanda: 24 },
      ])
  );
}

export async function vistaPaises() {
  const vigente = vigencia();
  cargando();
  const paises = await repo.paises();
  if (!vigente()) return;
  document.title = 'Países · A Mano';
  const porContinente = new Map(CONTINENTES.map((c) => [c, []]));
  for (const p of paises) porContinente.get(continenteDe(p.nombre)).push(p);
  const total = paises.reduce((suma, p) => suma + p.cantidad, 0);

  mostrar(
    el('a', { class: 'volver', href: '#/' }, '← Inicio'),
    el('h1', {}, 'Recetas por país'),
    el('p', { class: 'meta' }, `${total} recetas de ${paises.length} países`),
    [...porContinente].filter(([, lista]) => lista.length).map(([continente, lista]) =>
      el('section', { class: 'seccion' },
        el('h2', {}, continente),
        el('div', { class: 'chips-paises' },
          lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map(chipPais))))
  );
}

export async function vistaPais(pais) {
  const vigente = vigencia();
  cargando();
  const { deCasa, deComunidad, internacionales } = await repo.dePais(pais);
  if (!vigente()) return;
  document.title = `${pais} · A Mano`;
  const total = deCasa.length + deComunidad.length + internacionales.length;
  const soloDelMundo = !deCasa.length && !deComunidad.length;
  mostrar(
    el('a', { class: 'volver', href: '#/paises' }, '← Todos los países'),
    el('h1', { class: 'titulo-pais' }, bandera(pais, 'bandera-grande'), pais),
    total === 0
      ? el('p', { class: 'estado' }, 'Todavía no hay recetas de este país.')
      : listadoFiltrable([
        { titulo: 'De la casa', recetas: deCasa },
        { titulo: 'De la comunidad', recetas: deComunidad },
        { titulo: soloDelMundo ? null : 'Del mundo', recetas: internacionales, tanda: 24 },
      ])
  );
}
