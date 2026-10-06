import { el, mostrar, cargando, vigencia } from '../dom.js';
import * as repo from '../repositorio.js';
import { hayBackend } from '../supabase.js';
import { CATEGORIAS } from '../traducciones.js';
import { tarjetaReceta } from './componentes.js';
import { marcaVerificada } from '../verificadas.js';
import { perfilPublico } from '../actividad.js';
import { evaluar } from '../medallas.js';
import { tarjeta } from './medallas.js';
import { traducirOrigen } from '../traducciones.js';
import { bandera } from '../paises.js';
import { icono } from '../iconos.js';
import { avisoRecetaDelMes, vidrieraRecetasDelMes } from './torneo.js';

const POR_PAGINA = 24;

export const rutaComunidad = (categoria = '') => `/comunidad${categoria ? `/${encodeURIComponent(categoria)}` : ''}`;
export const rutaPerfil = (userId) => `/perfil/${encodeURIComponent(userId)}`;
export const rutaAutor = rutaPerfil;

function invitacionVacia(texto) {
  return el('div', { class: 'comunidad-vacia' },
    el('img', { src: 'img/comunidad.svg', alt: '', width: '120', height: '75' }),
    el('p', {}, texto),
    el('a', { class: 'boton', href: '/nueva' }, 'Subir una receta'));
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
  document.title = 'Comunidad · A Mano';
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
    el('a', { class: 'volver', href: '/' }, '← Inicio'),
    el('header', { class: 'comunidad-cabecera' },
      el('div', {},
        el('h1', {}, 'Recetas de la comunidad'),
        el('p', { class: 'meta' }, 'Recetas caseras que compartió la gente de A Mano.')),
      el('a', { class: 'boton', href: '/nueva' }, 'Subir mi receta')),
    !categoria && avisoRecetaDelMes(),
    !categoria && vidrieraRecetasDelMes(),
    el('div', { class: 'comunidad-filtros' }, buscador, chips),
    resultados,
  );
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Perfil de una persona: sus medallas, algunos números y las recetas que publicó.
export async function vistaPerfil(userId) {
  const vigente = vigencia();
  if (!hayBackend || !UUID.test(userId)) { mostrar(el('p', { class: 'estado' }, 'No encontramos este perfil.')); return; }
  cargando();
  const [perfil, { recetas }] = await Promise.all([
    perfilPublico(userId),
    repo.explorarComunidad({ autor: userId, cantidad: 1 }),
  ]);
  // El nombre de las recetas es el que eligió al publicarlas; si no hay, el de la cuenta.
  const nombre = recetas[0]?.autor || perfil?.nombre || 'Cocinero/a';
  const contenido = await grillaPaginada({ autor: userId },
    el('p', { class: 'estado' }, perfil?.soy_yo ? 'Todavía no publicaste recetas.' : 'Todavía no publicó recetas.'));
  if (!vigente()) return;
  document.title = `${nombre} · A Mano`;

  const ganadas = perfil ? evaluar(perfil).filter((m) => m.ganada) : [];
  const [anio, mes] = (perfil?.desde || '').split('-').map(Number);
  const detalle = [
    perfil?.pais && [bandera(perfil.pais), ` ${traducirOrigen(perfil.pais)}`],
    anio && mes && `En A Mano desde ${MESES[mes - 1]} de ${anio}`,
  ].filter(Boolean);

  mostrar(
    el('a', { class: 'volver', href: rutaComunidad() }, '← Comunidad'),
    el('header', { class: 'perfil-cabecera' },
      el('span', { class: 'perfil-inicial', 'aria-hidden': 'true' }, nombre.trim().charAt(0).toUpperCase() || '?'),
      el('div', {},
        el('h1', {}, nombre, marcaVerificada(userId)),
        detalle.map((d) => el('p', { class: 'meta perfil-detalle' }, d)),
        perfil?.soy_yo && el('p', { class: 'meta' }, 'Este es tu perfil: así lo ven los demás. ', el('a', { href: '/medallas' }, 'Ver mis medallas')))),
    perfil && el('ul', { class: 'cifras medallas-cifras perfil-cifras' },
      [
        ['medalla', ganadas.length, `medalla${ganadas.length === 1 ? '' : 's'}`],
        ['editar', perfil.recetas_subidas, `receta${perfil.recetas_subidas === 1 ? '' : 's'} subida${perfil.recetas_subidas === 1 ? '' : 's'}`],
        ['corazon', perfil.me_gusta_recibidos, 'me gusta recibidos'],
        ['modo-cocina', perfil.recetas_cocinadas, `receta${perfil.recetas_cocinadas === 1 ? '' : 's'} cocinada${perfil.recetas_cocinadas === 1 ? '' : 's'}`],
      ].map(([simbolo, n, texto]) => el('li', {}, el('strong', {}, icono(simbolo), ` ${Number(n) || 0}`), el('span', {}, texto)))),
    perfil && el('section', { class: 'seccion' },
      el('h2', {}, 'Medallas'),
      ganadas.length
        ? el('ul', { class: 'grilla-medallas' }, ganadas.map(tarjeta))
        : el('p', { class: 'meta' }, perfil.soy_yo ? 'Todavía no ganaste medallas.' : 'Todavía no ganó medallas.')),
    el('section', { class: 'seccion' },
      el('h2', {}, 'Recetas publicadas'),
      contenido),
  );
}

export const vistaAutor = vistaPerfil;
