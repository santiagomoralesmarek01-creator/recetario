/* Interfaz: guarda todo en localStorage de este navegador. */
(function () {
  'use strict';
  const H = window.Horario;
  const $ = (s) => document.querySelector(s);

  const FERIADOS_2026 = '12/10/2026, 09/11/2026, 10/11/2026, 23/11/2026, 07/12/2026, 08/12/2026, 24/12/2026, 25/12/2026, 31/12/2026';
  const K = { config: 'hf.config', hist: 'hf.historial', env: 'hf.enviados', cob: 'hf.coberturas', ult: 'hf.ultimaCarga' };

  const leer = (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } };
  const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

  let config = leer(K.config, null);
  let historial = leer(K.hist, {});
  let enviados = leer(K.env, {});
  let coberturas = leer(K.cob, {});
  let ultima = leer(K.ult, null); // { fechas: [], avisos: [] }

  const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  function el(tag, attrs, ...hijos) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const h of hijos.flat()) if (h != null && h !== false) e.append(h instanceof Node ? h : String(h));
    return e;
  }

  // ───────────── configuración ─────────────

  function configCompleta(c) {
    const anio = new Date().getFullYear();
    return {
      legajo: c.legajo, correo: c.correo || '', entrada: c.entrada || '08:00', autoriza: c.autoriza || 'Patricia Cirino',
      sabados: H.leerFechas(c.sabadosTexto, anio), feriados: H.leerFechas(c.feriadosTexto ?? FERIADOS_2026, anio),
      salidaViernes: c.salidaViernes !== false, hoy: hoyISO(),
    };
  }

  function mostrarConfig(abrir) {
    const f = $('#form-config');
    const c = config || {};
    f.legajo.value = c.legajo || '';
    f.correo.value = c.correo || '';
    f.entrada.value = c.entrada || '08:00';
    f.autoriza.value = c.autoriza || 'Patricia Cirino';
    f.sabados.value = c.sabadosTexto || '';
    f.feriados.value = c.feriadosTexto ?? FERIADOS_2026;
    f.salidaViernes.checked = c.salidaViernes !== false;
    $('#config').hidden = !abrir;
    $('#cancelar-config').hidden = !c.legajo;
    pintarEncabezado();
  }

  function pintarEncabezado() {
    const lab = $('#count-label');
    lab.replaceChildren();
    if (config && config.legajo) {
      lab.append(`Legajo ${config.legajo} · entrada ${config.entrada} · `,
        el('button', { type: 'button', class: 'btn-link', onclick: () => { mostrarConfig(true); $('#config').scrollIntoView({ behavior: 'smooth' }); } }, 'Editar mis datos'));
    } else {
      lab.append('Primero completá tus datos');
    }
  }

  $('#form-config').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const f = ev.target;
    config = {
      legajo: f.legajo.value.trim(), correo: f.correo.value.trim(), entrada: f.entrada.value, autoriza: f.autoriza.value.trim(),
      sabadosTexto: f.sabados.value, feriadosTexto: f.feriados.value, salidaViernes: f.salidaViernes.checked,
    };
    guardar(K.config, config);
    mostrarConfig(false);
    if (Object.keys(historial).length) recalcularHistorial();
    render();
    $('#fichadas').focus();
  });
  $('#cancelar-config').addEventListener('click', () => mostrarConfig(false));

  // ───────────── caja de fichadas ─────────────

  const caja = $('#fichadas');
  const btnLimpiar = $('#clear-btn');
  const actualizarLimpiar = () => { btnLimpiar.style.display = caja.value ? 'block' : 'none'; };
  caja.addEventListener('input', actualizarLimpiar);
  btnLimpiar.addEventListener('click', () => { caja.value = ''; actualizarLimpiar(); caja.focus(); });
  $('#toggle-extras').addEventListener('click', () => {
    const w = $('#extras-wrap');
    w.hidden = !w.hidden;
    if (!w.hidden) $('#extras').focus();
  });

  // ───────────── procesar ─────────────

  const textoExtras = () => $('#extras').value.split(',').map((s) => s.trim()).filter(Boolean).join('\n');

  function recalcularHistorial() {
    // Vuelve a aplicar las reglas a lo guardado (por si cambió la configuración).
    const c = configCompleta(config);
    const texto = Object.values(historial).map((d) => d.textoOriginal || '').join('\n');
    const extras = Object.values(historial).map((d) => d.extrasTexto || '').join('\n');
    if (!texto.trim()) return;
    const r = H.procesar(c, texto, extras);
    historial = {};
    for (const d of r.dias) historial[d.fecha] = d;
    adjuntarOriginales(texto, extras);
    guardar(K.hist, historial);
  }

  function adjuntarOriginales(texto, extras) {
    // Guarda las líneas originales por día para poder recalcular más adelante.
    const porDia = {};
    for (const l of texto.split(/\r?\n/)) {
      const m = l.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
      if (!m) continue;
      let y = +m[3]; if (y < 100) y += 2000;
      const iso = `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
      (porDia[iso] ||= []).push(l.trim());
    }
    for (const [iso, lineas] of Object.entries(porDia)) if (historial[iso]) historial[iso].textoOriginal = lineas.join('\n');
    const anio = new Date().getFullYear();
    for (const l of (extras || '').split(/\r?\n/)) {
      const f = H.leerFechas(l.trim().split(/\s+/)[0], anio)[0];
      if (f && historial[f]) historial[f].extrasTexto = [historial[f].extrasTexto, l.trim()].filter(Boolean).join('\n');
    }
  }

  $('#procesar').addEventListener('click', () => {
    if (!config || !config.legajo) {
      ultima = { fechas: [], avisos: [{ tipo: 'error', texto: 'Primero completá y guardá tus datos (legajo y hora de entrada).' }] };
      mostrarConfig(true);
      render();
      return;
    }
    const texto = caja.value;
    const extras = textoExtras();
    const r = H.procesar(configCompleta(config), texto, extras);
    if (!r.dias.length) r.avisos.push({ tipo: 'error', texto: 'No encontré fichadas. Pegalas con el formato: 02-11-2026  07:49  Entrada' });
    for (const d of r.dias) {
      const previo = historial[d.fecha];
      // No pisar un día con fichadas con un día vacío agregado al completar la semana.
      if (previo && ['sinFichada', 'futuro'].includes(d.tipo) && previo.tipo === 'trabajo') continue;
      historial[d.fecha] = d;
    }
    adjuntarOriginales(texto, extras);
    guardar(K.hist, historial);
    ultima = { fechas: r.dias.map((d) => d.fecha), avisos: r.avisos };
    guardar(K.ult, ultima);
    render();
    if (r.dias.length) $('#avisos').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ───────────── render ─────────────

  function render() {
    const dias = Object.values(historial).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    pintarAvisos(dias);
    const hay = dias.length > 0;
    $('#detalle').hidden = !hay;
    if (!hay) {
      $('#stats').replaceChildren();
      $('#results').replaceChildren(el('div', { class: 'vacio' }, 'Pegá tus fichadas y tocá “Generar formularios”.'));
      $('#enviados-box').hidden = true;
      return;
    }
    const forms = H.armarFormularios(configCompleta(config || {}), dias, coberturas);
    pintarResumen();
    pintarFormularios(forms);
    pintarDetalle(dias);
  }

  function pintarAvisos(dias) {
    const box = $('#avisos');
    box.replaceChildren();
    const fechas = new Set((ultima && ultima.fechas) || []);
    for (const a of (ultima && ultima.avisos) || []) box.append(el('div', { class: `nota ${a.tipo === 'error' ? 'error' : 'aviso'}` }, a.texto));
    for (const d of dias) {
      if (!fechas.has(d.fecha)) continue;
      for (const a of d.avisos || []) box.append(el('div', { class: 'nota aviso' }, el('b', null, `${d.nombre}: `), a));
    }
    if (fechas.size && !box.children.length) box.append(el('div', { class: 'nota' }, '✓ Listo, no hay nada raro en estas fichadas.'));
  }

  const NOMBRES = { cambio: 'Cambio de horario', compenso: 'Compenso', extra: 'Horas extra' };

  function pintarFormularios(forms) {
    const pend = $('#results');
    const env = $('#lista-enviados');
    pend.replaceChildren(); env.replaceChildren();
    const pendientes = forms.filter((f) => !enviados[f.id]);
    const hechos = forms.filter((f) => enviados[f.id]);
    if (pendientes.length) {
      pend.append(el('div', { class: 'seccion-titulo' }, `${pendientes.length} formulario${pendientes.length === 1 ? '' : 's'} para enviar`));
      pend.append(...pendientes.map(tarjeta));
    } else {
      pend.append(el('div', { class: 'vacio' }, '✓ No tenés formularios pendientes.'));
    }
    env.append(...hechos.map(tarjeta));
    $('#cant-enviados').textContent = hechos.length;
    $('#enviados-box').hidden = hechos.length === 0;
  }

  function tarjeta(f) {
    const hecho = !!enviados[f.id];
    const horario = f.tipo === 'cambio' ? f.horario : f.detalle.replace(/^(Ausencia|Horas extra) de /, '');
    const card = el('div', { class: `card ${f.tipo}${hecho ? ' hecho' : ''}` },
      el('div', { class: 'card-top' },
        el('p', { class: 'card-titulo' }, f.titulo),
        el('span', { class: 'badge' }, NOMBRES[f.tipo])),
      el('p', { class: 'card-horario' }, f.tipo === 'compenso' ? 'Ausencia: ' : f.tipo === 'extra' ? 'Extra: ' : 'Horario: ', el('b', null, horario)),
    );
    if (f.tipo === 'compenso') card.append(controlCobertura(f), el('p', { class: 'card-obs' }, `Observación: ${f.observacion}`));
    card.append(el('div', { class: 'card-acciones' },
      el('a', { class: 'btn', href: f.link, target: '_blank', rel: 'noopener' }, 'Abrir formulario'),
      el('label', { class: 'enviado-toggle' },
        el('input', { type: 'checkbox', checked: hecho, onchange: (ev) => { if (ev.target.checked) enviados[f.id] = true; else delete enviados[f.id]; guardar(K.env, enviados); render(); } }),
        hecho ? 'Enviado' : 'Marcar como enviado')));
    return card;
  }

  function controlCobertura(f) {
    const cob = coberturas[f.fecha] || { tipo: 'adeudada' };
    const nombre = `cob-${f.fecha}`;
    const set = (v) => { coberturas[f.fecha] = v; guardar(K.cob, coberturas); render(); };
    const radio = (tipo, txt) => el('label', null,
      el('input', { type: 'radio', name: nombre, checked: cob.tipo === tipo, onchange: () => set({ ...cob, tipo }) }), txt);
    const box = el('div', { class: 'cobertura' },
      radio('adeudada', 'Queda adeudada'), radio('servicio', 'A favor del servicio'), radio('favor', 'Uso horas a favor'));
    if (cob.tipo === 'favor') {
      box.append(el('input', {
        type: 'text', value: cob.texto || '', placeholder: 'Ej. 28/10/26 de 17 a 18 (1 hs)',
        onchange: (ev) => set({ tipo: 'favor', texto: ev.target.value.trim() }),
      }));
    }
    return box;
  }

  function pintarResumen() {
    const s = H.resumen(historial, hoyISO());
    const alerta = s.tarde > s.tolerancia - 5;
    const pct = Math.min(100, Math.round((s.tarde / s.tolerancia) * 100));
    const lista = (items, fmt) => (items.length ? el('ul', null, items.map((x) => el('li', null, fmt(x)))) : null);
    const tramo = (x) => `${H.corta(x.fecha)} de ${H.hm(x.inicio)} a ${H.hm(x.fin)}`;
    $('#stats').replaceChildren(
      el('div', { class: `stat${alerta ? ' alerta' : ''}` },
        el('div', { class: 'num' }, `${s.tarde} / ${s.tolerancia} min`),
        el('div', { class: 'lbl' }, `Minutos tarde · ${s.periodo.nombre}`),
        el('div', { class: 'barra' }, el('span', { style: `width:${pct}%` }))),
      el('div', { class: 'stat' },
        el('div', { class: 'num' }, `${H.dur(s.totalAdeudado)} h`),
        el('div', { class: 'lbl' }, 'Horas adeudadas'),
        lista(s.adeudadas, tramo)),
      el('div', { class: 'stat' },
        el('div', { class: 'num' }, `${H.dur(s.totalAFavor)} h`),
        el('div', { class: 'lbl' }, 'Horas a favor'),
        lista(s.aFavor, tramo)),
    );
  }

  function pintarDetalle(dias) {
    const tb = $('#tabla-dias tbody');
    tb.replaceChildren();
    for (const d of dias.slice(-40).reverse()) {
      let estado;
      if (d.tipo === 'feriado') estado = el('span', { class: 'tag gris' }, 'Feriado');
      else if (d.tipo === 'sinFichada') estado = el('span', { class: 'tag aviso' }, '⚠ Sin fichada');
      else if (d.tipo === 'incompleto') estado = el('span', { class: 'tag aviso' }, '⚠ Incompleto');
      else if (d.tipo === 'futuro') estado = el('span', { class: 'tag gris' }, 'Pendiente');
      else if (d.llevaCambio === false && !d.ausencia && !d.extra) estado = el('span', { class: 'tag' }, 'Horario base');
      else estado = el('span', { class: 'tag' }, d.tipo === 'franco' ? 'Franco' : 'Con formulario');
      const ae = [
        d.ausencia && `Ausencia ${H.hm(d.ausencia.inicio)}–${H.hm(d.ausencia.fin)}`,
        d.extra && `Extra ${H.hm(d.extra.inicio)}–${H.hm(d.extra.fin)}`,
        ...(d.extrasManuales || []).map((x) => `Extra ${H.hm(x.inicio)}–${H.hm(x.fin)}`),
      ].filter(Boolean).join(' · ');
      tb.append(el('tr', null,
        el('td', null, d.nombre), el('td', null, d.fichadas || '—'),
        el('td', null, d.horario || '—'), el('td', null, d.minutosTarde ? `${d.minutosTarde} min` : '—'),
        el('td', null, ae || '—'), el('td', null, estado)));
    }
  }

  // ───────────── copia de seguridad ─────────────

  $('#exportar').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ config, historial, enviados, coberturas }, null, 2)], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: `fichadas-${hoyISO()}.json` });
    document.body.append(a); a.click(); a.remove();
  });
  $('#importar').addEventListener('change', async (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    try {
      const datos = JSON.parse(await f.text());
      config = datos.config || config; historial = datos.historial || {};
      enviados = datos.enviados || {}; coberturas = datos.coberturas || {};
      [[K.config, config], [K.hist, historial], [K.env, enviados], [K.cob, coberturas]].forEach(([k, v]) => guardar(k, v));
      mostrarConfig(false); render();
      alert('Listo, cargué tu copia.');
    } catch { alert('No pude leer ese archivo.'); }
    ev.target.value = '';
  });
  $('#borrar').addEventListener('click', () => {
    if (!confirm('¿Borrar tus datos, fichadas y formularios marcados de este navegador?')) return;
    Object.values(K).forEach((k) => { try { localStorage.removeItem(k); } catch { /* nada */ } });
    config = null; historial = {}; enviados = {}; coberturas = {}; ultima = null;
    mostrarConfig(true); render();
  });

  mostrarConfig(!(config && config.legajo));
  actualizarLimpiar();
  render();
})();
