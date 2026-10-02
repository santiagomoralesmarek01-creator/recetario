// Torneo de juegos con premio: tarjeta en Juegos, página /torneo (premio,
// cuenta regresiva, inscripción, ranking y ganadores), /bases y el panel
// de administración (/admin/torneo).
import { el, mostrar, cargando, vigencia, aviso } from '../dom.js';
import { hayBackend } from '../supabase.js';
import { usuario, pedirLogin } from '../auth.js';
import { soyAdmin } from '../fotos.js';
import {
  estadoTorneo, rankingTorneo, inscribirme, ganadores, panelTorneo, candidatasRecetaDelMes, registrarGanador, marcarPagado,
  textoPeriodo, faltaParaCierre, pesos, nombreMes, fechaLarga, diaSiguiente, INSTAGRAM, enlaceInstagram,
} from '../torneo.js';
import { icono } from '../iconos.js';
import { rutaPerfil } from './comunidad.js';
import { rutaReceta } from '../rutas.js';
import { pagina, contacto } from './legales.js';

const JUEGOS = [['pais', 'Adiviná el país', 'pais'], ['falta', '¿Qué le falta?', 'rompecabezas'], ['armar', 'Armá el plato', 'olla']];
const yaEmpezo = (e) => e.numero >= 1;

function tablaRanking(filas, { vacio }) {
  if (!filas.length) return el('p', { class: 'meta' }, vacio);
  const items = [];
  filas.forEach((f, i) => {
    if (i > 0 && f.puesto > filas[i - 1].puesto + 1) items.push(el('li', { class: 'ranking-salto', 'aria-hidden': 'true' }, '…'));
    items.push(el('li', { class: `${f.soyYo ? 'soy-yo' : ''}${f.puesto === 1 ? ' primero' : ''}` },
      el('span', { class: 'ranking-puesto' }, f.puesto === 1 ? icono('trofeo') : `${f.puesto}.`),
      el('span', { class: 'ranking-nombre' },
        el('a', { href: rutaPerfil(f.userId) }, f.nombre), f.soyYo ? ' (vos)' : '',
        !f.habilitado && el('small', { title: 'Le falta inscribirse o la cuenta es muy nueva para cobrar el premio' }, ' · sin habilitar')),
      el('span', { class: 'ranking-puntos' }, `${f.puntos.toLocaleString('es-AR')} pts`)));
  });
  return el('ol', { class: 'ranking ranking-torneo' }, items);
}

// Partidas oficiales de hoy: ✓ jugada (con puntos) o pendiente.
function oficialesHoy(estado) {
  return el('ul', { class: 'torneo-hoy' }, JUEGOS.map(([clave, nombre, simbolo]) => {
    const p = estado.oficialesHoy?.[clave];
    return el('li', { class: p ? 'jugada' : '' },
      el('a', { href: `/juegos/${clave}` },
        el('span', { class: 'torneo-hoy-icono', 'aria-hidden': 'true' }, icono(p ? 'tilde' : simbolo)),
        el('span', {}, el('strong', {}, nombre), el('small', {}, p ? (p.terminada ? `${p.puntos} pts` : 'En curso') : 'Pendiente'))));
  }));
}

// Tarjeta para la portada de Juegos.
export function tarjetaTorneo() {
  const cuerpo = el('div', { class: 'torneo-tarjeta-cuerpo' }, el('p', { class: 'meta' }, 'Cargando el torneo…'));
  const tarjeta = el('section', { class: 'torneo-tarjeta' },
    el('div', { class: 'torneo-tarjeta-cabecera' },
      el('span', { class: 'torneo-tarjeta-icono', 'aria-hidden': 'true' }, icono('trofeo')),
      el('div', {}, el('p', { class: 'portada-antetitulo' }, 'Torneo de juegos'), el('h2', {}, 'Jugá y ganá plata'))),
    cuerpo);
  Promise.all([estadoTorneo(), rankingTorneo().catch(() => [])])
    .then(([e, filas]) => {
      const yo = filas.find((f) => f.soyYo);
      cuerpo.replaceChildren(...[
        el('p', { class: 'torneo-premio' }, el('strong', {}, pesos(e.premioJuegos)), ' para el puesto 1 de cada quincena.'),
        el('p', { class: 'meta' }, yaEmpezo(e)
          ? ['Quincena ', textoPeriodo(e.inicio, e.fin), ' · cierra en ', el('strong', {}, faltaParaCierre(e.fin))]
          : `Empieza el ${fechaLarga(diaSiguiente(e.fin))}. Mientras tanto, practicá.`),
        usuario() && oficialesHoy(e),
        usuario() && yo && el('p', { class: 'torneo-puesto' }, `Vas ${yo.puesto}° con ${yo.puntos.toLocaleString('es-AR')} puntos.`),
        el('a', { class: 'boton', href: '/torneo' }, usuario() ? 'Ver ranking y reglas' : 'Cómo participar'),
      ].filter(Boolean));
    })
    .catch((err) => cuerpo.replaceChildren(el('p', { class: 'meta' }, err.message)));
  return tarjeta;
}

function cajaInscripcion(estado, alInscribirse) {
  if (!usuario()) {
    return el('div', { class: 'torneo-inscripcion' },
      el('p', {}, 'Para participar necesitás una cuenta. Es gratis.'),
      el('button', { type: 'button', class: 'boton', onclick: () => pedirLogin('/torneo') }, 'Entrar o crear cuenta'));
  }
  if (estado.inscripto) {
    const desde = new Date(estado.cuentaDesde);
    const habil = new Date(`${estado.fin}T23:59:59-03:00`).getTime() - desde.getTime() >= estado.antiguedadDias * 86400000;
    return el('div', { class: 'torneo-inscripcion lista' },
      el('p', {}, icono('tilde'), ' Estás inscripto/a. Tus partidas oficiales suman para el premio.'),
      !habil && el('p', { class: 'meta' }, `Tu cuenta es nueva: para cobrar el premio tiene que tener al menos ${estado.antiguedadDias} días al cierre de la quincena. Igual sumás puntos.`));
  }
  const mayor = el('input', { type: 'checkbox' });
  const argentina = el('input', { type: 'checkbox' });
  const sigo = el('input', { type: 'checkbox' });
  const bases = el('input', { type: 'checkbox' });
  const instagram = el('input', {
    type: 'text', placeholder: '@tuusuario', maxlength: '31', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
    value: estado.instagram ? `@${estado.instagram}` : '',
  });
  const boton = el('button', { type: 'submit', class: 'boton' }, 'Inscribirme');
  return el('form', {
    class: 'torneo-inscripcion',
    onsubmit: async (ev) => {
      ev.preventDefault();
      if (!mayor.checked || !argentina.checked || !sigo.checked || !bases.checked) { aviso('Marcá las cuatro casillas para inscribirte.', 'error'); return; }
      if (!/^@?[A-Za-z0-9._]{1,30}$/.test(instagram.value.trim())) { aviso('Escribí tu usuario de Instagram (por ejemplo: @tuusuario).', 'error'); instagram.focus(); return; }
      boton.disabled = true;
      try {
        await inscribirme(instagram.value.trim());
        aviso('¡Listo! Ya estás en el torneo.');
        alInscribirse();
      } catch (err) {
        aviso(err.message, 'error');
        boton.disabled = false;
      }
    },
  },
  el('p', {}, el('strong', {}, 'Inscribite para competir por el premio')),
  el('label', {}, mayor, el('span', {}, 'Soy mayor de 18 años')),
  el('label', {}, argentina, el('span', {}, 'Vivo en Argentina')),
  el('label', {}, sigo, el('span', {}, 'Sigo a ', el('a', { href: enlaceInstagram(INSTAGRAM), target: '_blank', rel: 'noopener' }, `@${INSTAGRAM}`), ' en Instagram')),
  el('label', { class: 'torneo-instagram' }, el('span', {}, 'Tu usuario de Instagram (para verificarlo si ganás)'), instagram),
  el('label', {}, bases, el('span', {}, 'Leí y acepto las ', el('a', { href: '/bases', target: '_blank' }, 'bases y condiciones'))),
  boton);
}

function listaGanadores(lista) {
  if (!lista.length) return el('p', { class: 'meta' }, 'Todavía no hay ganadores: ¡el primero puede ser tuyo!');
  return el('ul', { class: 'torneo-ganadores' }, lista.map((g) => el('li', {},
    el('span', { class: 'torneo-ganadores-icono', 'aria-hidden': 'true' }, icono(g.tipo === 'receta' ? 'libro' : 'trofeo')),
    el('span', {},
      el('strong', {}, g.user_id ? el('a', { href: rutaPerfil(g.user_id) }, g.nombre) : g.nombre),
      el('small', {}, g.tipo === 'receta'
        ? ['Receta del mes (', nombreMes(g.periodo), '): ', g.receta_id ? el('a', { href: rutaReceta(g.receta_id, g.receta_nombre || '') }, g.receta_nombre) : g.receta_nombre]
        : `Torneo de juegos · quincena del ${g.periodo.split('-').reverse().join('/')}`)),
    g.monto && el('span', { class: 'torneo-ganadores-monto' }, pesos(g.monto)))));
}

export async function vistaTorneo() {
  document.title = 'Torneo de juegos · A Mano';
  if (!hayBackend) { mostrar(el('p', { class: 'estado' }, 'El torneo no está disponible.')); return; }
  const vigente = vigencia();
  cargando();
  let estado;
  let filas;
  let lista;
  try {
    [estado, filas, lista] = await Promise.all([estadoTorneo(), rankingTorneo(), ganadores().catch(() => [])]);
  } catch (err) {
    if (vigente()) mostrar(el('p', { class: 'estado' }, err.message));
    return;
  }
  if (!vigente()) return;
  mostrar(
    el('a', { class: 'volver', href: '/juegos' }, '← Juegos'),
    el('section', { class: 'torneo-portada' },
      el('p', { class: 'portada-antetitulo' }, yaEmpezo(estado) ? `Quincena ${textoPeriodo(estado.inicio, estado.fin)}` : 'Próximamente'),
      el('h1', {}, 'Torneo de juegos'),
      el('p', { class: 'torneo-premio grande' }, el('strong', {}, pesos(estado.premioJuegos)), ' para el puesto 1'),
      yaEmpezo(estado)
        ? el('p', { class: 'meta' }, 'Cierra en ', el('strong', {}, faltaParaCierre(estado.fin)), ' (el último día a las 23:59, hora de Argentina).')
        : el('p', { class: 'meta' }, `Empieza el ${fechaLarga(diaSiguiente(estado.fin))}. Mientras tanto, practicá: las partidas de ahora no suman.`),
      el('p', { class: 'meta' }, 'Y además: ', el('strong', {}, `${pesos(estado.premioReceta)} para la receta del mes`), ' de la comunidad.')),
    cajaInscripcion(estado, () => vistaTorneo()),
    usuario() && el('section', { class: 'seccion' }, el('h2', {}, 'Tus partidas oficiales de hoy'), oficialesHoy(estado)),
    el('section', { class: 'seccion' },
      el('h2', {}, yaEmpezo(estado) ? 'Ranking de la quincena' : 'Ranking de prueba (todavía sin premio)'),
      tablaRanking(filas, { vacio: 'Todavía nadie jugó esta quincena. ¡Arrancá vos!' })),
    el('section', { class: 'seccion torneo-reglas' },
      el('h2', {}, 'Cómo funciona'),
      el('ul', {},
        el('li', {}, 'Suman ', el('strong', {}, 'Adiviná el país, ¿Qué le falta? y Armá el plato'), '. El Plato del día no suma: es el mismo para todos.'),
        el('li', {}, el('strong', {}, 'Cada día cuenta tu primera partida de cada juego'), ' (la oficial). Las demás son de práctica: elegí bien la dificultad, en Difícil se ganan más puntos.'),
        el('li', {}, 'Los puntos los calcula el sistema, ronda por ronda. Cada quincena empieza de cero.'),
        el('li', {}, 'Si hay empate, gana quien jugó sus partidas oficiales en menos tiempo.'),
        el('li', {}, 'Para cobrar: ser mayor de 18, vivir en Argentina, seguir a ', el('a', { href: enlaceInstagram(INSTAGRAM), target: '_blank', rel: 'noopener' }, `@${INSTAGRAM}`), ' en Instagram, estar inscripto/a y tener una sola cuenta. El pago es por transferencia a una cuenta a tu nombre.')),
      el('p', {}, el('a', { href: '/bases' }, 'Leer las bases y condiciones completas'))),
    el('section', { class: 'seccion' }, el('h2', {}, 'Ganadores'), listaGanadores(lista)));
}

// ---------- receta del mes ----------

const mesDe = (iso) => iso.slice(0, 7);

// Aviso para Comunidad y Nueva receta: premio del mes y cómo participar.
export function avisoRecetaDelMes() {
  const caja = el('aside', { class: 'aviso-receta-mes', hidden: true });
  estadoTorneo().then((e) => {
    const empezo = e.hoy >= e.recetaDesde;
    caja.replaceChildren(
      el('span', { class: 'aviso-receta-mes-icono', 'aria-hidden': 'true' }, icono('trofeo')),
      el('div', {},
        el('strong', {}, empezo
          ? `Receta del mes de ${nombreMes(mesDe(e.hoy)).split(' ')[0]}: ${pesos(e.premioReceta)}`
          : `Receta del mes: ${pesos(e.premioReceta)} desde el ${fechaLarga(e.recetaDesde)}`),
        el('p', {}, empezo
          ? 'Subí tu receta casera este mes y participás. Elige un jurado por originalidad, claridad y fotos. '
          : 'Las recetas que se publiquen desde ese día participan. Elige un jurado por originalidad, claridad y fotos. ',
        usuario() && !e.inscripto ? [el('a', { href: '/torneo' }, 'Inscribite'), ' para poder cobrar · '] : '',
        el('a', { href: '/bases' }, 'Ver bases'))));
    caja.hidden = false;
  }).catch(() => { /* sin torneo instalado: no se muestra */ });
  return caja;
}

// Vidriera de recetas ganadoras (se oculta si todavía no hay).
export function vidrieraRecetasDelMes() {
  const seccion = el('section', { class: 'seccion vidriera-receta-mes', hidden: true });
  ganadores().then((lista) => {
    const recetas = lista.filter((g) => g.tipo === 'receta' && g.receta_id);
    if (!recetas.length) return;
    seccion.replaceChildren(
      el('h2', {}, icono('trofeo'), ' Recetas del mes'),
      el('ul', { class: 'vidriera-lista' }, recetas.slice(0, 6).map((g) => el('li', {},
        el('a', { href: rutaReceta(g.receta_id, g.receta_nombre || '') },
          el('small', {}, nombreMes(g.periodo)),
          el('strong', {}, g.receta_nombre),
          el('span', {}, `por ${g.nombre}`))))));
    seccion.hidden = false;
  }).catch(() => {});
  return seccion;
}

// ---------- bases y condiciones ----------

export function vistaBases() {
  document.title = 'Bases y condiciones del torneo · A Mano';
  mostrar(pagina('Bases y condiciones: torneo de juegos y receta del mes', [
    'Estas bases regulan los premios de A Mano (amanorecetas.com.ar): el torneo quincenal de juegos y la receta del mes. Participar implica aceptarlas. Son concursos gratuitos de habilidad: no hace falta comprar nada y no interviene el azar en la elección de ganadores.',
    ['h2', '1. Quién puede participar'],
    ['lista',
      'Personas mayores de 18 años que vivan en la República Argentina.',
      'Con una cuenta en A Mano con el email confirmado y la inscripción al torneo hecha (edad, residencia, usuario de Instagram y aceptación de estas bases).',
      'Seguir a la cuenta oficial @amanorecetas en Instagram, con el usuario informado en la inscripción. Se verifica al cierre de cada período y antes del pago.',
      'Para cobrar un premio, la cuenta tiene que tener al menos 7 días de antigüedad al cierre del período.',
      'Una sola cuenta por persona. No pueden ganar premios las personas que administran A Mano.'],
    ['h2', '2. Torneo de juegos'],
    ['lista',
      'Se juega por quincenas (14 días). Cada quincena cierra el último día a las 23:59 (hora de Argentina) y la siguiente empieza de cero. Las fechas y el premio vigentes se muestran en la página del torneo.',
      'Suman los juegos "Adiviná el país", "¿Qué le falta?" y "Armá el plato". El "Plato del día" no suma.',
      'Cada día cuenta solamente la primera partida de cada juego (la "partida oficial"), en la dificultad que se elija. Una partida empezada y abandonada cuenta con los puntos que tenga.',
      'Los puntos los calcula el sistema de A Mano, que arma cada ronda y mide el tiempo de respuesta. El ranking suma las partidas oficiales de la quincena.',
      'Gana el primer puesto entre las personas habilitadas. Si hay empate en puntos, gana quien sumó sus partidas oficiales en menos tiempo total; si sigue el empate, quien llegó primero a ese puntaje.'],
    ['h2', '3. Receta del mes'],
    ['lista',
      'Participan las recetas públicas de la comunidad publicadas durante el mes calendario por personas habilitadas.',
      'Las elige un jurado del equipo de A Mano según originalidad, claridad de los pasos, calidad de las fotos y que se pueda hacer con ingredientes fáciles de conseguir. Los "me gusta" son una referencia, no definen el resultado.',
      'La receta y sus fotos tienen que ser propias o con permiso de su autor. Una receta copiada de otro sitio queda descalificada.'],
    ['h2', '4. Premios y pago'],
    ['lista',
      'El monto de cada premio se publica en la página del torneo antes del inicio de cada período. Es en pesos argentinos y no se puede cambiar por otra cosa.',
      'Dentro de los 7 días del cierre, A Mano contacta a la persona ganadora por el email de su cuenta. Tiene 7 días para responder con su nombre completo, una foto de su DNI y un CBU, CVU o alias de una cuenta a su nombre.',
      'Si no responde a tiempo, no cumple los requisitos (por ejemplo, si no sigue a @amanorecetas) o los datos no coinciden, el premio pasa al siguiente puesto habilitado (o a otra receta, en el caso de la receta del mes).',
      'El pago se hace por transferencia dentro de los 10 días de recibidos los datos. Si correspondiera algún impuesto o retención, se le informa a la persona ganadora antes de pagar.',
      'Los ganadores se publican en la web y en las redes de A Mano con su nombre visible en la cuenta (nunca su DNI ni su email).'],
    ['h2', '5. Juego limpio'],
    ['lista',
      'Está prohibido usar más de una cuenta, programas o bots, automatizar respuestas, aprovechar errores del sistema o recibir ayuda organizada de otras personas.',
      'A Mano puede revisar las partidas y anular puntajes, descalificar cuentas o dejar un premio sin entregar si detecta trampas, incluso después del cierre.'],
    ['h2', '6. Datos personales'],
    'Los datos que se piden para pagar (nombre, DNI y cuenta bancaria) se usan sólo para verificar la identidad, hacer el pago y cumplir obligaciones legales. Se tratan según la Política de privacidad de A Mano.',
    ['h2', '7. Cambios'],
    'A Mano puede modificar, suspender o terminar el torneo o la receta del mes avisando en la web, sin afectar premios ya ganados. Esta promoción no está patrocinada, avalada ni administrada por Instagram, Meta ni ninguna otra red social.',
    ['h2', '8. Contacto'],
    ['Consultas y reclamos: ', contacto(), '.'],
  ], { volver: ['/torneo', '← Torneo'] }));
}

// ---------- administración ----------

export async function vistaAdminTorneo() {
  document.title = 'Panel del torneo · A Mano';
  if (!usuario()) { pedirLogin('/admin/torneo'); return; }
  const vigente = vigencia();
  cargando();
  if (!(await soyAdmin())) { if (vigente()) mostrar(el('p', { class: 'estado' }, 'Sólo para administradores.')); return; }
  let estado;
  try { estado = await estadoTorneo(); } catch (err) { if (vigente()) mostrar(el('p', { class: 'estado' }, err.message)); return; }
  if (!vigente()) return;

  const numero = el('input', { type: 'number', min: '1', value: Math.max(1, estado.numero), style: 'width:5em' });
  const tabla = el('div', { class: 'admin-tabla' });
  async function cargarTop() {
    tabla.replaceChildren(el('p', { class: 'meta' }, 'Cargando…'));
    try {
      const filas = await panelTorneo(Number(numero.value));
      if (!filas.length) { tabla.replaceChildren(el('p', { class: 'meta' }, 'Sin partidas oficiales en esa quincena.')); return; }
      tabla.replaceChildren(el('table', {},
        el('thead', {}, el('tr', {}, ['#', 'Nombre', 'Email', 'Instagram', 'Puntos', 'Partidas', 'Tiempo', 'Habilitado', 'Cuenta desde', 'Rápidas', 'Mín. ms', 'Mismo disp.', ''].map((h) => el('th', {}, h)))),
        el('tbody', {}, filas.map((f) => {
          const alertas = Number(f.respuestas_rapidas) > 3 || Number(f.cuentas_mismo_dispositivo) > 0;
          return el('tr', { class: alertas ? 'alerta' : '' },
            el('td', {}, f.puesto), el('td', {}, el('a', { href: rutaPerfil(f.user_id) }, f.nombre)), el('td', {}, f.email),
            el('td', {}, f.instagram ? el('a', { href: enlaceInstagram(f.instagram), target: '_blank', rel: 'noopener' }, `@${f.instagram}`) : '—'),
            el('td', {}, Number(f.puntos).toLocaleString('es-AR')), el('td', {}, f.partidas), el('td', {}, `${f.segundos} s`),
            el('td', {}, f.habilitado ? 'Sí' : 'No'), el('td', {}, new Date(f.cuenta_desde).toLocaleDateString('es-AR')),
            el('td', {}, f.respuestas_rapidas), el('td', {}, f.ms_minimo), el('td', {}, f.cuentas_mismo_dispositivo),
            el('td', {}, el('button', {
              type: 'button', class: 'boton-secundario', onclick: async () => {
                const per = await periodoDe(Number(numero.value));
                const monto = Number(prompt(`Premio para ${f.nombre} (quincena del ${per}):`, estado.premioJuegos));
                if (!monto) return;
                try {
                  await registrarGanador({ tipo: 'juegos', periodo: per, user_id: f.user_id, nombre: f.nombre, monto });
                  aviso('Ganador registrado.');
                  cargarGanadores();
                } catch (err) { aviso(err.message, 'error'); }
              },
            }, 'Ganador')));
        }))));
    } catch (err) {
      tabla.replaceChildren(el('p', { class: 'error' }, err.message));
    }
  }
  // Fecha de inicio de una quincena (para identificarla).
  async function periodoDe(n) {
    const base = new Date(`${estado.inicio}T12:00:00Z`);
    base.setUTCDate(base.getUTCDate() + (n - estado.numero) * 14);
    return base.toISOString().slice(0, 10);
  }

  const mes = el('input', { type: 'month', value: new Date().toISOString().slice(0, 7) });
  const candidatas = el('div', { class: 'admin-tabla' });
  async function cargarCandidatas() {
    candidatas.replaceChildren(el('p', { class: 'meta' }, 'Cargando…'));
    try {
      const filas = await candidatasRecetaDelMes(mes.value);
      if (!filas.length) { candidatas.replaceChildren(el('p', { class: 'meta' }, 'No hay recetas de la comunidad que participen ese mes.')); return; }
      candidatas.replaceChildren(el('table', {},
        el('thead', {}, el('tr', {}, ['Receta', 'Autor', 'Instagram', 'Me gusta', 'Publicada', 'Habilitado', ''].map((h) => el('th', {}, h)))),
        el('tbody', {}, filas.map((f) => el('tr', {},
          el('td', {}, el('a', { href: rutaReceta(`u-${f.id}`, f.nombre), target: '_blank' }, f.nombre)),
          el('td', {}, el('a', { href: rutaPerfil(f.user_id) }, f.autor || '—')),
          el('td', {}, f.instagram ? el('a', { href: enlaceInstagram(f.instagram), target: '_blank', rel: 'noopener' }, `@${f.instagram}`) : '—'),
          el('td', {}, f.me_gusta),
          el('td', {}, new Date(f.creada).toLocaleDateString('es-AR')),
          el('td', { title: 'Inscripto en el torneo y con la antigüedad mínima al cierre del mes' }, f.habilitado ? 'Sí' : 'No'),
          el('td', {}, el('button', {
            type: 'button', class: 'boton-secundario', onclick: async () => {
              const monto = Number(prompt(`Premio para "${f.nombre}" (receta de ${nombreMes(mes.value)}):`, estado.premioReceta));
              if (!monto) return;
              try {
                await registrarGanador({ tipo: 'receta', periodo: mes.value, user_id: f.user_id, nombre: f.autor || 'Cocinero/a', receta_id: `u-${f.id}`, receta_nombre: f.nombre, monto });
                aviso('Receta del mes registrada.');
                cargarGanadores();
              } catch (err) { aviso(err.message, 'error'); }
            },
          }, 'Elegir')))))));
    } catch (err) {
      candidatas.replaceChildren(el('p', { class: 'error' }, err.message));
    }
  }

  const listaG = el('div', { class: 'admin-tabla' });
  async function cargarGanadores() {
    try {
      const filas = await ganadores();
      listaG.replaceChildren(filas.length ? el('table', {},
        el('thead', {}, el('tr', {}, ['Tipo', 'Período', 'Ganador', 'Monto', 'Pagado'].map((h) => el('th', {}, h)))),
        el('tbody', {}, filas.map((g) => {
          const casilla = el('input', {
            type: 'checkbox', checked: Boolean(g.pagado),
            onchange: () => marcarPagado(g.tipo, g.periodo, casilla.checked).then(() => aviso('Guardado.')).catch((err) => aviso(err.message, 'error')),
          });
          return el('tr', {}, el('td', {}, g.tipo === 'receta' ? 'Receta del mes' : 'Juegos'), el('td', {}, g.periodo),
            el('td', {}, g.nombre, g.receta_nombre ? ` · ${g.receta_nombre}` : ''), el('td', {}, pesos(g.monto || 0)), el('td', {}, casilla));
        }))) : el('p', { class: 'meta' }, 'Todavía no hay ganadores.'));
    } catch (err) {
      listaG.replaceChildren(el('p', { class: 'error' }, err.message));
    }
  }

  mostrar(
    el('h1', {}, 'Panel del torneo'),
    el('p', { class: 'meta' }, `Quincena actual: n.º ${estado.numero} (${textoPeriodo(estado.inicio, estado.fin)}). Antes de pagar revisá las alertas ("Rápidas": respuestas en menos de 0,7 s; "Mismo disp.": otras cuentas desde el mismo navegador) y entrá a su Instagram para confirmar que sigue a @${INSTAGRAM}.`),
    el('section', { class: 'seccion' },
      el('h2', {}, 'Top 20 de la quincena'),
      el('label', { class: 'admin-filtro' }, 'Quincena n.º ', numero, el('button', { type: 'button', class: 'boton-secundario', onclick: cargarTop }, 'Ver')),
      tabla),
    el('section', { class: 'seccion' },
      el('h2', {}, 'Receta del mes'),
      el('label', { class: 'admin-filtro' }, 'Mes ', mes, el('button', { type: 'button', class: 'boton-secundario', onclick: cargarCandidatas }, 'Ver candidatas')),
      candidatas),
    el('section', { class: 'seccion' }, el('h2', {}, 'Ganadores registrados'), listaG));
  cargarTop();
  cargarCandidatas();
  cargarGanadores();
}
