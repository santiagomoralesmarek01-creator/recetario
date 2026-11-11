/*
 * Lógica de horarios: convierte fichadas en formularios prellenados.
 * Sin dependencias. Se usa desde app.js (navegador) y desde test.js (node).
 */
(function (root) {
  'use strict';

  const TOLERANCIA = 25; // minutos tarde por período (16 al 15)

  const HORARIOS = [
    'FRANCO',
    '05:00 a 13:00', '05:00 a 14:00', '05:30 a 11:30', '05:30 a 12:30',
    '06:00 a 13:00', '06:00 a 14:00', '06:00 a 15:00', '06:30 a 14:30',
    '06:30 a 15:30', '07:00 a 15:00', '07:00 a 16:00', '07:00 a 13:30',
    '07:30 a 13:00', '07:30 a 13:30', '07:30 a 15:30', '07:30 a 16:30',
    '08:00 a 13:00', '08:00 a 15:00', '08:00 a 16:00', '08:00 a 17:00',
    '08:30 a 13:30', '08:30 a 16:30', '08:30 a 17:30', '09:00 a 17:00',
    '09:00 a 18:00', '09:30 a 17:30', '09:30 a 18:30', '10:00 a 18:00',
    '10:00 a 19:00', '10:30 a 18:30', '10:30 a 19:30', '11:00 a 19:00',
    '11:00 a 20:00', '11:30 a 19:30', '11:30 a 20:30', '12:00 a 20:00',
    '12:00 a 19:00', '12:30 a 19:30', '12:30 a 20:30', '13:00 a 20:00',
  ];

  const FORMS = {
    cambio: 'https://docs.google.com/forms/d/e/1FAIpQLSfMGGdpaf8xcn7h-vIoamG4YXRIhJRrIxrA3PtTGDrwbY2gaA/viewform',
    extra: 'https://docs.google.com/forms/d/e/1FAIpQLScBbeh5KOhmgJd4mWKxRw_cXKl_vYO3cUtY4GSTNf3DQaDGwA/viewform',
    compenso: 'https://docs.google.com/forms/d/e/1FAIpQLSd8eMANz5s4lL8b1UxFc2Xhq2mUZpAKtOp79ckW_qVrFbM36Q/viewform',
  };

  // ───────────── fechas y horas ─────────────

  const pad = (n) => String(n).padStart(2, '0');
  const isoDe = (d, m, y) => `${y}-${pad(m)}-${pad(d)}`;
  const aDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const deDate = (dt) => dt.toISOString().slice(0, 10);
  const sumarDias = (iso, n) => { const d = aDate(iso); d.setUTCDate(d.getUTCDate() + n); return deDate(d); };
  const diaSemana = (iso) => aDate(iso).getUTCDay(); // 0 dom … 6 sáb
  const sabadoDeSemana = (iso) => { const w = diaSemana(iso); return sumarDias(iso, w === 0 ? -1 : 6 - w); };
  const corta = (iso) => { const [y, m, d] = iso.split('-'); return `${Number(d)}/${Number(m)}/${y.slice(2)}`; };
  const larga = (iso) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
  const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const nombreDia = (iso) => `${DIAS[diaSemana(iso)]} ${larga(iso).slice(0, 5)}`;

  const hm = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
  const dur = (min) => `${Math.floor(min / 60)}:${pad(min % 60)}`;
  const dec = (min) => { const x = Math.round((min / 60) * 100) / 100; return Number.isInteger(x) ? `${x}.0` : String(x); };
  const aMin = (txt) => {
    const m = String(txt || '').trim().match(/^(\d{1,2})(?:[:.,](\d{2}))?$/);
    if (!m) return null;
    const h = Number(m[1]), mm = Number(m[2] || 0);
    return h < 24 && mm < 60 ? h * 60 + mm : null;
  };

  /** Período de tolerancia (16 al 15) al que pertenece una fecha. */
  function periodo(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    let ym = y, mm = m;
    if (d < 16) { mm -= 1; if (mm === 0) { mm = 12; ym -= 1; } }
    const desde = isoDe(16, mm, ym);
    let hy = ym, hmo = mm + 1; if (hmo === 13) { hmo = 1; hy += 1; }
    const hasta = isoDe(15, hmo, hy);
    return { clave: desde, desde, hasta, nombre: `16/${pad(mm)} al 15/${pad(hmo)}/${hy}` };
  }

  /** Lee fechas sueltas: "24/10/2026", "24-10-26", "2026-10-24", una por línea o separadas por coma. */
  function leerFechas(texto, anioDefecto) {
    const out = [];
    for (const parte of String(texto || '').split(/[\n,;]+/)) {
      const t = parte.trim();
      if (!t) continue;
      let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (m) { out.push(isoDe(+m[3], +m[2], +m[1])); continue; }
      m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?/);
      if (m) {
        let y = m[3] ? +m[3] : anioDefecto;
        if (y < 100) y += 2000;
        out.push(isoDe(+m[1], +m[2], y));
      }
    }
    return out;
  }

  // ───────────── fichadas ─────────────

  /**
   * Lee el texto pegado del sistema de fichadas.
   * Formato esperado por línea: 14-10-2026  06:48  Entrada
   */
  function leerFichadas(texto) {
    const dias = {};
    const noLeidas = [];
    for (const linea of String(texto || '').split(/\r?\n/)) {
      const t = linea.trim();
      if (!t) continue;
      const m = t.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\D+?(\d{1,2})[:.](\d{2})(?:\s*\S*\s*(entrada|salida|ent|sal|e|s)\b)?/i);
      if (!m) { noLeidas.push(t); continue; }
      let y = +m[3]; if (y < 100) y += 2000;
      const iso = isoDe(+m[1], +m[2], y);
      const min = +m[4] * 60 + +m[5];
      const tipo = (m[6] || '').toLowerCase();
      const d = (dias[iso] ||= { entradas: [], salidas: [], sinTipo: [] });
      if (tipo.startsWith('e')) d.entradas.push(min);
      else if (tipo.startsWith('s')) d.salidas.push(min);
      else d.sinTipo.push(min);
    }
    // Sin "Entrada/Salida": la primera marca del día es entrada y la última salida.
    for (const d of Object.values(dias)) {
      if (d.sinTipo.length) {
        const todas = d.sinTipo.sort((a, b) => a - b);
        if (!d.entradas.length) d.entradas.push(todas.shift());
        if (todas.length && !d.salidas.length) d.salidas.push(todas.pop());
      }
    }
    return { dias, noLeidas };
  }

  /** "14/10 07:00 a 08:00" → horas extra que no salen del cálculo (ej. antes de entrar). */
  function leerExtrasManuales(texto, anioDefecto) {
    const out = [];
    const errores = [];
    for (const linea of String(texto || '').split(/\r?\n/)) {
      const t = linea.trim();
      if (!t) continue;
      const m = t.match(/^(\S+)\s+(?:de\s+)?(\d{1,2}(?:[:.]\d{2})?)\s*(?:a|-|hasta)\s*(\d{1,2}(?:[:.]\d{2})?)/i);
      const f = m && leerFechas(m[1], anioDefecto)[0];
      const i = m && aMin(m[2].replace('.', ':')), fin = m && aMin(m[3].replace('.', ':'));
      if (!f || i == null || fin == null || fin <= i) { errores.push(t); continue; }
      out.push({ fecha: f, inicio: i, fin });
    }
    return { extras: out, errores };
  }

  // ───────────── reglas ─────────────

  /**
   * Procesa las fichadas con la configuración de la persona.
   * config: { legajo, autoriza, entrada:'08:00', sabados:[iso], feriados:[iso], salidaViernes:bool, hoy: iso }
   */
  function procesar(config, textoFichadas, textoExtras) {
    const P = aMin(config.entrada) ?? 480;
    const sabados = new Set(config.sabados || []);
    const feriados = new Set(config.feriados || []);
    const { dias: fich, noLeidas } = leerFichadas(textoFichadas);
    const fechas = Object.keys(fich).sort();
    const avisos = noLeidas.map((l) => ({ tipo: 'error', texto: `No entendí esta línea: "${l}"` }));
    if (!fechas.length) return { dias: [], formularios: [], avisos, extras: [] };

    const anio = +fechas[0].slice(0, 4);
    const { extras: manuales, errores } = leerExtrasManuales(textoExtras, anio);
    errores.forEach((l) => avisos.push({ tipo: 'error', texto: `No entendí esta hora extra: "${l}". Usá el formato 14/10 07:00 a 08:00.` }));

    // Rango: del primer día con fichada hasta el sábado de la última semana.
    const ini = fechas[0];
    let fin = fechas[fechas.length - 1];
    if (diaSemana(fin) >= 1 && diaSemana(fin) <= 5) fin = sabadoDeSemana(fin);

    const dias = [];
    for (let f = ini; f <= fin; f = sumarDias(f, 1)) {
      const w = diaSemana(f);
      if (w === 0) continue;
      const semanaConSabado = sabados.has(sabadoDeSemana(f));
      const d = { fecha: f, nombre: nombreDia(f), periodo: periodo(f).clave, avisos: [] };
      const marcas = fich[f];
      d.fichadas = marcas ? [...marcas.entradas.map((m) => `E ${hm(m)}`), ...marcas.salidas.map((m) => `S ${hm(m)}`)].join(' · ') : '';

      if (feriados.has(f)) { d.tipo = 'feriado'; dias.push(d); continue; }

      if (w === 6 && !sabados.has(f)) {
        d.tipo = 'franco';
        d.horario = 'FRANCO';
        d.llevaCambio = true;
        if (marcas) d.avisos.push('Hay una fichada en un sábado de franco: lo tomé como franco (¿error de sistema?).');
        dias.push(d); continue;
      }

      const J = w === 6 ? 5 : semanaConSabado ? 8 : 9;
      d.jornada = J;
      let E = marcas && marcas.entradas.length ? Math.min(...marcas.entradas) : null;
      let S = marcas && marcas.salidas.length ? Math.max(...marcas.salidas) : null;

      if (E == null && S == null) {
        if (f <= (config.hoy || f)) {
          d.tipo = 'sinFichada';
          d.avisos.push('Día hábil sin fichada y no es feriado (¿examen, licencia?). El formulario de ese día lo hacés aparte.');
        } else d.tipo = 'futuro';
        dias.push(d); continue;
      }
      if (S == null && w === 5 && !semanaConSabado && config.salidaViernes !== false) {
        S = E - P > TOLERANCIA ? Math.ceil(E / 30) * 30 + J * 60 : P + J * 60;
        d.salidaSupuesta = true;
        d.avisos.push(`Viernes sin salida fichada: supuse salida ${hm(S)}.`);
      }
      if (E == null || S == null) {
        d.tipo = 'incompleto';
        d.avisos.push(E == null ? 'Falta la entrada de este día.' : 'Falta la salida de este día.');
        dias.push(d); continue;
      }

      d.tipo = 'trabajo';
      d.entrada = E; d.salida = S;
      const tarde = Math.max(0, E - P);
      let inicio;
      if (tarde > TOLERANCIA) inicio = Math.ceil(E / 30) * 30;
      else if (E < P && S < P + J * 60) inicio = Math.ceil(E / 30) * 30;
      else inicio = P;
      const finJ = inicio + J * 60;
      d.minutosTarde = inicio === P ? tarde : 0;
      d.horario = `${hm(inicio)} a ${hm(finJ)}`;
      d.inicio = inicio; d.finJornada = finJ;

      if (S >= finJ) {
        const extra = Math.floor((S - finJ) / 60) * 60;
        if (extra >= 60) d.extra = { inicio: finJ, fin: finJ + extra };
      } else {
        const desde = Math.floor(S / 30) * 30;
        d.ausencia = { inicio: desde, fin: finJ };
      }

      const esBase = semanaConSabado && (
        (w === 6 && inicio === P && J === 5) || (w !== 6 && inicio === P && J === 8)
      );
      d.llevaCambio = !esBase;
      if (!HORARIOS.includes(d.horario)) d.avisos.push(`El horario ${d.horario} no está en la lista del formulario: revisalo.`);
      dias.push(d);
    }

    // Horas extra manuales
    for (const x of manuales) {
      const d = dias.find((y) => y.fecha === x.fecha);
      const reg = { inicio: x.inicio, fin: x.fin, manual: true };
      if (d) (d.extrasManuales ||= []).push(reg);
      else dias.push({ fecha: x.fecha, nombre: nombreDia(x.fecha), periodo: periodo(x.fecha).clave, tipo: 'soloExtra', avisos: [], extrasManuales: [reg] });
    }
    dias.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));

    return { dias, formularios: armarFormularios(config, dias), avisos };
  }

  // ───────────── formularios ─────────────

  function q(params) {
    return Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  }
  // Si la persona cargó su correo institucional, el formulario abre con esa cuenta de Google.
  const cuenta = (c) => (c.correo ? `&authuser=${encodeURIComponent(c.correo)}` : '');

  function linkCambio(c, desde, hasta, horario) {
    return `${FORMS.cambio}?usp=pp_url&${q({
      'entry.900017307': c.legajo || '', 'entry.1528594203': desde, 'entry.2109968715': hasta,
      'entry.2127864431': horario, 'entry.1151882347': c.autoriza || '',
    })}${cuenta(c)}`;
  }
  function linkExtra(c, fecha, i, f) {
    return `${FORMS.extra}?usp=pp_url&${q({
      'entry.229384531': c.legajo || '', 'entry.112500555': fecha,
      'entry.251974133': dec(i), 'entry.1689353134': dec(f), 'entry.452996826': c.autoriza || '',
    })}${cuenta(c)}`;
  }
  function linkCompenso(c, fecha, i, f, obs) {
    return `${FORMS.compenso}?usp=pp_url&${q({
      'entry.1528594203': c.legajo || '', 'entry.2109968715': fecha, 'entry.332423151': hm(i),
      'entry.603509872': hm(f), 'entry.2127864431': 'Compenso', 'entry.662001101': obs,
      'entry.1251953952': c.autoriza || '',
    })}${cuenta(c)}`;
  }

  function observacionCompenso(d, cobertura) {
    const a = d.ausencia;
    const tramo = `${corta(d.fecha)} de ${hm(a.inicio)} a ${hm(a.fin)} (${dur(a.fin - a.inicio)} h)`;
    if (!cobertura || cobertura.tipo === 'adeudada') return `Horas adeudadas: ${tramo}`;
    if (cobertura.tipo === 'servicio') return 'Horas a favor del servicio';
    return cobertura.texto || `Horas adeudadas: ${tramo}`;
  }

  function armarFormularios(c, dias, coberturas) {
    const out = [];
    // Cambio de horario: días seguidos con el mismo horario van juntos.
    let grupo = null;
    for (const d of dias) {
      if (!d.llevaCambio || !d.horario) { grupo = null; continue; }
      if (grupo && grupo.horario === d.horario && sumarDias(grupo.hasta, 1) === d.fecha) {
        grupo.hasta = d.fecha;
      } else {
        grupo = { tipo: 'cambio', desde: d.fecha, hasta: d.fecha, horario: d.horario };
        out.push(grupo);
      }
    }
    for (const g of out) {
      g.id = `cambio:${g.desde}:${g.hasta}:${g.horario}`;
      g.titulo = g.desde === g.hasta ? `${nombreDia(g.desde)}` : `${nombreDia(g.desde)} al ${nombreDia(g.hasta)}`;
      g.detalle = g.horario;
      g.link = linkCambio(c, g.desde, g.hasta, g.horario);
    }
    for (const d of dias) {
      if (d.ausencia) {
        const cob = coberturas && coberturas[d.fecha];
        const obs = observacionCompenso(d, cob);
        out.push({
          tipo: 'compenso', id: `compenso:${d.fecha}`, fecha: d.fecha,
          titulo: nombreDia(d.fecha), detalle: `Ausencia de ${hm(d.ausencia.inicio)} a ${hm(d.ausencia.fin)} (${dur(d.ausencia.fin - d.ausencia.inicio)} h)`,
          observacion: obs, link: linkCompenso(c, d.fecha, d.ausencia.inicio, d.ausencia.fin, obs),
        });
      }
      for (const x of [d.extra, ...(d.extrasManuales || [])].filter(Boolean)) {
        out.push({
          tipo: 'extra', id: `extra:${d.fecha}:${x.inicio}`, fecha: d.fecha,
          titulo: nombreDia(d.fecha), detalle: `Horas extra de ${hm(x.inicio)} a ${hm(x.fin)} (${dur(x.fin - x.inicio)} h)`,
          link: linkExtra(c, d.fecha, x.inicio, x.fin),
        });
      }
    }
    return out;
  }

  /** Totales a partir del historial de días (todos los procesados). */
  function resumen(historial, hoy) {
    const dias = Object.values(historial).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    const ult = dias.length ? dias[dias.length - 1].fecha : hoy;
    const per = periodo(hoy && hoy > ult ? hoy : ult);
    let tarde = 0;
    const tardeDetalle = [];
    const adeudadas = [];
    const aFavor = [];
    for (const d of dias) {
      if (d.periodo === per.clave && d.minutosTarde) { tarde += d.minutosTarde; tardeDetalle.push({ fecha: d.fecha, min: d.minutosTarde }); }
      if (d.ausencia) adeudadas.push({ fecha: d.fecha, ...d.ausencia, min: d.ausencia.fin - d.ausencia.inicio });
      for (const x of [d.extra, ...(d.extrasManuales || [])].filter(Boolean)) aFavor.push({ fecha: d.fecha, ...x, min: x.fin - x.inicio });
    }
    const suma = (l) => l.reduce((s, x) => s + x.min, 0);
    return { periodo: per, tarde, tardeDetalle, tolerancia: TOLERANCIA, adeudadas, aFavor, totalAdeudado: suma(adeudadas), totalAFavor: suma(aFavor) };
  }

  const api = { procesar, armarFormularios, resumen, periodo, leerFechas, leerFichadas, hm, dur, corta, larga, nombreDia, HORARIOS, TOLERANCIA };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Horario = api;
})(typeof window !== 'undefined' ? window : globalThis);
