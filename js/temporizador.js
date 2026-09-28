// Temporizadores de cocina: se guardan con su hora de fin, así siguen andando
// al cambiar de página o recargar. Al terminar muestran un cartel con sonido.
import { el } from './dom.js';

const CLAVE = 'recetario:temporizadores';
const MAX_TEMPORIZADORES = 5;

let temporizadores = leer();
let contenedor = null;
let intervalo = null;
let audio = null;
let sonando = null; // intervalo del pitido mientras el cartel está abierto
const avisados = new Set(); // ids que ya mostraron el cartel en esta página
let tituloOriginal = null;

function leer() {
  try {
    const t = JSON.parse(localStorage.getItem(CLAVE) || '[]');
    return Array.isArray(t) ? t.filter((x) => x && x.id && x.total > 0) : [];
  } catch {
    return [];
  }
}

function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(temporizadores)); } catch { /* sin almacenamiento */ }
}

const restante = (t) => (t.pausado ? t.restante : t.fin - Date.now());

export function formatear(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${seg}` : `${m}:${seg}`;
}

export function textoDuracion(segundos) {
  if (segundos < 60) return `${segundos} s`;
  const h = Math.floor(segundos / 3600);
  const m = Math.round((segundos % 3600) / 60);
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

// ---------- detectar tiempos en el texto de un paso ----------

const NUMEROS = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, doce: 12, quince: 15, veinte: 20, treinta: 30, cuarenta: 40, cuarenta_y_cinco: 45,
};
const PALABRAS = Object.keys(NUMEROS).filter((n) => !n.includes('_')).sort((a, b) => b.length - a.length);
const NUM = `(\\d+(?:[.,]\\d+)?|(?:${PALABRAS.join('|')})\\b)`;
const UNIDAD = '(horas?|hs|h|minutos?|mins?|segundos?|seg)';
// Rango: "20 a 25", "1 o 2", "2-3".
const TIEMPO = new RegExp(`\\b${NUM}(?:(?:\\s+(?:a|o)\\s+|\\s*[-–]\\s*)${NUM})?\\s*${UNIDAD}\\b`, 'gi');

const valor = (n) => (n ? NUMEROS[n.toLowerCase()] ?? Number(n.replace(',', '.')) : NaN);
const minutosDe = (n) => Math.round(valor(n) * 60);

// Devuelve las duraciones (en segundos) que menciona el texto, sin repetir.
// En un rango ("20 a 25 minutos") se toma el menor, para ir controlando.
export function tiemposEnTexto(texto) {
  const encontrados = [];
  const t = texto
    .replace(/\b(\d+|una?)\s*horas?\s+y\s+media\b/gi, (_, n) => `${minutosDe(n) + 30} minutos`)
    .replace(/\b(\d+|una?)\s*horas?\s+y\s+(\d+)\s*minutos?\b/gi, (_, h, m) => `${minutosDe(h) + Number(m)} minutos`)
    .replace(/\bmedia hora\b/gi, '30 minutos')
    .replace(/\bun cuarto de hora\b/gi, '15 minutos')
    .replace(/\bun par de (horas|minutos)\b/gi, '2 $1');
  for (const m of t.matchAll(TIEMPO)) {
    const cantidad = valor(m[1]);
    if (!cantidad || cantidad > 600) continue;
    const unidad = m[3].toLowerCase();
    const factor = unidad.startsWith('h') ? 3600 : unidad.startsWith('s') ? 1 : 60;
    const segundos = Math.round(cantidad * factor);
    if (segundos >= 10 && segundos <= 24 * 3600 && !encontrados.includes(segundos)) encontrados.push(segundos);
  }
  return encontrados.slice(0, 3);
}

// ---------- sonido ----------

// El navegador sólo deja sonar audio después de un toque: se prepara al iniciar.
function prepararAudio() {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch { /* sin audio */ }
}

function pitido() {
  if (!audio || audio.state !== 'running') return;
  const ahora = audio.currentTime;
  for (const [inicio, frecuencia] of [[0, 880], [0.18, 880], [0.36, 1175]]) {
    const osc = audio.createOscillator();
    const vol = audio.createGain();
    osc.type = 'sine';
    osc.frequency.value = frecuencia;
    vol.gain.setValueAtTime(0.0001, ahora + inicio);
    vol.gain.exponentialRampToValueAtTime(0.35, ahora + inicio + 0.02);
    vol.gain.exponentialRampToValueAtTime(0.0001, ahora + inicio + 0.15);
    osc.connect(vol).connect(audio.destination);
    osc.start(ahora + inicio);
    osc.stop(ahora + inicio + 0.16);
  }
}

// ---------- API ----------

export function iniciarTemporizador(segundos, etiqueta) {
  prepararAudio();
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
  if (temporizadores.length >= MAX_TEMPORIZADORES) temporizadores.shift();
  const total = segundos * 1000;
  temporizadores.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, etiqueta, total, fin: Date.now() + total, pausado: false });
  guardar();
  dibujar();
  arrancar();
}

function quitar(id) {
  temporizadores = temporizadores.filter((t) => t.id !== id);
  avisados.delete(id);
  guardar();
  dibujar();
}

function alternarPausa(t) {
  if (t.pausado) {
    t.fin = Date.now() + t.restante;
    t.pausado = false;
    prepararAudio();
  } else {
    t.restante = t.fin - Date.now();
    t.pausado = true;
  }
  guardar();
  dibujar();
  arrancar();
}

function sumarMinuto(t) {
  if (t.pausado) t.restante += 60000; else t.fin = Math.max(t.fin, Date.now()) + 60000;
  t.total += 60000;
  avisados.delete(t.id);
  guardar();
  dibujar();
  arrancar();
}

// ---------- vista ----------

function dibujar() {
  if (!contenedor) return;
  contenedor.hidden = !temporizadores.length;
  contenedor.replaceChildren(...temporizadores.map((t) => {
    const ms = restante(t);
    const terminado = ms <= 0 && !t.pausado;
    return el('div', { class: `temporizador${terminado ? ' terminado' : ''}${t.pausado ? ' pausado' : ''}`, 'data-id': t.id },
      el('span', { class: 'temporizador-tiempo', 'aria-live': 'off' }, terminado ? '¡Listo!' : formatear(ms)),
      el('span', { class: 'temporizador-etiqueta', title: t.etiqueta }, t.etiqueta),
      !terminado && el('button', {
        type: 'button', class: 'temporizador-boton', onclick: () => alternarPausa(t),
        'aria-label': t.pausado ? 'Seguir' : 'Pausar', title: t.pausado ? 'Seguir' : 'Pausar',
      }, t.pausado ? '▶' : '❚❚'),
      el('button', {
        type: 'button', class: 'temporizador-boton', onclick: () => quitar(t.id), 'aria-label': 'Quitar', title: 'Quitar',
      }, '✕'));
  }));
}

function actualizarTiempos() {
  for (const t of temporizadores) {
    const nodo = contenedor?.querySelector(`[data-id="${t.id}"] .temporizador-tiempo`);
    const ms = restante(t);
    if (nodo && ms > 0) nodo.textContent = formatear(ms);
    if (ms <= 0 && !t.pausado && !avisados.has(t.id)) {
      avisados.add(t.id);
      dibujar();
      alarma(t);
    }
  }
  if (!temporizadores.some((t) => !t.pausado && restante(t) > 0)) {
    clearInterval(intervalo);
    intervalo = null;
  }
}

function arrancar() {
  if (!intervalo) intervalo = setInterval(actualizarTiempos, 250);
  actualizarTiempos();
}

// ---------- cartel de "¡Tiempo!" ----------

// Si terminan varios a la vez, comparten un solo cartel.
let cartel = null; // { fondo, lista, terminados: [] }

function cerrarCartel() {
  clearInterval(sonando);
  sonando = null;
  if (tituloOriginal) { document.title = tituloOriginal; tituloOriginal = null; }
  cartel?.fondo.remove();
  cartel = null;
}

function lineaTerminado(t) {
  const atrasado = -restante(t);
  return el('li', {},
    el('strong', {}, t.etiqueta),
    el('small', {}, `Temporizador de ${textoDuracion(Math.round(t.total / 1000))}`
      + (atrasado > 5000 ? ` · terminó hace ${formatear(atrasado)}` : '')));
}

function alarma(t) {
  if (cartel) {
    cartel.terminados.push(t);
    cartel.lista.append(lineaTerminado(t));
  } else {
    const lista = el('ul', { class: 'alarma-lista' }, lineaTerminado(t));
    const terminados = [t];
    const fondo = el('div', { class: 'alarma-fondo' },
      el('div', { class: 'alarma', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'alarma-titulo' },
        el('div', { class: 'alarma-icono', 'aria-hidden': 'true' }, '⏰'),
        el('h2', { id: 'alarma-titulo' }, '¡Tiempo!'),
        lista,
        el('div', { class: 'acciones' },
          el('button', {
            type: 'button', class: 'boton-secundario',
            onclick: () => { cerrarCartel(); terminados.forEach(sumarMinuto); },
          }, '+1 minuto'),
          el('button', {
            type: 'button', class: 'boton',
            onclick: () => { cerrarCartel(); terminados.forEach((x) => quitar(x.id)); },
          }, 'Listo'))));
    cartel = { fondo, lista, terminados };
    document.body.append(fondo);
    fondo.querySelector('.boton').focus();
  }

  // Sonido y vibración un rato (hasta que se cierre, máximo un minuto).
  clearInterval(sonando);
  pitido();
  let veces = 0;
  sonando = setInterval(() => { if (++veces > 40) clearInterval(sonando); else pitido(); }, 1500);
  navigator.vibrate?.([400, 150, 400, 150, 400]);
  tituloOriginal ??= document.title;
  document.title = `⏰ ¡Tiempo! · ${t.etiqueta}`;

  // Si la pestaña está en segundo plano, también una notificación del sistema.
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    try { new Notification('⏰ ¡Tiempo!', { body: t.etiqueta, icon: 'img/logo.png', tag: t.id }); } catch { /* sin notificaciones */ }
  }
}

// ---------- elegir un tiempo a mano ----------

const RAPIDOS = [1, 3, 5, 10, 15, 20, 30, 45, 60];

export function elegirTiempo(etiqueta) {
  const minutos = el('input', { type: 'number', min: 0, max: 600, value: 10, inputmode: 'numeric', 'aria-label': 'Minutos' });
  const segundos = el('input', { type: 'number', min: 0, max: 59, value: 0, inputmode: 'numeric', 'aria-label': 'Segundos' });
  const cerrar = () => fondo.remove();
  const empezar = (seg) => {
    if (seg > 0) iniciarTemporizador(seg, etiqueta);
    cerrar();
  };
  const fondo = el('div', { class: 'alarma-fondo', onclick: (e) => { if (e.target === fondo) cerrar(); } },
    el('form', {
      class: 'alarma elegir-tiempo', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Nuevo temporizador',
      onsubmit: (e) => {
        e.preventDefault();
        empezar(Math.max(0, Number(minutos.value) || 0) * 60 + Math.min(59, Math.max(0, Number(segundos.value) || 0)));
      },
      onkeydown: (e) => { if (e.key === 'Escape') cerrar(); },
    },
    el('h2', {}, '⏱ Temporizador'),
    el('p', { class: 'meta' }, etiqueta),
    el('div', { class: 'tiempos-rapidos' },
      RAPIDOS.map((m) => el('button', { type: 'button', class: 'boton-secundario', onclick: () => empezar(m * 60) }, `${m} min`))),
    el('div', { class: 'tiempo-a-mano' },
      el('label', {}, minutos, ' min'),
      el('label', {}, segundos, ' s')),
    el('div', { class: 'acciones' },
      el('button', { type: 'button', class: 'boton-secundario', onclick: cerrar }, 'Cancelar'),
      el('button', { type: 'submit', class: 'boton' }, 'Empezar'))));
  document.body.append(fondo);
  minutos.focus();
  minutos.select();
}

export function iniciarTemporizadores() {
  contenedor = el('div', { class: 'temporizadores', role: 'region', 'aria-label': 'Temporizadores', hidden: true });
  document.body.append(contenedor);
  // Otra pestaña cambió los temporizadores.
  window.addEventListener('storage', (e) => {
    if (e.key !== CLAVE) return;
    temporizadores = leer();
    dibujar();
    arrancar();
  });
  dibujar();
  if (temporizadores.length) arrancar();
}
