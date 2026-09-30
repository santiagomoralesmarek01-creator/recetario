// Medallas: se calculan a partir de la actividad guardada en Supabase
// (mis_logros), así no hace falta una tabla aparte y no se pueden desincronizar.
import { el } from './dom.js';
import { usuario, alCambiarSesion } from './auth.js';
import { misLogros, alCambiarActividad } from './actividad.js';
import { t } from './textos.js';
import { sello } from './sello.js';
import { evento } from './analitica.js';

const juego = (l, tipo) => l.juegos?.[tipo] || { partidas: 0, mejor: 0, total: 0 };
const partidasTotales = (l) => Object.values(l.juegos || {}).reduce((s, j) => s + Number(j.partidas || 0), 0);

// Días seguidos acertando el plato del día, terminando hoy o ayer (hora de Argentina).
export function rachaPlatoDelDia(dias = [], hoy = diaArgentina()) {
  const set = new Set(dias);
  let dia = set.has(hoy) ? hoy : sumarDias(hoy, -1);
  let racha = 0;
  while (set.has(dia)) { racha++; dia = sumarDias(dia, -1); }
  return racha;
}

export function diaArgentina(fecha = new Date()) {
  return new Date(fecha.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

export function sumarDias(dia, n) {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// valor(l) → número actual; meta → número a alcanzar.
export const MEDALLAS = [
  { id: 'bienvenida', icono: 'plato', nombre: 'Bienvenida', descripcion: 'Crear tu cuenta en A Mano', grupo: 'Comunidad', valor: () => 1, meta: 1 },
  { id: 'receta-1', icono: 'editar', nombre: 'Primera receta', descripcion: 'Subir tu primera receta', grupo: 'Comunidad', valor: (l) => l.recetas_subidas, meta: 1 },
  { id: 'receta-5', icono: 'gorro', nombre: 'Chef de la casa', descripcion: 'Subir 5 recetas', grupo: 'Comunidad', valor: (l) => l.recetas_subidas, meta: 5 },
  { id: 'receta-15', icono: 'libro', especial: true, nombre: 'Gran recetario', descripcion: 'Subir 15 recetas', grupo: 'Comunidad', valor: (l) => l.recetas_subidas, meta: 15 },
  { id: 'recibidos-5', icono: 'corazon', nombre: 'Receta querida', descripcion: 'Recibir 5 me gusta en tus recetas', grupo: 'Comunidad', valor: (l) => l.me_gusta_recibidos, meta: 5 },
  { id: 'recibidos-25', icono: 'trofeo', especial: true, nombre: 'Estrella de la comunidad', descripcion: 'Recibir 25 me gusta en tus recetas', grupo: 'Comunidad', valor: (l) => l.me_gusta_recibidos, meta: 25 },
  { id: 'like-1', icono: 'corazon', nombre: 'Primer me gusta', descripcion: 'Darle me gusta a una receta', grupo: 'Me gusta', valor: (l) => l.me_gusta_dados, meta: 1 },
  { id: 'like-10', icono: 'guardada', nombre: 'Fan de la cocina', descripcion: 'Darle me gusta a 10 recetas', grupo: 'Me gusta', valor: (l) => l.me_gusta_dados, meta: 10 },
  { id: 'like-50', icono: 'guardada', nombre: 'Corazón gourmet', descripcion: 'Darle me gusta a 50 recetas', grupo: 'Me gusta', valor: (l) => l.me_gusta_dados, meta: 50 },
  { id: 'cocinada-1', icono: 'modo-cocina', nombre: 'Manos a la obra', descripcion: 'Completar todos los pasos de una receta', grupo: 'En la cocina', valor: (l) => l.recetas_cocinadas, meta: 1 },
  { id: 'cocinada-5', icono: 'olla', nombre: 'Cocinero constante', descripcion: 'Completar 5 recetas distintas', grupo: 'En la cocina', valor: (l) => l.recetas_cocinadas, meta: 5 },
  { id: 'cocinada-20', icono: 'gorro', especial: true, nombre: 'Maestro de la cocina', descripcion: 'Completar 20 recetas distintas', grupo: 'En la cocina', valor: (l) => l.recetas_cocinadas, meta: 20 },
  { id: 'jugar-1', icono: 'juegos', nombre: 'A jugar', descripcion: 'Jugar tu primera partida', grupo: 'Juegos', valor: partidasTotales, meta: 1 },
  { id: 'jugar-25', icono: 'dificultad', nombre: 'Fanático de los juegos', descripcion: 'Jugar 25 partidas', grupo: 'Juegos', valor: partidasTotales, meta: 25 },
  { id: 'plato-1', icono: 'plato', nombre: 'Buen paladar', descripcion: 'Adivinar un Plato del día', grupo: 'Juegos', valor: (l) => (l.dias_plato || []).length, meta: 1 },
  { id: 'racha-3', icono: 'fuego', nombre: 'En racha', descripcion: 'Adivinar el Plato del día 3 días seguidos', grupo: 'Juegos', valor: (l) => rachaPlatoDelDia(l.dias_plato), meta: 3 },
  { id: 'racha-7', icono: 'fuego', especial: true, nombre: 'Semana perfecta', descripcion: 'Adivinar el Plato del día 7 días seguidos', grupo: 'Juegos', valor: (l) => rachaPlatoDelDia(l.dias_plato), meta: 7 },
  { id: 'plato-30', icono: 'libro', especial: true, nombre: 'Enciclopedia culinaria', descripcion: 'Adivinar 30 Platos del día', grupo: 'Juegos', valor: (l) => (l.dias_plato || []).length, meta: 30 },
  { id: 'pais-800', icono: 'pais', nombre: 'Trotamundos', descripcion: 'Hacer 800 puntos en Adiviná el país (en normal o difícil)', grupo: 'Juegos', valor: (l) => juego(l, 'juego-pais').mejor, meta: 800 },
  { id: 'falta-1000', icono: 'rompecabezas', nombre: 'Ojo de chef', descripcion: 'Acertar las 10 de ¿Qué le falta? en difícil', grupo: 'Juegos', valor: (l) => juego(l, 'juego-falta').mejor, meta: 1000 },
  { id: 'armar-800', icono: 'olla', nombre: 'Arquitecto del sabor', descripcion: 'Hacer 800 puntos en Armá el plato (en normal o difícil)', grupo: 'Juegos', valor: (l) => juego(l, 'juego-armar').mejor, meta: 800 },
];

// Medallas únicas: reconocimientos que se dan a mano a una cuenta (tabla
// medallas_unicas). Sólo aparecen para quien las tiene.
function unicas(logros) {
  return (logros.unicas || []).map((u) => ({
    id: `unica-${u.id}`, icono: u.icono || 'trofeo', nombre: u.nombre, descripcion: u.descripcion || '',
    grupo: 'Únicas', unica: true, especial: true, actual: 1, meta: 1, ganada: true,
  }));
}

export function evaluar(logros) {
  return [...unicas(logros), ...MEDALLAS.map((m) => {
    const valor = Number(m.valor(logros) || 0);
    return { ...m, actual: Math.min(valor, m.meta), ganada: valor >= m.meta };
  })];
}

// ---------- aviso de medalla nueva ----------

const claveGanadas = (id) => `recetario:medallas:${id}`;

function leerGanadas(id) {
  try { return JSON.parse(localStorage.getItem(claveGanadas(id)) || 'null'); } catch { return null; }
}

function guardarGanadas(id, ids) {
  try { localStorage.setItem(claveGanadas(id), JSON.stringify(ids)); } catch { /* sin almacenamiento */ }
}

function mostrarAviso(medallas) {
  const m = medallas[0];
  const nodo = el('a', { class: 'aviso-medalla', href: '/medallas', role: 'status' },
    sello(m, { clase: 'sello-estampa' }),
    el('span', {},
      el('small', {}, medallas.length > 1 ? t('medalla.nuevas', { n: medallas.length }) : 'Nueva medalla'),
      el('strong', {}, m.nombre),
      el('span', {}, m.descripcion)));
  // Confeti sólo en logros grandes (la racha de 7 días y las medallas únicas).
  if (medallas.some(conConfeti)) nodo.append(confeti());
  for (const x of medallas) evento('Medalla', { medalla: x.id });
  document.body.append(nodo);
  requestAnimationFrame(() => nodo.classList.add('visible'));
  setTimeout(() => { nodo.classList.remove('visible'); setTimeout(() => nodo.remove(), 400); }, 5000);
}

const CON_CONFETI = new Set(['racha-7']);
const conConfeti = (m) => CON_CONFETI.has(m.id) || m.unica;

function confeti() {
  const capa = el('span', { class: 'confeti', 'aria-hidden': 'true' });
  const colores = ['var(--maiz)', '#C8401F', '#1F4D3A'];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const d = 60 + (i % 3) * 22;
    capa.append(el('i', { style: `--x: ${Math.round(Math.cos(a) * d)}px; --y: ${Math.round(Math.sin(a) * d)}px; background: ${colores[i % 3]}; border-radius: ${i % 2 ? '50%' : '2px'}` }));
  }
  return capa;
}

let revisando = null;
let pendiente = false;

// Compara las medallas actuales con las que ya se habían mostrado.
// La primera vez en un dispositivo sólo las anota, sin avisar.
export async function revisarMedallas() {
  if (revisando) { pendiente = true; return revisando; }
  revisando = (async () => {
    const u = usuario();
    if (!u) return;
    try {
      const logros = await misLogros();
      if (!logros || usuario()?.id !== u.id) return;
      const ganadas = evaluar(logros).filter((m) => m.ganada);
      const vistas = leerGanadas(u.id);
      if (vistas) {
        const nuevas = ganadas.filter((m) => !vistas.includes(m.id));
        if (nuevas.length) mostrarAviso(nuevas);
      }
      guardarGanadas(u.id, [...new Set([...(vistas || []), ...ganadas.map((m) => m.id)])]);
    } catch (err) {
      console.warn('No se pudieron revisar las medallas:', err.message);
    }
  })();
  await revisando;
  revisando = null;
  if (pendiente) { pendiente = false; return revisarMedallas(); }
}

export function iniciarMedallas() {
  alCambiarActividad(() => revisarMedallas());
  alCambiarSesion((u) => { if (u) revisarMedallas(); });
}
