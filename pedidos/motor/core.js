// Pedidos Interactivos — motor común. No tiene estilos propios: sólo marca
// clases (pi-*) y atributos (data-pi*, data-f) que pintan base.css, el layout
// y el estilo.css de cada local. No editar por un local: sólo si hay un error.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (tag, attrs = {}, ...hijos) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const h of hijos.flat()) if (h != null && h !== false) n.append(h);
  return n;
};
const plata = (n) => (n == null ? 'a confirmar' : '$' + Math.round(n).toLocaleString('es-AR'));
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const leer = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };

let D;               // datos del local
let carrito = [];    // {key, cat, nombre, detalle[], precio (unitario o null), cant}
const form = { nombre: '', entrega: '', direccion: '', pago: '', notas: '' };

// ---------- carga ----------
async function cargar() {
  if (window.PI_DATOS) return window.PI_DATOS;
  const r = await fetch('datos.json');
  return r.json();
}

// ---------- textos fijos del layout ----------
function pintarFicha() {
  document.title = `${D.nombre} · Pedidos`;
  $$('[data-pi-texto]').forEach((n) => {
    const v = D[n.dataset.piTexto];
    if (v) n.textContent = v; else n.hidden = true;
  });
  $$('[data-pi-img]').forEach((n) => {
    const v = D[n.dataset.piImg];
    if (v) { n.src = v; n.alt = n.dataset.piImg === 'logo' ? `Logo de ${D.nombre}` : ''; } else n.hidden = true;
  });
  $$('[data-pi="instagram"]').forEach((n) => {
    if (!D.instagram) return (n.hidden = true);
    const h = D.instagram.replace(/^@/, '');
    n.textContent = '@' + h;
    if (n.tagName === 'A') { n.href = `https://instagram.com/${h}`; n.target = '_blank'; n.rel = 'noopener'; }
  });
  $$('[data-pi="horarios"]').forEach((n) => {
    const hs = D.horarios || [];
    if (!hs.length) return (n.hidden = true);
    n.replaceChildren(...hs.map((h) => el('li', {}, el('span', { class: 'pi-h-dias' }, h.dias), ' ', el('span', { class: 'pi-h-horas' }, h.horas))));
  });
  $$('[data-pi="descuentos"]').forEach((n) => {
    const ds = (D.descuentos || []).filter((d) => d.texto);
    if (!ds.length) return (n.hidden = true);
    n.replaceChildren(...ds.map((d) => el('li', {}, d.texto)));
  });
  if (D.demo !== false) {
    document.body.prepend(el('p', { class: 'pi-cartel', role: 'note' }, 'Propuesta de diseño, no oficial'));
  }
}

// ---------- carta ----------
const ETIQUETA_ARMAR = { mitad: 'Armar mitad y mitad', combo: 'Armar combo', docena: 'Armar docena' };

function plantilla(nombre, porDefecto) {
  const t = $(`template[data-pi-tpl="${nombre}"]`);
  if (t) return t.content.firstElementChild.cloneNode(true);
  const w = document.createElement('div');
  w.innerHTML = porDefecto;
  return w.firstElementChild;
}

function rellenar(nodo, campos) {
  for (const [f, v] of Object.entries(campos)) {
    $$(`[data-f="${f}"]`, nodo).forEach((n) => {
      if (v == null || v === '') { n.remove(); return; }
      if (n.tagName === 'IMG') { n.src = v; n.alt = ''; n.loading = 'lazy'; } else n.textContent = v;
    });
  }
}

function precioDe(item) {
  if (item.variantes?.length) {
    const ps = item.variantes.map((v) => v.precio).filter((p) => p != null);
    return ps.length ? (ps.length < item.variantes.length ? null : Math.min(...ps)) : null;
  }
  return item.precio ?? null;
}

function textoPrecio(item, cat) {
  if (cat.armador === 'docena' && item.precio == null && cat.docena?.precio_docena != null) return `${plata(cat.docena.precio_docena)} la docena`;
  const p = precioDe(item);
  if (p == null && cat.armador === 'combo') return 'En combos';
  if (p == null) return 'Precio a confirmar';
  return (item.variantes?.length > 1 ? 'desde ' : '') + plata(p);
}

function pintarCarta() {
  const nav = $('[data-pi="nav"]');
  const carta = $('[data-pi="carta"]');
  if (nav) nav.replaceChildren(...D.categorias.map((c) => el('a', { href: `#cat-${c.id}`, class: 'pi-nav-link' }, c.nombre)));
  carta.replaceChildren(...D.categorias.map((cat, ci) => {
    const s = plantilla('seccion', '<section class="pi-seccion"><header class="pi-seccion-cab"><h2 data-f="nombre"></h2><p data-f="nota"></p></header><div data-f="armar"></div><div class="pi-platos" data-f="platos"></div></section>');
    s.id = `cat-${cat.id}`;
    s.dataset.cat = cat.id;
    s.style.setProperty('--pi-i', ci);
    rellenar(s, { nombre: cat.nombre, nota: cat.nota });
    const zonaArmar = $('[data-f="armar"]', s);
    if (ETIQUETA_ARMAR[cat.armador]) {
      zonaArmar.replaceWith(el('button', { type: 'button', class: 'pi-armar', 'data-pi-accion': 'armar', 'data-cat': cat.id, onclick: () => abrirArmador(cat) }, cat.texto_armar || ETIQUETA_ARMAR[cat.armador]));
    } else zonaArmar.remove();
    const cont = $('[data-f="platos"]', s);
    cont.removeAttribute('data-f');
    cont.append(...cat.items.map((item, i) => pintarPlato(cat, item, i)));
    return s;
  }));
}

function pintarPlato(cat, item, i) {
  const p = plantilla('plato', '<article class="pi-plato"><img data-f="foto"><div class="pi-plato-txt"><h3 data-f="nombre"></h3><p data-f="desc"></p></div><p class="pi-precio" data-f="precio"></p><button type="button" data-f="accion"></button></article>');
  p.dataset.item = item.id;
  p.style.setProperty('--pi-i', i);
  if (item.foto) p.dataset.conFoto = '';
  rellenar(p, { nombre: item.nombre, desc: item.desc, foto: item.foto, precio: textoPrecio(item, cat), etiqueta: item.etiqueta });
  const b = $('[data-f="accion"]', p);
  if (b) {
    const abre = necesitaArmador(cat, item);
    b.textContent = abre ? ({ capas: 'Armar', combo: 'Armar combo' }[cat.armador] || 'Elegir') : 'Agregar';
    b.setAttribute('aria-label', `${b.textContent} ${item.nombre}`);
    b.classList.add('pi-agregar');
    b.addEventListener('click', () => (abre ? abrirArmador(cat, item) : agregar({ cat: cat.id, nombre: item.nombre, detalle: [], precio: item.precio ?? null }, b)));
  }
  return p;
}

function necesitaArmador(cat, item) {
  return item.variantes?.length > 1 || cat.armador === 'capas' || cat.armador === 'docena' ||
    (cat.armador === 'combo' && item.precio == null);
}

function marcarEnPedido() {
  $$('.pi-plato').forEach((p) => {
    const cat = p.closest('.pi-seccion')?.dataset.cat;
    const item = D.categorias.find((c) => c.id === cat)?.items.find((x) => x.id === p.dataset.item);
    const n = carrito.filter((l) => l.cat === cat && (l.nombre === item?.nombre || l.detalle.some((d) => d.includes(item?.nombre)))).reduce((a, l) => a + l.cant, 0);
    if (n) p.dataset.enPedido = n; else delete p.dataset.enPedido;
  });
}

// ---------- armadores ----------
let dlg;
function dialogo(nombre) {
  let d = $(`dialog[data-pi="${nombre}"]`);
  if (!d) { d = el('dialog', { 'data-pi': nombre }); document.body.append(d); }
  d.classList.add('pi-dialogo');
  return d;
}

function grupo(titulo, tipo, nombre, opciones, alCambiar) {
  return el('fieldset', { class: 'pi-grupo' }, el('legend', {}, titulo),
    ...opciones.map((o, i) => el('label', { class: 'pi-op' },
      el('input', { type: tipo, name: nombre, value: i, checked: o.marcada, 'data-pi-op': nombre, onchange: alCambiar }),
      el('span', { class: 'pi-op-nombre' }, o.nombre),
      o.precio != null ? el('span', { class: 'pi-op-precio' }, o.precioTexto ?? plata(o.precio)) : null)));
}

function contador(nombre, alCambiar) {
  const s = { n: 0 };
  const out = el('output', { class: 'pi-cont-n' }, '0');
  const cambiar = (d) => { s.n = Math.max(0, s.n + d); out.textContent = s.n; alCambiar(); };
  s.nodo = el('div', { class: 'pi-cont' },
    el('span', { class: 'pi-cont-nombre' }, nombre),
    el('button', { type: 'button', class: 'pi-menos', 'aria-label': `Quitar ${nombre}`, onclick: () => cambiar(-s.paso) }, '−'),
    out,
    el('button', { type: 'button', class: 'pi-mas', 'data-pi-mas': '', 'aria-label': `Sumar ${nombre}`, onclick: () => cambiar(s.paso) }, '+'));
  s.paso = 1;
  s.nombre = nombre;
  return s;
}

const armadores = {
  // Variantes simples (tamaños, porciones) o pizza entera con tamaño
  variantes(cat, item) {
    const vs = item.variantes.map((v, i) => ({ ...v, marcada: i === 0 }));
    const cuerpo = el('div', {}, grupo('Elegí', 'radio', 'var', vs, () => api.actualizar()));
    const api = { cuerpo, calcular() {
      const v = vs[+$('input[name=var]:checked', cuerpo).value];
      return { valido: true, nombre: item.nombre, detalle: [v.nombre], precio: v.precio ?? null };
    } };
    return api;
  },

  // Pizza: mitad y mitad
  mitad(cat, item) {
    const pizzas = cat.items.filter((x) => x.mitad !== false);
    const tams = pizzas[0]?.variantes?.map((v) => v.nombre) || null;
    const precio = (pz, t) => (t == null ? precioDe(pz) : pz.variantes?.find((v) => v.nombre === t)?.precio ?? null);
    const cuerpo = el('div', {});
    let tam = tams ? tams[0] : null;
    const pintar = () => {
      const selA = $('input[name=mitadA]:checked', cuerpo)?.value ?? (item ? pizzas.indexOf(item) : 0);
      const selB = $('input[name=mitadB]:checked', cuerpo)?.value ?? -1;
      const ops = (sel) => pizzas.map((pz, i) => ({ nombre: pz.nombre, precio: precio(pz, tam), marcada: +sel === i }));
      cuerpo.replaceChildren(
        tams ? grupo('Tamaño', 'radio', 'tam', tams.map((t) => ({ nombre: t, marcada: t === tam })), (e) => { tam = tams[+e.target.value]; pintar(); api.actualizar(); }) : '',
        grupo('Primera mitad', 'radio', 'mitadA', ops(selA), () => api.actualizar()),
        grupo('Segunda mitad', 'radio', 'mitadB', ops(selB), () => api.actualizar()));
    };
    const api = { cuerpo, calcular() {
      const a = pizzas[$('input[name=mitadA]:checked', cuerpo)?.value];
      const b = pizzas[$('input[name=mitadB]:checked', cuerpo)?.value];
      if (!a || !b) return { valido: false, aviso: 'Elegí las dos mitades' };
      const pa = precio(a, tam), pb = precio(b, tam);
      const p = pa == null || pb == null ? null : (cat.mitad_precio === 'promedio' ? (pa + pb) / 2 : Math.max(pa, pb));
      const nombre = a === b ? a.nombre : `Mitad ${a.nombre} / mitad ${b.nombre}`;
      return { valido: true, nombre, detalle: tam ? [tam] : [], precio: p };
    } };
    pintar();
    return api;
  },

  // Hamburguesas: capas (medallones) + extras + sin ingredientes
  capas(cat, item) {
    const vs = (item.variantes || [{ nombre: 'Simple', precio: item.precio }]).map((v, i) => ({ ...v, marcada: i === 0 }));
    const extras = cat.extras || [];
    const quitar = item.quitar || cat.quitar || [];
    const cuerpo = el('div', {},
      vs.length > 1 ? grupo('Medallones', 'radio', 'capa', vs, () => api.actualizar()) : '',
      extras.length ? grupo('Extras', 'checkbox', 'extra', extras.map((x) => ({ ...x, precioTexto: x.precio == null ? 'a confirmar' : '+' + plata(x.precio) })), () => api.actualizar()) : '',
      quitar.length ? grupo('Sacale', 'checkbox', 'sin', quitar.map((q) => ({ nombre: 'Sin ' + q })), () => api.actualizar()) : '');
    const api = { cuerpo, calcular() {
      const v = vs[+($('input[name=capa]:checked', cuerpo)?.value ?? 0)];
      const xs = $$('input[name=extra]:checked', cuerpo).map((i) => extras[+i.value]);
      const sin = $$('input[name=sin]:checked', cuerpo).map((i) => 'sin ' + quitar[+i.value]);
      const ps = [v.precio, ...xs.map((x) => x.precio)];
      return { valido: true, nombre: item.nombre, detalle: [vs.length > 1 ? v.nombre : null, ...xs.map((x) => '+ ' + x.nombre), ...sin].filter(Boolean), precio: ps.includes(null) || ps.includes(undefined) ? null : ps.reduce((a, b) => a + b, 0) };
    } };
    return api;
  },

  // Sushi: combos por cantidad de piezas, repartidas entre variedades
  combo(cat) {
    const combos = cat.combos || [];
    const paso = cat.paso || 5;
    const vars = cat.items.filter((x) => x.combinable !== false);
    let combo = combos[0];
    const conts = vars.map((v) => contador(v.nombre, () => api.actualizar()));
    conts.forEach((c) => (c.paso = paso));
    const estado = el('p', { class: 'pi-estado', 'aria-live': 'polite' });
    const cuerpo = el('div', {},
      grupo('Tamaño del combo', 'radio', 'combo', combos.map((c, i) => ({ nombre: c.nombre || `${c.piezas} piezas`, precio: c.precio, marcada: i === 0 })), (e) => { combo = combos[+e.target.value]; api.actualizar(); }),
      el('fieldset', { class: 'pi-grupo pi-grupo-cont' }, el('legend', {}, `Repartí las piezas (de a ${paso})`), ...conts.map((c) => c.nodo)),
      estado);
    const api = { cuerpo, calcular() {
      const total = conts.reduce((a, c) => a + c.n, 0);
      const falta = combo.piezas - total;
      estado.textContent = falta > 0 ? `Faltan ${falta} piezas` : falta < 0 ? `Sobran ${-falta} piezas` : 'Combo completo';
      estado.dataset.ok = falta === 0;
      if (falta !== 0) return { valido: false, aviso: estado.textContent };
      return { valido: true, nombre: combo.nombre || `Combo ${combo.piezas} piezas`, detalle: conts.filter((c) => c.n).map((c) => `${c.n} ${c.nombre}`), precio: combo.precio ?? null };
    } };
    return api;
  },

  // Empanadas: por unidad, media docena y docena
  docena(cat, item) {
    const dz = cat.docena || {};
    const vars = cat.items;
    const conts = vars.map((v) => contador(v.nombre, () => api.actualizar()));
    if (item) { const c = conts[vars.indexOf(item)]; c.n = 1; $('output', c.nodo).textContent = 1; }
    const estado = el('p', { class: 'pi-estado', 'aria-live': 'polite' });
    const precioN = (n) => {
      let resto = n, p = 0;
      if (dz.precio_docena != null) { p += Math.floor(resto / 12) * dz.precio_docena; resto %= 12; }
      if (dz.precio_media != null) { p += Math.floor(resto / 6) * dz.precio_media; resto %= 6; }
      if (resto) {
        const unit = dz.precio_unidad ?? null;
        if (unit == null) return { p: null, resto };
        p += resto * unit;
      }
      return { p, resto: 0 };
    };
    const cuerpo = el('div', {},
      el('fieldset', { class: 'pi-grupo pi-grupo-cont' }, el('legend', {}, 'Sabores'), ...conts.map((c) => c.nodo)),
      estado);
    const api = { cuerpo, calcular() {
      const n = conts.reduce((a, c) => a + c.n, 0);
      const { p, resto } = precioN(n);
      const docenas = Math.floor(n / 12), suel = n % 12;
      estado.textContent = n === 0 ? 'Sumá sabores' : `${n} empanadas` + (docenas ? ` · ${docenas} docena${docenas > 1 ? 's' : ''}${suel ? ` y ${suel}` : ''}` : '');
      estado.dataset.ok = n > 0 && resto === 0;
      if (!n) return { valido: false, aviso: 'Sumá al menos una' };
      if (resto && dz.precio_unidad == null) return { valido: false, aviso: `Se venden por ${dz.precio_media != null ? 'media docena' : 'docena'}` };
      return { valido: true, nombre: `${n} empanadas`, detalle: conts.filter((c) => c.n).map((c) => `${c.n} ${c.nombre}`), precio: p, cant: 1 };
    } };
    return api;
  },
};

function abrirArmador(cat, item) {
  let tipo = cat.armador;
  if (item && tipo === 'mitad') tipo = item.variantes?.length > 1 ? 'variantes' : null;
  if (item && tipo === 'combo') { if (item.variantes?.length) tipo = 'variantes'; else item = null; }
  if (!armadores[tipo]) tipo = 'variantes';
  const a = armadores[tipo](cat, item);
  dlg = dialogo('armador');
  dlg.dataset.armador = tipo;
  const total = el('span', { class: 'pi-dlg-total' });
  const aviso = el('span', { class: 'pi-dlg-aviso' });
  const ok = el('button', { type: 'button', class: 'pi-confirmar', 'data-pi-confirmar': '' }, 'Sumar al pedido');
  a.actualizar = () => {
    const r = a.calcular();
    ok.disabled = !r.valido;
    aviso.textContent = r.valido ? '' : r.aviso || '';
    total.textContent = r.valido ? plata(r.precio) : '';
  };
  ok.onclick = () => {
    const r = a.calcular();
    if (!r.valido) return;
    agregar({ cat: cat.id, nombre: r.nombre, detalle: r.detalle, precio: r.precio });
    cerrar(dlg);
  };
  const titulo = item ? item.nombre : (cat.texto_armar || ETIQUETA_ARMAR[cat.armador]);
  dlg.replaceChildren(
    el('header', { class: 'pi-dlg-cab' }, el('h2', {}, titulo), el('button', { type: 'button', class: 'pi-cerrar', 'aria-label': 'Cerrar', onclick: () => cerrar(dlg) }, '×')),
    item?.desc ? el('p', { class: 'pi-dlg-desc' }, item.desc) : '',
    el('div', { class: 'pi-dlg-cuerpo' }, a.cuerpo),
    el('footer', { class: 'pi-dlg-pie' }, el('div', { class: 'pi-dlg-suma' }, total, aviso), ok));
  a.actualizar();
  abrir(dlg);
}

function abrir(d) {
  if (d.tagName !== 'DIALOG') return d.scrollIntoView({ behavior: 'smooth' });
  if (!d.open) d.showModal();
  document.documentElement.classList.add('pi-con-dialogo');
}
function cerrar(d) {
  if (d.open) d.close();
}
document.addEventListener('close', () => document.documentElement.classList.toggle('pi-con-dialogo', !!$('dialog[open]')), true);
document.addEventListener('click', (e) => { if (e.target.tagName === 'DIALOG') e.target.close(); });

// ---------- carrito ----------
function agregar(linea, origen) {
  const key = JSON.stringify([linea.cat, linea.nombre, linea.detalle]);
  const ya = carrito.find((l) => l.key === key);
  if (ya) ya.cant++; else carrito.push({ ...linea, key, cant: 1 });
  if (origen) { origen.dataset.pulso = ''; setTimeout(() => delete origen.dataset.pulso, 600); }
  cambio();
}

function cambiarCant(key, d) {
  const l = carrito.find((x) => x.key === key);
  if (!l) return;
  l.cant += d;
  if (l.cant <= 0) carrito = carrito.filter((x) => x !== l);
  cambio();
}

function cuentas() {
  const sub = carrito.reduce((a, l) => a + (l.precio ?? 0) * l.cant, 0);
  const aConfirmar = carrito.some((l) => l.precio == null);
  const descs = [];
  for (const d of D.descuentos || []) {
    if (!d.porcentaje) continue;
    // condiciones combinables: pago, entrega, minimo, categoria (todas las que estén deben cumplirse)
    if (d.tipo === 'info') continue;
    if (d.pago && form.pago !== d.pago) continue;
    if (d.entrega && form.entrega !== d.entrega) continue;
    if (d.minimo && sub < d.minimo) continue;
    const base = d.categoria ? carrito.filter((l) => l.cat === d.categoria).reduce((a, l) => a + (l.precio ?? 0) * l.cant, 0) : sub;
    if (base > 0) descs.push({ texto: d.texto || `${d.porcentaje}% off`, monto: Math.round((base * d.porcentaje) / 100) });
  }
  const envio = form.entrega && form.entrega === D.entrega?.envio_nombre && D.entrega?.envio_costo != null ? D.entrega.envio_costo : 0;
  const total = sub - descs.reduce((a, d) => a + d.monto, 0) + envio;
  return { sub, descs, envio, total, aConfirmar, cant: carrito.reduce((a, l) => a + l.cant, 0) };
}

function mensaje() {
  const c = cuentas();
  const L = [`Hola ${D.nombre}! Quiero hacer este pedido:`, ''];
  for (const l of carrito) {
    L.push(`• ${l.cant} x ${l.nombre}${l.precio == null ? ' (precio a confirmar)' : ` — ${plata(l.precio * l.cant)}`}`);
    for (const d of l.detalle) L.push(`   ${d}`);
  }
  L.push('');
  if (c.descs.length || c.envio) L.push(`Subtotal: ${plata(c.sub)}`);
  for (const d of c.descs) L.push(`${d.texto}: −${plata(d.monto)}`);
  if (c.envio) L.push(`Envío: ${plata(c.envio)}`);
  L.push(`Total: ${plata(c.total)}${c.aConfirmar ? ' + ítems a confirmar' : ''}`, '');
  if (form.nombre) L.push(`A nombre de: ${form.nombre}`);
  if (form.entrega) L.push(`Entrega: ${form.entrega}${form.direccion && form.entrega === D.entrega?.envio_nombre ? ` — ${form.direccion}` : ''}`);
  if (form.pago) L.push(`Pago: ${form.pago}`);
  if (form.notas) L.push(`Aclaraciones: ${form.notas}`);
  return L.join('\n');
}

function pintarBarra() {
  const b = $('[data-pi="barra"]');
  if (!b) return;
  const c = cuentas();
  b.hidden = !c.cant;
  b.replaceChildren(el('button', { type: 'button', class: 'pi-barra-boton', 'data-pi-abrir-pedido': '', onclick: () => abrirPedido() },
    el('span', { class: 'pi-barra-cant' }, `${c.cant} ${c.cant === 1 ? 'producto' : 'productos'}`),
    el('span', { class: 'pi-barra-ver' }, 'Ver pedido'),
    el('span', { class: 'pi-barra-total' }, plata(c.total))));
}

function campo(etq, input) { return el('label', { class: 'pi-campo' }, el('span', {}, etq), input); }

function pintarPedido() {
  const p = $('[data-pi="pedido"]') || dialogo('pedido');
  p.classList.add('pi-pedido');
  const c = cuentas();
  const esDlg = p.tagName === 'DIALOG';
  const entregas = D.entrega?.opciones || [];
  const pagos = D.pagos || [];
  const lineas = carrito.map((l) => el('li', { class: 'pi-linea' },
    el('div', { class: 'pi-linea-txt' }, el('strong', {}, l.nombre), ...l.detalle.map((d) => el('small', {}, d))),
    el('div', { class: 'pi-linea-cant' },
      el('button', { type: 'button', class: 'pi-menos', 'aria-label': `Quitar uno de ${l.nombre}`, onclick: () => cambiarCant(l.key, -1) }, '−'),
      el('output', {}, l.cant),
      el('button', { type: 'button', class: 'pi-mas', 'aria-label': `Sumar uno de ${l.nombre}`, onclick: () => cambiarCant(l.key, 1) }, '+')),
    el('span', { class: 'pi-linea-precio' }, l.precio == null ? 'a confirmar' : plata(l.precio * l.cant))));
  const radios = (nombre, ops) => el('div', { class: 'pi-radios', role: 'radiogroup' }, ...ops.map((o) => el('label', { class: 'pi-op' },
    el('input', { type: 'radio', name: 'pi-' + nombre, value: o, checked: form[nombre] === o, 'data-pi-op': nombre, onchange: () => { form[nombre] = o; cambio(); } }), el('span', { class: 'pi-op-nombre' }, o))));
  const inp = (nombre, attrs, tag = 'input') => el(tag, { ...attrs, name: 'pi-' + nombre, value: tag === 'input' ? form[nombre] : null, 'data-pi-campo': nombre,
    oninput: (e) => { form[nombre] = e.target.value; $('[data-pi="mensaje"]', p).textContent = mensaje(); validar(); } });
  const notas = inp('notas', { rows: 2, placeholder: 'Ej: sin sal, tocar timbre B' }, 'textarea');
  notas.value = form.notas;
  const enviar = el('button', { type: 'button', class: 'pi-enviar', 'data-pi-enviar': '', onclick: enviarPedido }, 'Enviar pedido por WhatsApp');
  const faltan = el('p', { class: 'pi-faltan', 'aria-live': 'polite' });
  const validar = () => {
    const f = [];
    if (!carrito.length) f.push('sumá algo de la carta');
    if (!form.nombre.trim()) f.push('tu nombre');
    if (entregas.length && !form.entrega) f.push('cómo lo recibís');
    if (form.entrega === D.entrega?.envio_nombre && !form.direccion.trim()) f.push('la dirección');
    if (pagos.length && !form.pago) f.push('cómo pagás');
    enviar.disabled = f.length > 0;
    faltan.textContent = f.length ? 'Falta: ' + f.join(', ') : '';
  };
  p.replaceChildren(
    el('header', { class: 'pi-dlg-cab' }, el('h2', {}, 'Tu pedido'), esDlg ? el('button', { type: 'button', class: 'pi-cerrar', 'aria-label': 'Cerrar', onclick: () => cerrar(p) }, '×') : ''),
    el('div', { class: 'pi-dlg-cuerpo' },
      carrito.length ? el('ul', { class: 'pi-lineas' }, ...lineas) : el('p', { class: 'pi-vacio' }, 'Todavía no sumaste nada.'),
      el('dl', { class: 'pi-cuentas' },
        c.descs.length || c.envio ? [el('dt', {}, 'Subtotal'), el('dd', {}, plata(c.sub))] : '',
        ...c.descs.map((d) => [el('dt', { class: 'pi-desc' }, d.texto), el('dd', { class: 'pi-desc' }, '−' + plata(d.monto))]),
        c.envio ? [el('dt', {}, 'Envío'), el('dd', {}, plata(c.envio))] : '',
        el('dt', { class: 'pi-total' }, 'Total'), el('dd', { class: 'pi-total' }, plata(c.total) + (c.aConfirmar ? ' + a confirmar' : ''))),
      el('div', { class: 'pi-form' },
        campo('Tu nombre', inp('nombre', { autocomplete: 'given-name' })),
        entregas.length ? el('fieldset', { class: 'pi-grupo' }, el('legend', {}, '¿Cómo lo recibís?'), radios('entrega', entregas)) : '',
        form.entrega && form.entrega === D.entrega?.envio_nombre ? campo('Dirección', inp('direccion', { autocomplete: 'street-address' })) : '',
        pagos.length ? el('fieldset', { class: 'pi-grupo' }, el('legend', {}, '¿Cómo pagás?'), radios('pago', pagos)) : '',
        campo('Aclaraciones', notas)),
      el('figure', { class: 'pi-mensaje' }, el('figcaption', {}, 'Así le llega al local'), el('pre', { 'data-pi': 'mensaje' }, mensaje()))),
    el('footer', { class: 'pi-dlg-pie' }, faltan, enviar));
  validar();
  return p;
}

function abrirPedido() {
  const p = pintarPedido();
  abrir(p);
}

function enviarPedido() {
  const num = String(D.whatsapp_demo || D.whatsapp || '').replace(/\D/g, '');
  const url = `https://wa.me/${num}?text=${encodeURIComponent(mensaje())}`;
  const ev = new CustomEvent('pi:enviar', { cancelable: true, detail: { url, mensaje: mensaje() } });
  if (document.dispatchEvent(ev)) window.open(url, '_blank', 'noopener');
}

function cambio() {
  pintarBarra();
  marcarEnPedido();
  const p = $('[data-pi="pedido"]');
  if (p && (p.tagName !== 'DIALOG' || p.open)) {
    // repintar sin perder el scroll interno ni el foco
    const scroll = $('.pi-dlg-cuerpo', p)?.scrollTop || 0;
    const act = p.contains(document.activeElement) ? document.activeElement : null;
    const sel = !act ? null : act.dataset.piCampo ? `[data-pi-campo="${act.dataset.piCampo}"]`
      : act.name ? `[name="${act.name}"][value="${CSS.escape(act.value)}"]`
      : act.getAttribute('aria-label') ? `[aria-label="${CSS.escape(act.getAttribute('aria-label'))}"]` : null;
    pintarPedido();
    const cuerpo = $('.pi-dlg-cuerpo', p);
    if (cuerpo) cuerpo.scrollTop = scroll;
    if (sel) $(sel, p)?.focus({ preventScroll: true });
  }
  document.body.dataset.piCant = cuentas().cant;
  guardar(`pi:${D.nombre}`, { carrito, form });
}

// ---------- inicio ----------
(async () => {
  D = await cargar();
  if (D.entrega && !D.entrega.envio_nombre) D.entrega.envio_nombre = (D.entrega.opciones || []).find((o) => /env[ií]o|domicilio|delivery/i.test(o));
  document.body.dataset.rubro = D.rubro || '';
  const prev = leer(`pi:${D.nombre}`);
  if (prev && !window.PI_SIN_MEMORIA) { carrito = prev.carrito || []; Object.assign(form, prev.form || {}); }
  pintarFicha();
  pintarCarta();
  cambio();
  requestAnimationFrame(() => document.documentElement.classList.add('pi-listo'));
  window.PI = { datos: D, carrito: () => carrito, abrirArmador, abrirPedido, mensaje };
})();
