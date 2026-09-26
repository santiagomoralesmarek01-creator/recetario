import { el, mostrar, cargando, vigencia } from '../dom.js';
import * as repo from '../repositorio.js';
import { crearImagen, IMG_PLATO_GENERICO } from '../imagenes.js';
import { traducirCategoria } from '../traducciones.js';
import { usuario } from '../auth.js';
import { hayBackend } from '../supabase.js';
import { portada, metaReceta, seccion, grillaRecetas } from './componentes.js';
import { bandera, chipPais, continenteDe, CONTINENTES } from '../paises.js';
import { rutaComunidad } from './comunidad.js';

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
      el('h2', {}, usuario() ? '¿Qué cocinamos hoy?' : 'Guardá tus propias recetas'),
      el('p', {}, usuario()
        ? 'Cargá tus recetas con fotos y compartilas con la comunidad.'
        : 'Creá una cuenta gratis para guardar tus recetas y compartirlas.')),
    el('a', { class: 'boton', href: usuario() ? '#/nueva' : '#/entrar' },
      usuario() ? '+ Nueva receta' : 'Crear cuenta'));

  const totalRecetas = paises.reduce((suma, p) => suma + p.cantidad, 0);
  const buscar = el('input', { type: 'search', placeholder: 'Probá con “empanadas”, “pollo” o “flan”…', 'aria-label': 'Buscar recetas' });
  const portadaInicio = el('section', { class: 'portada-inicio' },
    el('div', { class: 'portada-texto' },
      el('p', { class: 'eyebrow' }, 'Recetario · Cocina casera y del mundo'),
      el('h1', {}, '¿Qué cocinamos ', el('em', {}, 'hoy'), '?'),
      el('p', { class: 'portada-bajada' },
        'Recetas explicadas paso a paso, en español, con modo cocina para ir tildando ingredientes y pasos mientras cocinás.'),
      el('form', {
        class: 'buscador-grande', role: 'search',
        onsubmit: (e) => {
          e.preventDefault();
          const texto = buscar.value.trim();
          if (texto) location.hash = `#/buscar/${encodeURIComponent(texto)}`;
        },
      }, buscar, el('button', { type: 'submit' }, 'Buscar')),
      el('div', { class: 'accesos' },
        el('a', { class: 'acceso', href: '#/que-tengo' }, '🧺 Con lo que tengo'),
        el('a', { class: 'acceso', href: '#/pais/Argentina' }, '🧉 Argentinas'),
        el('a', { class: 'acceso', href: '#/categoria/Dessert' }, '🍰 Postres'),
        el('a', { class: 'acceso', href: '#/categoria/Pasta' }, '🍝 Pastas'),
        el('a', { class: 'acceso', href: '#/categoria/Vegetarian' }, '🥗 Vegetarianas'),
        el('button', { type: 'button', class: 'acceso', 'data-sorpresa': '' }, '🎲 Sorprendeme')),
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
      el('div', { class: 'seccion-titulo' }, el('h2', {}, 'Clásicos de la casa')),
      el('p', { class: 'seccion-bajada' }, 'Las recetas de siempre, probadas y explicadas a nuestra manera.'),
      grillaRecetas(deCasa)),
    paises.length > 0 && el('section', { class: 'seccion' },
      el('div', { class: 'seccion-titulo' },
        el('h2', {}, 'Viajá por la cocina del mundo'),
        el('a', { href: '#/paises' }, `Ver los ${paises.length} países →`)),
      el('div', { class: 'chips-paises' },
        [...paises].sort((a, b) => (b.nombre === 'Argentina') - (a.nombre === 'Argentina')).slice(0, 14).map(chipPais))),
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

export async function vistaCategoria(nombre) {
  const vigente = vigencia();
  cargando();
  const recetas = await repo.deCategoria(nombre);
  if (!vigente()) return;
  mostrar(
    el('a', { class: 'volver', href: '#/' }, '← Inicio'),
    el('h1', {}, traducirCategoria(nombre)),
    el('p', { class: 'meta' }, `${recetas.length} recetas`),
    recetas.length ? grillaRecetas(recetas, { tanda: 24 }) : el('p', { class: 'estado' }, 'Todavía no hay recetas en esta categoría.')
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
    el('p', { class: 'meta' }, `${total} recetas encontradas`),
    seccion('De la casa', deCasa),
    seccion('De la comunidad', deComunidad),
    internacionales.length > 0 && el('section', { class: 'seccion' },
      el('h2', {}, 'Del mundo'),
      grillaRecetas(internacionales, { tanda: 24 })),
    total === 0 && el('p', { class: 'estado' }, 'No encontramos recetas. Probá con otra palabra o con un ingrediente.')
  );
}

export async function vistaPaises() {
  const vigente = vigencia();
  cargando();
  const paises = await repo.paises();
  if (!vigente()) return;
  document.title = 'Países · Recetario';
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
  document.title = `${pais} · Recetario`;
  const total = deCasa.length + deComunidad.length + internacionales.length;
  mostrar(
    el('a', { class: 'volver', href: '#/paises' }, '← Todos los países'),
    el('h1', { class: 'titulo-pais' }, bandera(pais, 'bandera-grande'), pais),
    el('p', { class: 'meta' }, `${total} receta${total === 1 ? '' : 's'}`),
    seccion('De la casa', deCasa),
    seccion('De la comunidad', deComunidad),
    internacionales.length > 0 && el('section', { class: 'seccion' },
      (deCasa.length || deComunidad.length) ? el('h2', {}, 'Del mundo') : null,
      grillaRecetas(internacionales, { tanda: 24 })),
    total === 0 && el('p', { class: 'estado' }, 'Todavía no hay recetas de este país.')
  );
}
