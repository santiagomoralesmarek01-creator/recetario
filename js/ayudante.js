// Ayudante de cocina: botón flotante que abre una charla con la IA
// (api/ayudante.js). Hace falta tener la sesión iniciada.
import { el } from './dom.js';
import { hayBackend } from './supabase.js';
import { usuario, alCambiarSesion, tokenAcceso, pedirLogin } from './auth.js';
import { traducirCategoria, traducirOrigen } from './traducciones.js';

const CLAVE = 'recetario:ayudante';
const MAX_HISTORIAL = 20;

const SUGERENCIAS = [
  '¿Con qué reemplazo la manteca en una torta?',
  '¿Cuántos gramos es una taza de harina?',
  'Tengo pollo, papas y cebolla: ¿qué preparo?',
  '¿Cómo hago para que no se me pegue el arroz?',
];
const SUGERENCIAS_RECETA = [
  '¿Cómo la adapto para 2 personas?',
  '¿Qué ingrediente puedo reemplazar si no lo tengo?',
  '¿Con qué la acompaño?',
];

let mensajes = leer();
let receta = null;
let esperando = false;
let dibujar = () => {};
let abrirPanel = null;

export const ayudanteDisponible = () => Boolean(abrirPanel);
export function abrirAyudante() { abrirPanel?.(true); }

function leer() {
  try {
    const m = JSON.parse(sessionStorage.getItem(CLAVE) || '[]');
    const validos = Array.isArray(m) ? m.filter((x) => x && typeof x.texto === 'string') : [];
    // Una pregunta que quedó sin respuesta (se cerró la página) se descarta.
    while (validos.at(-1)?.rol === 'usuario') validos.pop();
    return validos;
  } catch {
    return [];
  }
}

function guardar() {
  try { sessionStorage.setItem(CLAVE, JSON.stringify(mensajes.slice(-MAX_HISTORIAL))); } catch { /* sin almacenamiento */ }
}

// La vista de receta avisa qué receta se está mirando (null al salir).
export function contextoReceta(r) {
  receta = r;
  dibujar();
}

function textoReceta(r) {
  return [
    `Receta: ${r.nombre}`,
    r.categoria && `Categoría: ${traducirCategoria(r.categoria)}`,
    r.origen && `Origen: ${traducirOrigen(r.origen)}`,
    r.porciones && `Porciones: ${r.porciones}`,
    r.minutos && `Tiempo: ${r.minutos} minutos`,
    'Ingredientes:',
    ...r.ingredientes.map((i) => `- ${[i.medida, i.nombre].filter(Boolean).join(' ')}`),
    'Pasos:',
    ...r.pasos.map((p, i) => `${i + 1}. ${p}`),
  ].filter(Boolean).join('\n');
}

// Markdown mínimo y seguro: párrafos, listas y **negrita**, sin innerHTML.
function enLinea(texto) {
  return texto.split(/(\*\*[^*]+\*\*)/).map((parte) => (
    /^\*\*[^*]+\*\*$/.test(parte) ? el('strong', {}, parte.slice(2, -2)) : parte
  ));
}

function formatear(texto) {
  const bloques = [];
  let lista = null;
  for (const linea of texto.split('\n')) {
    const t = linea.trim();
    const item = t.match(/^(?:[-*•]|(\d+)[.)])\s+(.*)$/);
    if (item) {
      const tipo = item[1] ? 'ol' : 'ul';
      if (!lista || lista.tagName.toLowerCase() !== tipo) bloques.push(lista = el(tipo));
      lista.append(el('li', {}, enLinea(item[2])));
    } else {
      lista = null;
      if (t) bloques.push(el('p', {}, enLinea(t.replace(/^#+\s*/, ''))));
    }
  }
  return bloques;
}

async function preguntar(historial, recetaVista) {
  const token = await tokenAcceso();
  if (!token) throw new Error('Tu sesión venció. Volvé a entrar.');
  const r = await fetch('/api/ayudante', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      mensajes: historial.slice(-MAX_HISTORIAL),
      receta: recetaVista ? textoReceta(recetaVista) : undefined,
    }),
  });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok || !datos.texto) {
    const error = new Error(datos.error || `El ayudante no pudo responder (error ${r.status}). Probá de nuevo.`);
    error.detalle = datos.detalle;
    throw error;
  }
  return datos;
}

export function iniciarAyudante() {
  if (!hayBackend) return;

  const lista = el('div', { class: 'ayudante-mensajes', 'aria-live': 'polite' });
  const entrada = el('textarea', {
    rows: 1, maxlength: 1500, placeholder: 'Preguntá lo que quieras de cocina…', 'aria-label': 'Tu pregunta',
  });
  const enviarBtn = el('button', { type: 'submit', class: 'ayudante-enviar', 'aria-label': 'Enviar' }, '➤');
  const formulario = el('form', { class: 'ayudante-form' }, entrada, enviarBtn);
  const contexto = el('p', { class: 'ayudante-contexto', hidden: true });
  const nueva = el('button', {
    type: 'button', class: 'boton-icono', title: 'Empezar una charla nueva',
    onclick: () => { mensajes = []; guardar(); dibujar(); entrada.focus(); },
  }, 'Nueva');

  const panel = el('section', { class: 'ayudante-panel', role: 'dialog', 'aria-label': 'Ayudante de cocina', hidden: true },
    el('header', { class: 'ayudante-cabecera' },
      el('span', { class: 'ayudante-avatar', 'aria-hidden': 'true' }, '🍳'),
      el('div', {},
        el('strong', {}, 'Ayudante de cocina'),
        el('small', {}, 'Con IA · puede equivocarse')),
      nueva,
      el('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Cerrar', onclick: () => abrir(false) }, '✕')),
    lista, contexto, formulario);

  const boton = el('button', {
    type: 'button', class: 'ayudante-boton', 'aria-label': 'Abrir el ayudante de cocina', title: 'Ayudante de cocina',
    onclick: () => abrir(panel.hidden),
  }, el('span', { 'aria-hidden': 'true' }, '🍳'), el('span', { class: 'ayudante-boton-texto' }, 'Ayudante'));

  document.body.append(boton, panel);
  document.body.classList.add('con-ayudante');
  abrirPanel = abrir;

  function abrir(si) {
    panel.hidden = !si;
    boton.setAttribute('aria-expanded', String(si));
    document.body.classList.toggle('ayudante-abierto', si);
    if (si) {
      dibujar();
      if (usuario()) entrada.focus();
    }
  }

  function burbuja(m) {
    return el('div', { class: `ayudante-msj ayudante-msj-${m.rol}` },
      m.rol === 'ayudante' ? formatear(m.texto) : m.texto);
  }

  function chips(textos) {
    return el('div', { class: 'ayudante-sugerencias' },
      textos.map((t) => el('button', { type: 'button', onclick: () => enviar(t) }, t)));
  }

  dibujar = function () {
    if (panel.hidden) return;
    const logueado = Boolean(usuario());
    formulario.hidden = !logueado;
    nueva.hidden = !logueado || !mensajes.length;
    contexto.hidden = !logueado || !receta;
    if (receta) contexto.replaceChildren('📖 Te ayudo con ', el('strong', {}, receta.nombre));

    if (!logueado) {
      lista.replaceChildren(el('div', { class: 'ayudante-bienvenida' },
        el('p', {}, '¡Hola! Soy tu ayudante de cocina. Te ayudo con reemplazos, medidas, técnicas y dudas mientras cocinás.'),
        el('p', {}, 'Para charlar conmigo necesitás una cuenta (es gratis).'),
        el('button', { type: 'button', class: 'boton', onclick: () => { abrir(false); pedirLogin(); } }, 'Entrar o crear cuenta')));
      return;
    }
    const hijos = mensajes.length
      ? mensajes.map(burbuja)
      : [el('div', { class: 'ayudante-bienvenida' },
        el('p', {}, receta
          ? `¡Hola! ¿Qué duda tenés sobre "${receta.nombre}"?`
          : '¡Hola! ¿En qué te ayudo? Preguntame por reemplazos, medidas, técnicas o qué cocinar con lo que tenés.'),
        chips(receta ? SUGERENCIAS_RECETA : SUGERENCIAS),
        el('p', { class: 'ayudante-nota' }, 'Responde una IA gratuita (Google Gemini). No compartas datos personales.'))];
    if (esperando) {
      hijos.push(el('div', { class: 'ayudante-msj ayudante-msj-ayudante ayudante-escribiendo', 'aria-label': 'Escribiendo' },
        el('span'), el('span'), el('span')));
    }
    lista.replaceChildren(...hijos);
    lista.scrollTop = lista.scrollHeight;
  };

  function error(texto, detalle) {
    lista.append(el('p', { class: 'ayudante-error', role: 'alert' }, texto,
      detalle && el('small', {}, detalle)));
    lista.scrollTop = lista.scrollHeight;
  }

  async function enviar(texto) {
    texto = texto.trim();
    if (!texto || esperando) return;
    esperando = true;
    enviarBtn.disabled = true;
    entrada.value = '';
    ajustarAlto();
    mensajes.push({ rol: 'usuario', texto });
    dibujar();
    try {
      const { texto: respuesta } = await preguntar([...mensajes], receta);
      mensajes.push({ rol: 'ayudante', texto: respuesta });
      guardar();
      esperando = false;
      dibujar();
    } catch (err) {
      // No quedó respuesta: sacamos la pregunta y la devolvemos al cuadro de texto.
      mensajes.pop();
      esperando = false;
      dibujar();
      entrada.value = texto;
      ajustarAlto();
      error(err.message || 'No se pudo conectar. Revisá tu conexión.', err.detalle);
    } finally {
      enviarBtn.disabled = false;
      entrada.focus();
    }
  }

  function ajustarAlto() {
    entrada.style.height = 'auto';
    entrada.style.height = `${Math.min(entrada.scrollHeight, 140)}px`;
  }

  formulario.addEventListener('submit', (e) => { e.preventDefault(); enviar(entrada.value); });
  entrada.addEventListener('input', ajustarAlto);
  entrada.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(entrada.value); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) abrir(false); });
  alCambiarSesion(() => dibujar());
}
