import { el, mostrar, cargando, vigencia } from '../dom.js';
import * as repo from '../repositorio.js';
import { hayBackend } from '../supabase.js';
import { CATEGORIAS } from '../traducciones.js';
import { tarjetaReceta } from './componentes.js';

const POR_PAGINA = 24;

export const rutaComunidad = (categoria = '') => `#/comunidad${categoria ? `/${encodeURIComponent(categoria)}` : ''}`;
export const rutaAutor = (userId) => `#/autor/${encodeURIComponent(userId)}`;

function invitacionVacia(texto) {
  return el('div', { class: 'comunidad-vacia' },
    el('img', { src: 'img/comunidad.svg', alt: '', width: '120', height: '75' }),
    el('p', {}, texto),
    el('a', { class: 'boton', href: '#/nueva' }, 'Subir una receta'));
}

// Grilla que va pidiendo más recetas al servidor con "Ver más".
async function grillaPaginada(filtros, vacia) {
  const grilla = el('div', { class: 'grilla' });
  const boton = el('button', { type: 'button', class: 'boton-secundario' }, 'Ver más');
  const pie = el('div', { class: 'ver-mas' }, boton);
  let desde = 0;

  async function cargar() {
    boton.disabled = true;
    const { recetas, hayMas } = await repo.explorarComunidad({ ...filtros, desde, cantidad: POR_PAGINA });
    grilla.append(...recetas.map(tarjetaReceta));
    desde += recetas.length;
    pie.hidden = !hayMas;
    boton.disabled = false;
    return recetas.length;
  }
  boton.addEventListener('click', () => cargar().catch((err) => { boton.disabled = false; console.error(err); }));

  const primeras = await cargar();
  return primeras ? el('div', {}, grilla, pie) : vacia;
}

export async function vistaComunidad(categoria = '') {
  const vigente = vigencia();
  document.title = 'Comunidad · Recetario';
  if (!hayBackend) {
    mostrar(el('p', { class: 'estado' }, 'Las recetas de la comunidad todavía no están disponibles.'));
    return;
  }
  cargando();

  let textoBusqueda = '';
  let pedido = 0;
  const resultados = el('div');

  async function actualizar() {
    const mio = ++pedido;
    resultados.replaceChildren(el('p', { class: 'estado' }, 'Cargando…'));
    const contenido = await grillaPaginada(
      { categoria, texto: textoBusqueda },
      textoBusqueda || categoria
        ? el('p', { class: 'estado' }, 'No hay recetas de la comunidad con ese filtro todavía.')
        : invitacionVacia('Todavía nadie compartió recetas. ¡Subí la primera!'),
    );
    if (mio === pedido) resultados.replaceChildren(contenido);
  }

  let espera;
  const buscador = el('input', {
    type: 'search', placeholder: 'Buscar en la comunidad…', 'aria-label': 'Buscar en las recetas de la comunidad',
    oninput: (e) => {
      clearTimeout(espera);
      espera = setTimeout(() => { textoBusqueda = e.target.value.trim(); actualizar(); }, 300);
    },
  });

  const chips = el('nav', { class: 'chips-filtro', 'aria-label': 'Filtrar por categoría' },
    el('a', { href: rutaComunidad(), class: categoria ? '' : 'activa' }, 'Todas'),
    Object.entries(CATEGORIAS).map(([valor, texto]) =>
      el('a', { href: rutaComunidad(valor), class: categoria === valor ? 'activa' : '' }, texto)));

  await actualizar();
  if (!vigente()) return;
  mostrar(
    el('a', { class: 'volver', href: '#/' }, '← Inicio'),
    el('header', { class: 'comunidad-cabecera' },
      el('div', {},
        el('h1', {}, 'Recetas de la comunidad'),
        el('p', { class: 'meta' }, 'Recetas caseras que compartió la gente del Recetario.')),
      el('a', { class: 'boton', href: '#/nueva' }, 'Subir mi receta')),
    el('div', { class: 'comunidad-filtros' }, buscador, chips),
    resultados,
  );
}

export async function vistaAutor(userId) {
  const vigente = vigencia();
  if (!hayBackend) { mostrar(el('p', { class: 'estado' }, 'No disponible.')); return; }
  cargando();
  const { recetas } = await repo.explorarComunidad({ autor: userId, cantidad: 1 });
  const nombre = recetas[0]?.autor || 'Cocinero/a';
  const contenido = await grillaPaginada({ autor: userId },
    el('p', { class: 'estado' }, 'Esta persona todavía no compartió recetas públicas.'));
  if (!vigente()) return;
  document.title = `Recetas de ${nombre} · Recetario`;
  mostrar(
    el('a', { class: 'volver', href: rutaComunidad() }, '← Comunidad'),
    el('h1', {}, `Recetas de ${nombre}`),
    contenido,
  );
}
