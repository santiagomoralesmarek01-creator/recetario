// Plato del día: el mismo para todos. Hay que adivinarlo con pistas que se
// revelan de a una (ingredientes, país, categoría y la foto). 6 intentos.
import { el, mostrar, cargando, vigencia } from '../dom.js';
import { normalizar } from '../ingredientes.js';
import { crearImagen, IMG_PLATO_GENERICO, IMG_INGREDIENTE_GENERICO } from '../imagenes.js';
import { bandera } from '../paises.js';
import { usuario, pedirLogin } from '../auth.js';
import { hayBackend } from '../supabase.js';
import { registrarActividad } from '../actividad.js';
import { diaArgentina, sumarDias } from '../medallas.js';
import { cargarDatos, azarConSemilla, mezclar, esTrivial, compartir } from './datos.js';
import { portada } from '../vistas/componentes.js';
import { icono } from '../iconos.js';
import { t } from '../textos.js';
import { evento } from '../analitica.js';
import { ruta, rutaReceta } from '../rutas.js';

const INTENTOS = 6;
const PUNTOS = [600, 500, 400, 300, 200, 100];
const INICIO = '2026-01-01';
const CLAVE = 'recetario:plato-del-dia';

export const numeroDelDia = (dia = diaArgentina()) =>
  Math.round((Date.parse(`${dia}T12:00:00Z`) - Date.parse(`${INICIO}T12:00:00Z`)) / 86400000) + 1;

// Desde este día se priorizan los platos latinoamericanos (antes, el de cada
// día salía de todo el catálogo; se mantiene así para no cambiar días ya jugados).
const DESDE_LATINOAMERICA = '2026-09-29';

// El plato de un día: siempre el mismo para todos. 7 de cada 10 días es
// latinoamericano, y cada lista se recorre entera antes de repetir.
export async function platoDe(dia) {
  const { recetas } = await cargarDatos();
  const aptas = recetas
    .filter((r) => r.origen && r.ingredientes.filter((i) => !esTrivial(i.nombre)).length >= 5)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  if (dia < DESDE_LATINOAMERICA) {
    const orden = mezclar(aptas.filter((r) => r.imagen), azarConSemilla(20260101));
    return orden[(numeroDelDia(dia) - 1 + orden.length) % orden.length];
  }
  // Las latinoamericanas sin foto (de la casa) usan un paso de la receta como última pista.
  const latinas = mezclar(aptas.filter((r) => r.latina && (r.imagen || r.pasos.length >= 3)), azarConSemilla(29092026));
  const delMundo = mezclar(aptas.filter((r) => !r.latina && r.imagen), azarConSemilla(20260929));
  const n = numeroDelDia(dia) - numeroDelDia(DESDE_LATINOAMERICA);
  const bloque = Math.floor(n / 10);
  const resto = n % 10;
  return resto < 7
    ? latinas[(bloque * 7 + resto) % latinas.length]
    : delMundo[(bloque * 3 + resto - 7) % delMundo.length];
}

// Un paso de la receta con el nombre del plato tapado (pista para las que no tienen foto).
function pasoComoPista(r) {
  const tapar = normalizar(r.nombre).split(/[^a-zñ]+/).filter((p) => p.length >= 4);
  const paso = r.pasos[Math.floor(r.pasos.length / 2)] || '';
  return paso.split(/(\s+)/).map((palabra) => {
    const n = normalizar(palabra).replace(/[^a-zñ]/g, '');
    return tapar.some((t) => n.startsWith(t.slice(0, 5))) ? '___' : palabra;
  }).join('');
}

// Pistas: 4 ingredientes (de los más comunes a los más reveladores), país, categoría y foto.
function pistasDe(r) {
  const ingredientes = r.ingredientes.filter((i) => !esTrivial(i.nombre)).sort((a, b) => b.usos - a.usos);
  const elegidos = [...ingredientes.slice(0, 3), ingredientes[ingredientes.length - 1]];
  return [
    ...elegidos.map((i) => ({ tipo: 'ingrediente', texto: i.nombre, imagen: i.imagen })),
    { tipo: 'pais', texto: r.origen },
    { tipo: 'categoria', texto: r.categoria || 'Sin categoría' },
    r.imagen ? { tipo: 'foto', texto: 'La foto del plato' } : { tipo: 'paso', texto: pasoComoPista(r) },
  ];
}

// ---------- estado guardado ----------

function leerEstado() {
  try { return JSON.parse(localStorage.getItem(CLAVE) || '{}') || {}; } catch { return {}; }
}
function guardarEstado(estado) {
  try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch { /* sin almacenamiento */ }
}

// Racha y estadísticas guardadas en el dispositivo (sirven también sin cuenta).
function estadisticas(estado) {
  const dias = estado.historial || {};
  const jugados = Object.keys(dias).length;
  const ganados = Object.values(dias).filter((d) => d.gano).length;
  let racha = 0;
  let dia = dias[diaArgentina()]?.gano ? diaArgentina() : sumarDias(diaArgentina(), -1);
  while (dias[dia]?.gano) { racha++; dia = sumarDias(dia, -1); }
  return { jugados, ganados, racha };
}

export function estadoDeHoy() {
  const hoy = diaArgentina();
  const estado = leerEstado();
  return { hoy: estado.historial?.[hoy], ...estadisticas(estado) };
}

function tiempoHastaMañana() {
  const ahora = Date.now();
  const mañana = Date.parse(`${sumarDias(diaArgentina(), 1)}T03:00:00Z`);
  const s = Math.max(0, Math.floor((mañana - ahora) / 1000));
  return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')} min`;
}

// ---------- vista ----------

export async function juegoPlatoDelDia() {
  const vigente = vigencia();
  cargando();
  const dia = diaArgentina();
  const [plato, { recetas }] = await Promise.all([platoDe(dia), cargarDatos()]);
  if (!vigente()) return;
  const numero = numeroDelDia(dia);
  const pistas = pistasDe(plato);
  const nombres = [...new Map(recetas.map((r) => [normalizar(r.nombre), r])).values()];

  const estado = leerEstado();
  estado.historial ??= {};
  const partida = estado.historial[dia] ?? { intentos: [], terminado: false, gano: false };

  const zonaPistas = el('ol', { class: 'plato-pistas' });
  const zonaIntentos = el('ul', { class: 'plato-intentos' });
  const zonaJuego = el('div', { class: 'plato-juego' });

  const esCorrecto = (nombre) => normalizar(nombre) === normalizar(plato.nombre);
  const errores = () => partida.intentos.filter((i) => !esCorrecto(i)).length;

  let yaVisibles = null; // para animar sólo las pistas nuevas
  function pintarPistas() {
    const visibles = partida.terminado ? pistas.length : Math.min(pistas.length, 2 + errores());
    const antes = yaVisibles ?? visibles;
    yaVisibles = visibles;
    zonaPistas.replaceChildren(...pistas.map((p, i) => pista(p, i, visibles, i >= antes && i < visibles)));
  }

  function pista(p, i, visibles, nueva) {
    const clase = nueva ? ' nueva' : '';
    if (i >= visibles) {
      return el('li', { class: 'plato-pista oculta' }, el('span', { class: 'plato-pista-icono' }, '?'),
        el('span', {}, `Pista ${i + 1}: se revela con un error`));
    }
    if (p.tipo === 'foto') {
      return el('li', { class: `plato-pista pista-foto${clase}` },
        crearImagen(plato.imagen, 'Foto del plato', IMG_PLATO_GENERICO, partida.terminado ? '' : 'desenfocada'));
    }
    if (p.tipo === 'paso') {
      return el('li', { class: `plato-pista pista-paso${clase}` },
        el('span', { class: 'plato-pista-icono' }, icono('pasos')),
        el('span', {}, el('small', {}, 'Un paso de la receta'), p.texto));
    }
    return el('li', { class: `plato-pista pista-${p.tipo}${clase}` },
      p.tipo === 'ingrediente' ? crearImagen(p.imagen, '', IMG_INGREDIENTE_GENERICO, 'plato-pista-img')
        : p.tipo === 'pais' ? bandera(p.texto, 'plato-pista-img bandera')
          : el('span', { class: 'plato-pista-icono' }, icono('plato')),
      el('span', {}, el('small', {}, p.tipo === 'ingrediente' ? 'Ingrediente' : p.tipo === 'pais' ? 'País' : 'Categoría'), p.texto));
  }

  function pintarIntentos() {
    zonaIntentos.replaceChildren(...partida.intentos.map((i) => el('li', { class: esCorrecto(i) ? 'bien' : 'mal' },
      icono(esCorrecto(i) ? 'tilde' : 'cerrar'), ' ', i === '' ? 'Pasé' : i)));
  }

  function cuadritos() {
    const marcas = partida.intentos.map((i) => (esCorrecto(i) ? '🟩' : '🟥'));
    while (marcas.length < INTENTOS) marcas.push('⬜');
    return marcas.join('');
  }

  function pintarFin() {
    const { racha } = estadisticas(estado);
    const puntos = partida.gano ? PUNTOS[errores()] : 0;
    const invitado = hayBackend && !usuario();
    zonaJuego.replaceChildren(el('div', { class: `plato-resultado ${partida.gano ? 'gano' : 'perdio'}` },
      el('p', { class: 'plato-resultado-titulo' }, partida.gano ? t('juego.ganaste') : t('juego.casi')),
      el('a', { class: 'plato-respuesta', href: rutaReceta(plato.id, plato.nombre) },
        plato.imagen ? crearImagen(plato.imagen, '', IMG_PLATO_GENERICO)
          : portada({ nombre: plato.nombre, categoria: plato.codigoCategoria }, { clase: 'plato-respuesta-sin' }),
        el('span', {}, el('small', {}, 'El plato de hoy era'), el('strong', {}, plato.nombre), el('span', {}, 'Ver la receta →'))),
      el('p', { class: 'plato-cuadritos', 'aria-label': `${partida.intentos.length} intentos` }, cuadritos()),
      el('ul', { class: 'cifras' },
        el('li', {}, el('strong', {}, puntos), el('span', {}, 'puntos')),
        el('li', {}, el('strong', {}, icono('fuego'), ` ${racha}`), el('span', {}, `día${racha === 1 ? '' : 's'} de racha`))),
      invitado && el('p', { class: 'juego-invitacion' },
        el('button', { type: 'button', class: 'boton-texto', onclick: () => pedirLogin(ruta()) }, 'Entrá'),
        ' para sumar los puntos al ranking y ganar medallas.'),
      el('div', { class: 'acciones' },
        el('button', {
          type: 'button', class: 'boton',
          onclick: () => compartir(`🍳 A Mano · Plato del día #${numero}\n${cuadritos()} ${partida.gano ? `${partida.intentos.length}/${INTENTOS}` : `X/${INTENTOS}`}${racha > 1 ? `  🔥${racha}` : ''}`),
        }, 'Compartir resultado'),
        el('a', { class: 'boton-secundario boton', href: '/juegos' }, 'Otros juegos')),
      el('p', { class: 'meta' }, `Nuevo plato en ${tiempoHastaMañana()}.`)));
  }

  // ---------- adivinar ----------
  const lista = el('ul', { class: 'sugerencias', role: 'listbox', hidden: true });
  const entrada = el('input', {
    type: 'search', placeholder: 'Escribí el nombre del plato…', autocomplete: 'off',
    'aria-label': 'Tu respuesta', role: 'combobox', 'aria-autocomplete': 'list',
  });
  let opciones = [];
  let activa = -1;
  const marcar = (i) => { activa = i; [...lista.children].forEach((li, j) => li.classList.toggle('activa', j === i)); };
  entrada.addEventListener('input', () => {
    const q = normalizar(entrada.value);
    const yaDichos = new Set(partida.intentos.map(normalizar));
    opciones = q.length < 2 ? [] : nombres
      .filter((r) => !yaDichos.has(normalizar(r.nombre)))
      .map((r) => ({ r, n: normalizar(r.nombre) }))
      .filter(({ n }) => n.includes(q))
      .sort((a, b) => Number(!a.n.startsWith(q)) - Number(!b.n.startsWith(q)) || a.n.length - b.n.length)
      .slice(0, 8)
      .map(({ r }) => r);
    lista.replaceChildren(...opciones.map((r, i) => el('li', {
      role: 'option', onmousedown: (e) => { e.preventDefault(); adivinar(r.nombre); }, onmouseenter: () => marcar(i),
    }, r.nombre)));
    lista.hidden = !opciones.length;
    marcar(opciones.length ? 0 : -1);
  });
  entrada.addEventListener('blur', () => { lista.hidden = true; });
  entrada.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && !lista.hidden) { e.preventDefault(); marcar((activa + 1) % opciones.length); }
    else if (e.key === 'ArrowUp' && !lista.hidden) { e.preventDefault(); marcar((activa - 1 + opciones.length) % opciones.length); }
    else if (e.key === 'Enter') { e.preventDefault(); if (activa >= 0) adivinar(opciones[activa].nombre); }
    else if (e.key === 'Escape') lista.hidden = true;
  });

  const mensaje = el('p', { class: 'plato-mensaje', role: 'status' });

  function adivinar(nombre) {
    if (partida.terminado) return;
    partida.intentos.push(nombre);
    entrada.value = '';
    lista.hidden = true;
    if (esCorrecto(nombre)) {
      partida.terminado = true;
      partida.gano = true;
    } else if (partida.intentos.length >= INTENTOS) {
      partida.terminado = true;
    }
    estado.historial[dia] = partida;
    guardarEstado(estado);
    mensaje.textContent = partida.terminado ? '' : nombre ? `No es "${nombre}". ¡Nueva pista!` : 'Pasaste: ¡nueva pista!';
    pintar();
    if (partida.terminado) {
      evento('Juego', { juego: 'plato-del-dia', gano: partida.gano ? 'sí' : 'no' });
      registrarActividad('juego-plato-del-dia', { detalle: plato.id, puntos: partida.gano ? PUNTOS[errores()] : 0, dia })
        .catch((err) => console.warn(err));
    } else {
      entrada.focus();
    }
  }

  function pintarJuego() {
    zonaJuego.replaceChildren(
      el('div', { class: 'combo plato-combo' }, entrada, lista),
      el('div', { class: 'plato-acciones' },
        el('span', { class: 'meta' }, `Intento ${partida.intentos.length + 1} de ${INTENTOS} · vale ${PUNTOS[errores()]} puntos`),
        el('button', { type: 'button', class: 'boton-texto', onclick: () => adivinar('') }, 'Pasar y ver otra pista')),
      mensaje);
  }

  function pintar() {
    pintarPistas();
    pintarIntentos();
    if (partida.terminado) pintarFin(); else pintarJuego();
  }

  document.title = `Plato del día #${numero} · A Mano`;
  mostrar(
    el('a', { class: 'volver', href: '/juegos' }, '← Juegos'),
    el('section', { class: 'juego plato-del-dia' },
      el('header', { class: 'juego-cabecera' },
        el('p', { class: 'portada-antetitulo' }, `Desafío diario #${numero}`),
        el('h1', {}, icono('plato', { clase: 'icono-titulo' }), 'Plato del día'),
        el('p', { class: 'meta' }, 'Adiviná el plato con la menor cantidad de pistas. Cada error revela una pista nueva. Es el mismo para todos: ¡compará con tus amigos!')),
      zonaPistas, zonaIntentos, zonaJuego));
  pintar();
  if (!partida.terminado) entrada.focus();
}
