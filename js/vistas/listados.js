import { el, mostrar, cargando, vigencia } from '../dom.js';
import * as repo from '../repositorio.js';
import { crearImagen, IMG_PLATO_GENERICO } from '../imagenes.js';
import { traducirCategoria } from '../traducciones.js';
import { usuario } from '../auth.js';
import { hayBackend } from '../supabase.js';
import { portada, metaReceta, seccion, grillaRecetas } from './componentes.js';
import { bandera, chipPais, continenteDe, CONTINENTES } from '../paises.js';

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

  mostrar(
    destacada && el('section', { class: 'destacada' },
      portada(destacada, { clase: 'destacada-img' }),
      el('div', {},
        el('p', { class: 'eyebrow' }, 'Receta del momento'),
        el('h1', {}, destacada.nombre),
        el('p', { class: 'meta' }, `${destacada.ingredientes.length} ingredientes · ${metaReceta(destacada)}`),
        el('a', { class: 'boton', href: `#/receta/${destacada.id}` }, 'Ver receta'))),
    seccion('Recetas de la casa', deCasa),
    paises.length > 0 && el('section', { class: 'seccion' },
      el('div', { class: 'seccion-titulo' },
        el('h2', {}, 'Recetas por país'),
        el('a', { href: '#/paises' }, `Ver los ${paises.length} países →`)),
      el('div', { class: 'chips-paises' },
        [...paises].sort((a, b) => (b.nombre === 'Argentina') - (a.nombre === 'Argentina')).slice(0, 14).map(chipPais))),
    seccion('De la comunidad', deComunidad),
    invitacion,
    categorias.length > 0 && el('section', { class: 'seccion' },
      el('h2', {}, 'Recetas del mundo por categoría'),
      el('div', { class: 'grilla grilla-categorias' },
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
