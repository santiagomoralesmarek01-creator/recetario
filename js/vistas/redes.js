// Panel de redes (/admin/redes), sólo para administradores: publicaciones
// programadas de Instagram con su estado, acciones (pausar, reintentar,
// reprogramar, probar sin publicar), estado del token y carga de semanas.
import { el, mostrar, cargando, vigencia, aviso } from '../dom.js';
import { usuario, pedirLogin } from '../auth.js';
import { soyAdmin } from '../fotos.js';
import { SUPABASE_URL } from '../config.js';
import { ZONA, isoEnZona, partesEnZona } from '../zonaHoraria.js';
import {
  publicaciones, estadoToken, guardarToken, accion, probar, cupo, cargarSemana, urlPublica,
} from '../redes.js';

const ESTADOS = {
  pendiente: 'Programada', procesando: 'Preparando', publicada: 'Publicada', error: 'Error', pausada: 'Pausada',
  manual: 'Va a mano', solo_prueba: 'Sólo prueba', vencida: 'Vencida',
};
const TIPOS = { imagen: 'Imagen', carrusel: 'Carrusel', reel: 'Reel', historia: 'Historia' };
// Qué botones tiene cada estado (las reglas reales están en redes_admin, en SQL).
const ACCIONES = {
  pendiente: [['pausar', 'Pausar'], ['reprogramar', 'Cambiar hora'], ['probar', 'Probar']],
  pausada: [['reanudar', 'Reanudar'], ['reprogramar', 'Cambiar hora'], ['probar', 'Probar']],
  error: [['reintentar', 'Reintentar'], ['reprogramar', 'Cambiar hora'], ['pausar', 'Pausar'], ['probar', 'Probar']],
  vencida: [['reprogramar', 'Cambiar hora'], ['hecha', 'Ya la subí'], ['pausar', 'Pausar']],
  manual: [['hecha', 'Ya la subí'], ['automatica', 'Publicar sin sticker'], ['reprogramar', 'Cambiar hora']],
  solo_prueba: [['probar', 'Probar']],
  procesando: [],
  publicada: [],
};

const cuando = (iso) => new Date(iso).toLocaleString('es-AR', { timeZone: ZONA, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const dias = (iso) => Math.floor((new Date(iso) - Date.now()) / 86400_000);

function detalle(p) {
  const partes = [];
  if (p.enlace) partes.push(el('a', { href: p.enlace, target: '_blank', rel: 'noopener' }, 'Ver en Instagram'));
  if (p.ultimo_error && p.estado !== 'publicada') partes.push(el('span', { class: 'error' }, p.ultimo_error));
  if (p.nota) partes.push(el('span', { class: 'meta' }, p.nota));
  if (p.prueba) {
    partes.push(el('details', {},
      el('summary', {}, p.prueba.ok ? '✓ Prueba OK' : '✗ Prueba con error', ` (${cuando(p.prueba.en)})`),
      el('ul', {}, (p.prueba.pasos || []).map((x) => el('li', {}, x))),
      p.prueba.error && el('p', { class: 'error' }, p.prueba.error)));
  }
  return partes;
}

function archivos(p) {
  return el('span', { class: 'redes-archivos' }, [...p.archivos, p.portada].filter(Boolean).map((ruta, i) =>
    el('a', { href: urlPublica(ruta, SUPABASE_URL), target: '_blank', rel: 'noopener', title: ruta },
      ruta === p.portada ? 'portada' : /\.mp4$/i.test(ruta) ? 'video' : p.archivos.length > 1 ? `${i + 1}` : 'imagen')));
}

export async function vistaAdminRedes() {
  document.title = 'Panel de redes · A Mano';
  if (!usuario()) { pedirLogin('/admin/redes'); return; }
  const vigente = vigencia();
  cargando();
  if (!(await soyAdmin())) { if (vigente()) mostrar(el('p', { class: 'estado' }, 'Sólo para administradores.')); return; }
  if (!vigente()) return;

  // ---------- cuenta y token ----------
  const cuenta = el('div', { class: 'redes-cuenta' });
  async function cargarCuenta() {
    try {
      const t = await estadoToken();
      const quedan = t.vence_en ? dias(t.vence_en) : null;
      cuenta.replaceChildren(...[
        el('p', {}, t.hay_token
          ? [`Cuenta: ${t.usuario ? `@${t.usuario}` : '(se completa en la primera publicación o prueba)'} · Token cargado el ${new Date(t.cargado_en).toLocaleDateString('es-AR')} · `,
            el('strong', { class: quedan != null && quedan < 10 ? 'error' : '' }, `vence en ${quedan} días`), ' (se renueva solo cada 7 días)']
          : el('strong', { class: 'error' }, 'Todavía no hay token cargado: no se puede publicar.')),
        el('p', { class: 'meta' }, t.ultima_corrida
          ? `Última corrida del publicador: ${cuando(t.ultima_corrida)}${Date.now() - new Date(t.ultima_corrida) > 3600_000 ? ' — hace más de una hora: revisá pg_cron en Supabase.' : ''}`
          : 'El publicador todavía no corrió nunca (falta activar pg_cron en Supabase).'),
        t.ultimo_error && el('p', { class: 'error' }, t.ultimo_error)].filter(Boolean));
    } catch (err) {
      cuenta.replaceChildren(el('p', { class: 'error' }, err.message));
    }
  }
  const campoToken = el('input', { type: 'password', autocomplete: 'off', placeholder: 'Pegá acá el token de Meta for Developers', class: 'redes-token' });
  const formToken = el('form', {
    class: 'admin-filtro', onsubmit: async (e) => {
      e.preventDefault();
      try {
        await guardarToken(campoToken.value);
        campoToken.value = '';
        aviso('Token guardado. No se puede volver a ver desde acá.');
        cargarCuenta();
      } catch (err) { aviso(err.message, 'error'); }
    },
  }, campoToken, el('button', { type: 'submit', class: 'boton-secundario' }, 'Guardar token'));
  const salidaCupo = el('span', { class: 'meta' });
  const botonCupo = el('button', {
    type: 'button', class: 'boton-secundario', onclick: async () => {
      salidaCupo.textContent = 'Consultando…';
      try {
        const r = await cupo();
        salidaCupo.textContent = r.error ? r.error
          : r.cupo ? `@${r.usuario || '?'} · ${r.cupo.usadas} de ${r.cupo.total ?? '?'} publicaciones usadas en las últimas 24 h.` : 'Sin token.';
      } catch (err) { salidaCupo.textContent = err.message; }
    },
  }, 'Probar la conexión');

  // ---------- cargar una semana ----------
  const carpeta = el('input', { type: 'file', webkitdirectory: true, multiple: true });
  const progreso = el('p', { class: 'meta' });
  const formSemana = el('form', {
    class: 'admin-filtro', onsubmit: async (e) => {
      e.preventDefault();
      if (!carpeta.files.length) { aviso('Elegí la carpeta de la semana.', 'error'); return; }
      try {
        const n = await cargarSemana(carpeta.files, (t) => { progreso.textContent = t; });
        progreso.textContent = `Listo: ${n} publicaciones cargadas.`;
        cargarLista();
      } catch (err) { progreso.textContent = ''; aviso(err.message, 'error'); }
    },
  }, carpeta, el('button', { type: 'submit', class: 'boton-secundario' }, 'Subir semana'));

  // ---------- publicaciones ----------
  const filtro = el('select', { onchange: () => dibujar() });
  const lista = el('div', { class: 'admin-tabla' });
  let todas = [];

  async function hacer(p, cual) {
    try {
      if (cual === 'probar') {
        aviso('Probando… (puede tardar hasta un minuto con los videos)');
        const r = await probar(p.id);
        aviso(r.ok ? 'Prueba OK: Instagram aceptó los archivos. No se publicó nada.' : `La prueba falló: ${r.error || r.estado}`, r.ok ? 'ok' : 'error');
      } else if (cual === 'reprogramar') {
        const actual = partesEnZona(p.fecha);
        const nueva = prompt('Nueva fecha y hora (hora de Argentina), AAAA-MM-DD HH:MM', `${actual.fecha} ${actual.hora}`);
        const m = nueva?.trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}:\d{2})$/);
        if (!nueva) return;
        if (!m) { aviso('Formato: 2026-10-20 18:00', 'error'); return; }
        await accion(p.id, cual, isoEnZona(m[1], m[2].padStart(5, '0')));
      } else {
        if (cual === 'automatica' && !confirm('Se va a publicar sola, sin el sticker de enlace. ¿Seguimos?')) return;
        await accion(p.id, cual);
      }
      await cargarLista();
    } catch (err) { aviso(err.message, 'error'); }
  }

  function dibujar() {
    const semana = filtro.value;
    const filas = todas.filter((p) => !semana || p.semana === semana);
    if (!filas.length) { lista.replaceChildren(el('p', { class: 'meta' }, 'No hay publicaciones cargadas.')); return; }
    lista.replaceChildren(el('table', {},
      el('thead', {}, el('tr', {}, ['Cuándo', 'Tipo', 'Archivos', 'Texto', 'Estado', 'Detalle', ''].map((h) => el('th', {}, h)))),
      el('tbody', {}, filas.map((p) => el('tr', {},
        el('td', {}, cuando(p.fecha)),
        el('td', {}, TIPOS[p.tipo] || p.tipo),
        el('td', {}, archivos(p)),
        el('td', { class: 'redes-texto', title: p.texto || '' }, p.texto ? p.texto.split('\n')[0] : '—'),
        el('td', {}, el('span', { class: `chip-estado chip-${p.estado}` }, ESTADOS[p.estado] || p.estado),
          p.intentos > 0 && p.estado !== 'publicada' && el('small', { class: 'meta' }, ` ${p.intentos} intento(s)`)),
        el('td', { class: 'redes-detalle' }, detalle(p)),
        el('td', {}, el('div', { class: 'redes-acciones' }, (ACCIONES[p.estado] || []).map(([cual, texto]) =>
          el('button', { type: 'button', class: 'boton-secundario boton-chico', onclick: () => hacer(p, cual) }, texto)))))))));
  }

  async function cargarLista() {
    try {
      todas = await publicaciones();
      const semanas = [...new Set(todas.map((p) => p.semana))];
      const elegida = filtro.value || semanas.find((s) => todas.some((p) => p.semana === s && ['pendiente', 'procesando', 'manual', 'error'].includes(p.estado))) || semanas.at(-1) || '';
      filtro.replaceChildren(el('option', { value: '' }, 'Todas las semanas'), ...semanas.map((s) => el('option', { value: s, selected: s === elegida }, s)));
      filtro.value = elegida;
      dibujar();
    } catch (err) {
      lista.replaceChildren(el('p', { class: 'error' }, err.message));
    }
  }

  async function probarSemana() {
    const filas = todas.filter((p) => p.semana === filtro.value && (ACCIONES[p.estado] || []).some(([c]) => c === 'probar'));
    if (!filas.length) { aviso('Elegí una semana con publicaciones para probar.', 'error'); return; }
    if (!confirm(`Se van a armar ${filas.length} contenedores de prueba en Instagram, sin publicar nada. ¿Seguimos?`)) return;
    let ok = 0;
    for (const [i, p] of filas.entries()) {
      progresoPrueba.textContent = `Probando ${i + 1} de ${filas.length}…`;
      try { if ((await probar(p.id)).ok) ok++; } catch { /* queda anotado en la fila */ }
    }
    progresoPrueba.textContent = `${ok} de ${filas.length} pruebas OK. No se publicó nada.`;
    cargarLista();
  }
  const progresoPrueba = el('span', { class: 'meta' });

  mostrar(
    el('h1', {}, 'Panel de redes'),
    el('p', { class: 'meta' }, 'Publicaciones de Instagram programadas. Cada 10 minutos el publicador sube lo que ya llegó a su hora. Las historias con sticker de enlace quedan "Va a mano": a la mañana llega un mail con lo que hay que subir desde el celular.'),
    el('section', { class: 'seccion' },
      el('h2', {}, 'Cuenta de Instagram'),
      cuenta,
      el('div', { class: 'admin-filtro' }, botonCupo, salidaCupo),
      el('details', {}, el('summary', {}, 'Cargar un token nuevo'),
        el('p', { class: 'meta' }, 'Se guarda en Supabase y no se puede volver a leer desde la web. Ver docs/redes-instagram.md para generarlo.'),
        formToken)),
    el('section', { class: 'seccion' },
      el('h2', {}, 'Cargar una semana'),
      el('p', { class: 'meta' }, 'Elegí la carpeta de la semana (con calendario.json y los PNG y MP4). Los PNG se convierten a JPG y todo se sube al bucket "redes" de Supabase. Volver a subirla actualiza lo que todavía no salió.'),
      formSemana, progreso),
    el('section', { class: 'seccion' },
      el('h2', {}, 'Publicaciones'),
      el('div', { class: 'admin-filtro' }, 'Semana ', filtro,
        el('button', { type: 'button', class: 'boton-secundario', onclick: cargarLista }, 'Actualizar'),
        el('button', { type: 'button', class: 'boton-secundario', onclick: probarSemana }, 'Probar la semana sin publicar'),
        progresoPrueba),
      lista));
  cargarCuenta();
  cargarLista();
}
