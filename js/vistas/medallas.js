// Página "Mis medallas": todas las medallas, las ganadas en color y el
// progreso de las que faltan.
import { el, mostrar, cargando, vigencia } from '../dom.js';
import { usuario, pedirLogin, nombreVisible } from '../auth.js';
import { hayBackend } from '../supabase.js';
import { misLogros } from '../actividad.js';
import { evaluar, MEDALLAS, rachaPlatoDelDia, revisarMedallas } from '../medallas.js';
import { sinBackend } from './cuenta.js';
import { sello } from '../sello.js';
import { icono } from '../iconos.js';

function tarjeta(m) {
  return el('li', { class: `medalla${m.ganada ? ' ganada' : ''}` },
    sello(m, { clase: 'medalla-sello' }),
    el('strong', {}, m.nombre),
    el('span', { class: 'medalla-descripcion' }, m.descripcion),
    m.ganada
      ? el('span', { class: 'medalla-estado' }, icono('tilde'), ' Conseguida')
      : el('span', { class: 'medalla-progreso', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': m.meta, 'aria-valuenow': m.actual },
        el('span', { class: 'medalla-barra' }, el('span', { style: `width: ${Math.round((m.actual / m.meta) * 100)}%` })),
        el('small', {}, `${m.actual}/${m.meta}`)));
}

export async function vistaMedallas() {
  if (!hayBackend) return sinBackend();
  document.title = 'Mis medallas · A Mano';
  if (!usuario()) {
    mostrar(el('section', { class: 'medallas-invitacion estado' },
      el('div', { class: 'medallas-invitacion-iconos', 'aria-hidden': 'true' }, MEDALLAS.slice(0, 6).map((m) => sello({ ...m, ganada: true }))),
      el('h1', {}, 'Ganá medallas cocinando'),
      el('p', {}, `Hay ${MEDALLAS.length} medallas para conseguir: subiendo recetas, dándoles me gusta a otras, completando recetas en la cocina y jugando.`),
      el('button', { type: 'button', class: 'boton', onclick: () => pedirLogin('/medallas') }, 'Entrar o crear cuenta')));
    return;
  }
  const vigente = vigencia();
  cargando();
  let logros;
  try {
    logros = await misLogros();
  } catch (err) {
    if (!vigente()) return;
    mostrar(el('p', { class: 'estado' }, err.message));
    return;
  }
  if (!vigente()) return;
  revisarMedallas();
  const medallas = evaluar(logros);
  const ganadas = medallas.filter((m) => m.ganada).length;
  const grupos = [...new Set(medallas.map((m) => m.grupo))];
  const racha = rachaPlatoDelDia(logros.dias_plato);

  mostrar(
    el('section', { class: 'medallas-cabecera' },
      el('div', {},
        el('p', { class: 'portada-antetitulo' }, nombreVisible()),
        el('h1', {}, 'Mis medallas'),
        el('p', { class: 'meta' }, `Conseguiste ${ganadas} de ${medallas.length}.`)),
      el('div', { class: 'medallas-total', 'aria-hidden': 'true' },
        sello({ icono: 'medalla', ganada: ganadas > 0 }),
        el('strong', {}, ganadas))),
    el('ul', { class: 'cifras medallas-cifras' },
      [
        ['editar', logros.recetas_subidas, 'recetas subidas'],
        ['corazon', logros.me_gusta_dados, 'me gusta dados'],
        ['modo-cocina', logros.recetas_cocinadas, 'recetas cocinadas'],
        ['fuego', racha, `día${racha === 1 ? '' : 's'} de racha`],
      ].map(([simbolo, n, texto]) => el('li', {}, el('strong', {}, icono(simbolo), ` ${n}`), el('span', {}, texto)))),
    grupos.map((g) => el('section', { class: 'seccion' },
      el('h2', {}, g),
      el('ul', { class: 'grilla-medallas' }, medallas.filter((m) => m.grupo === g).map(tarjeta)))),
    el('p', { class: 'meta medallas-ayuda' },
      '¿Cómo se consiguen? Subiendo recetas desde "Nueva", marcando con el corazón las recetas que gustan, tildando todos los pasos al cocinar una receta y jugando en ',
      el('a', { href: '/juegos' }, 'Juegos'), '.'));
}
