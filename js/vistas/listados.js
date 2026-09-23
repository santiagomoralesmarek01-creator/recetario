import { el, mostrar, cargando, vigencia } from '../dom.js';
import * as repo from '../repositorio.js';
import { crearImagen, IMG_PLATO_GENERICO } from '../imagenes.js';
import { traducirCategoria } from '../traducciones.js';
import { usuario } from '../auth.js';
import { hayBackend } from '../supabase.js';
import { portada, metaReceta, seccion, grillaRecetas } from './componentes.js';

export async function vistaInicio() {
  const vigente = vigencia();
  cargando();
  const [deCasa, deComunidad, categorias, destacada] = await Promise.all([
    repo.recetasDeLaCasa(),
    repo.recetasDeLaComunidad(),
    repo.categorias(),
    repo.aleatoria().catch(() => null),
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
    recetas.length ? grillaRecetas(recetas) : el('p', { class: 'estado' }, 'Todavía no hay recetas en esta categoría.')
  );
}

export async function vistaBusqueda(texto) {
  const vigente = vigencia();
  document.getElementById('busqueda').value = texto;
  cargando(`Buscando “${texto}”…`);
  const { termino, deCasa, deComunidad, internacionales, porIngrediente } = await repo.buscar(texto);
  if (!vigente()) return;
  const total = deCasa.length + deComunidad.length + internacionales.length;

  mostrar(
    el('a', { class: 'volver', href: '#/' }, '← Inicio'),
    el('h1', {}, `Resultados para “${texto}”`),
    el('p', { class: 'meta' }, `${total} recetas encontradas`),
    seccion('De la casa', deCasa),
    seccion('De la comunidad', deComunidad),
    internacionales.length > 0 && el('section', { class: 'seccion' },
      el('h2', {}, porIngrediente ? 'Del mundo, con ese ingrediente' : 'Del mundo'),
      termino.toLowerCase() !== texto.trim().toLowerCase() &&
        el('p', { class: 'meta' }, `Buscado como “${termino}” (estas recetas están en inglés).`),
      grillaRecetas(internacionales)),
    total === 0 && el('p', { class: 'estado' }, 'No encontramos recetas. Probá con otra palabra o con un ingrediente.')
  );
}
