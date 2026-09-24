// "¿Qué tengo en casa?": elegís los ingredientes que tenés y te muestra las
// recetas que los usan, ordenadas por cuántos te faltan.
import { el, mostrar, cargando, vigencia } from '../dom.js';
import * as catalogo from '../catalogo.js';
import * as casa from '../recetasCasa.js';
import { sugerir, normalizar } from '../ingredientes.js';
import { crearImagen, urlIngrediente, IMG_INGREDIENTE_GENERICO } from '../imagenes.js';
import { tarjetaReceta } from './componentes.js';

const CLAVE_GUARDADO = 'recetario:despensa';
const TANDA = 24;
// Lo que casi todos tienen: se puede dar por hecho para no tener que cargarlo.
const BASICOS = ['sal', 'pimienta', 'agua', 'aceite'];

// "Huevos" y "huevo", "Limones" y "limón" tienen que coincidir.
function variantes(nombre) {
  const n = normalizar(nombre);
  const v = new Set([n]);
  if (n.endsWith('es')) v.add(n.slice(0, -2));
  if (n.endsWith('s')) v.add(n.slice(0, -1));
  return [...v];
}

// Un ingrediente de la receta está cubierto si coincide con uno elegido
// o es una variedad de él ("cebolla morada" cuando elegiste "cebolla").
// "Harina de garbanzos" o "leche de coco" son otra cosa, salvo con amplio
// (los básicos: "aceite" cubre "aceite de oliva").
// Los cortes sí cuentan: "pechuga de pollo" es pollo.
const CORTES = /^(pechugas?|muslos?|patas?|alitas?|alas?|filetes?|supremas?|carne|lomos?|bifes?|presas?|trozos?|cubos?|fetas?|dientes?|hojas?|ramitas?|jugo|ralladura) de /;

function cubre(elegidos, ingrediente, amplio = false) {
  const vr = variantes(ingrediente);
  return elegidos.some((vs) => vs.some((s) => vr.some((r) =>
    r === s
    || (r.startsWith(`${s} `) && (amplio || !r.startsWith(`${s} de `)))
    || (CORTES.test(r) && (r.replace(CORTES, '') === s || r.replace(CORTES, '').startsWith(`${s} `))))));
}

function leerGuardado() {
  try {
    const d = JSON.parse(localStorage.getItem(CLAVE_GUARDADO) || '{}');
    return { lista: Array.isArray(d.lista) ? d.lista : [], basicos: d.basicos !== false };
  } catch {
    return { lista: [], basicos: true };
  }
}

function guardar(estado) {
  try { localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(estado)); } catch { /* sin almacenamiento */ }
}

async function recetasConIngredientes() {
  const [delCatalogo, deCasa] = await Promise.all([
    catalogo.todas().catch(() => []),
    casa.todas(),
  ]);
  return [
    ...deCasa.map((r) => ({ ...r, nombresIngredientes: r.ingredientes.map((i) => i.nombre) })),
    ...delCatalogo,
  ];
}

export async function vistaDespensa() {
  const vigente = vigencia();
  cargando();
  const recetas = await recetasConIngredientes();
  if (!vigente()) return;
  document.title = '¿Qué tengo en casa? · Recetario';

  const estado = leerGuardado();
  const chips = el('div', { class: 'chips-despensa' });
  const resultados = el('div', { class: 'despensa-resultados' });

  // ---------- buscador de ingredientes ----------
  const lista = el('ul', { class: 'sugerencias', role: 'listbox', hidden: true });
  let opciones = [];
  let activa = -1;
  const entrada = el('input', {
    type: 'search', placeholder: 'Escribí un ingrediente: huevo, papa, pollo…', autocomplete: 'off',
    'aria-label': 'Agregar ingrediente', role: 'combobox', 'aria-autocomplete': 'list',
  });
  const cerrar = () => { lista.hidden = true; activa = -1; };
  const marcar = (i) => {
    activa = i;
    [...lista.children].forEach((li, j) => li.classList.toggle('activa', j === i));
  };
  function agregar(nombre) {
    const n = nombre.trim();
    if (n && !estado.lista.some((x) => normalizar(x) === normalizar(n))) estado.lista.push(n);
    entrada.value = '';
    cerrar();
    actualizar();
    entrada.focus();
  }
  entrada.addEventListener('input', async () => {
    const texto = entrada.value;
    opciones = await sugerir(texto);
    if (entrada.value !== texto) return;
    lista.replaceChildren(...opciones.map((ing, i) => el('li', {
      role: 'option',
      onmousedown: (e) => { e.preventDefault(); agregar(ing.nombre); },
      onmouseenter: () => marcar(i),
    },
    crearImagen(ing.clave ? urlIngrediente(ing.clave) : IMG_INGREDIENTE_GENERICO, '', IMG_INGREDIENTE_GENERICO),
    el('span', {}, ing.nombre))));
    lista.hidden = !opciones.length;
    marcar(opciones.length ? 0 : -1);
  });
  entrada.addEventListener('blur', cerrar);
  entrada.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && !lista.hidden) { e.preventDefault(); marcar((activa + 1) % opciones.length); }
    else if (e.key === 'ArrowUp' && !lista.hidden) { e.preventDefault(); marcar((activa - 1 + opciones.length) % opciones.length); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (!lista.hidden && activa >= 0) agregar(opciones[activa].nombre);
      else if (entrada.value.trim()) agregar(entrada.value);
    } else if (e.key === 'Escape') cerrar();
  });

  const basicos = el('input', {
    type: 'checkbox', checked: estado.basicos,
    onchange: () => { estado.basicos = basicos.checked; actualizar(); },
  });

  // ---------- resultados ----------
  function tarjeta(r) {
    const t = tarjetaReceta(r);
    const cuerpo = t.querySelector('.tarjeta-cuerpo');
    cuerpo.append(r.faltan.length
      ? el('p', { class: 'despensa-faltan' },
        `Te ${r.faltan.length === 1 ? 'falta' : 'faltan'} ${r.faltan.length}: `,
        el('span', {}, r.faltan.slice(0, 4).join(', ') + (r.faltan.length > 4 ? '…' : '')))
      : el('p', { class: 'despensa-completa' }, '✓ Tenés todo'));
    return t;
  }

  function dibujarResultados() {
    if (!estado.lista.length) {
      resultados.replaceChildren(el('p', { class: 'estado' },
        'Agregá los ingredientes que tenés en tu cocina y te muestro qué podés preparar.'));
      return;
    }
    const elegidos = estado.lista.map(variantes);
    const extras = estado.basicos ? BASICOS.map(variantes) : [];
    const encontradas = [];
    for (const r of recetas) {
      const ings = r.nombresIngredientes || [];
      if (!ings.length) continue;
      const usados = ings.filter((i) => cubre(elegidos, i));
      if (!usados.length) continue;
      const faltan = ings.filter((i) => !usados.includes(i) && !cubre(extras, i, true));
      encontradas.push({ ...r, usados: usados.length, faltan });
    }
    encontradas.sort((a, b) => a.faltan.length - b.faltan.length || b.usados - a.usados);
    if (!encontradas.length) {
      resultados.replaceChildren(el('p', { class: 'estado' }, 'No encontré recetas con esos ingredientes. Probá agregando otros.'));
      return;
    }
    const listas = encontradas.filter((r) => !r.faltan.length).length;
    const grilla = el('div', { class: 'grilla' });
    let mostradas = 0;
    const boton = el('button', { type: 'button', class: 'boton-secundario', onclick: () => mas() });
    const pie = el('div', { class: 'ver-mas' }, boton);
    function mas() {
      grilla.append(...encontradas.slice(mostradas, mostradas + TANDA).map(tarjeta));
      mostradas = Math.min(encontradas.length, mostradas + TANDA);
      boton.textContent = `Ver más (${encontradas.length - mostradas} restantes)`;
      pie.hidden = mostradas >= encontradas.length;
    }
    mas();
    resultados.replaceChildren(
      el('p', { class: 'meta' },
        `${encontradas.length} recetas usan tus ingredientes`,
        listas ? ` · ${listas} ${listas === 1 ? 'se puede' : 'se pueden'} hacer con lo que tenés` : ''),
      grilla, pie);
  }

  function actualizar() {
    guardar(estado);
    chips.replaceChildren(...[...estado.lista.map((nombre) => el('span', { class: 'chip-despensa' },
      nombre,
      el('button', {
        type: 'button', 'aria-label': `Quitar ${nombre}`,
        onclick: () => { estado.lista = estado.lista.filter((x) => x !== nombre); actualizar(); },
      }, '✕'))),
    estado.lista.length > 1 && el('button', {
      type: 'button', class: 'boton-texto',
      onclick: () => { estado.lista = []; actualizar(); },
    }, 'Borrar todo')].filter(Boolean));
    dibujarResultados();
  }

  mostrar(
    el('section', { class: 'despensa' },
      el('h1', {}, '¿Qué tengo en casa?'),
      el('p', { class: 'meta' }, 'Elegí los ingredientes que tenés y te muestro las recetas que los usan, primero las que te piden menos cosas extra.'),
      el('div', { class: 'combo despensa-buscador' }, entrada, lista),
      chips,
      el('label', { class: 'despensa-basicos' }, basicos, ' Doy por hecho que tengo sal, pimienta, agua y aceite')),
    resultados);
  actualizar();
}
