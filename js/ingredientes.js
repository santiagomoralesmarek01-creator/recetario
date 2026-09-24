// Lista de ingredientes conocidos (data/ingredientes.json, la genera
// scripts/traducir-catalogo.py): [nombre, clave de imagen, recetas que lo usan].
// La usa el buscador de ingredientes del formulario de recetas propias.

let promesa = null;

export function cargarIngredientes() {
  promesa ??= fetch('data/ingredientes.json')
    .then((r) => (r.ok ? r.json() : []))
    .then((lista) => lista.map(([nombre, clave, usos]) => ({ nombre, clave, usos, normal: normalizar(nombre) })))
    .catch(() => {
      promesa = null;
      return [];
    });
  return promesa;
}

export const normalizar = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// Primero los que empiezan con el texto, después los que tienen una palabra
// que empieza así ("caldo de pollo") y al final los que lo contienen; dentro
// de cada grupo, los más usados en recetas.
export async function sugerir(texto, limite = 8) {
  const q = normalizar(texto);
  if (!q) return [];
  const lista = await cargarIngredientes();
  const empiezan = [];
  const palabra = [];
  const contienen = [];
  for (const ing of lista) {
    if (ing.normal.startsWith(q)) empiezan.push(ing);
    else if (ing.normal.includes(` ${q}`)) palabra.push(ing);
    else if (ing.normal.includes(q)) contienen.push(ing);
    if (empiezan.length >= limite) break;
  }
  return [...empiezan, ...palabra, ...contienen].slice(0, limite);
}

export async function buscarExacto(nombre) {
  const q = normalizar(nombre);
  return (await cargarIngredientes()).find((i) => i.normal === q) || null;
}

// ---------- unidades de medida ----------

// [valor, singular, plural]. Sin cantidad: "a gusto" y "cantidad necesaria".
export const UNIDADES = [
  ['', 'unidad', 'unidades'],
  ['g', 'g', 'g'], ['kg', 'kg', 'kg'], ['ml', 'ml', 'ml'], ['l', 'l', 'l'],
  ['taza', 'taza', 'tazas'], ['cda', 'cda', 'cdas'], ['cdta', 'cdta', 'cdtas'],
  ['pizca', 'pizca', 'pizcas'], ['chorrito', 'chorrito', 'chorritos'],
  ['diente', 'diente', 'dientes'], ['feta', 'feta', 'fetas'], ['hoja', 'hoja', 'hojas'],
  ['ramita', 'ramita', 'ramitas'], ['puñado', 'puñado', 'puñados'], ['atado', 'atado', 'atados'],
  ['lata', 'lata', 'latas'], ['paquete', 'paquete', 'paquetes'],
  ['a gusto', 'a gusto', 'a gusto'], ['cantidad necesaria', 'cantidad necesaria', 'cantidad necesaria'],
];

export const SIN_CANTIDAD = new Set(['a gusto', 'cantidad necesaria']);

function esPlural(cantidad) {
  const n = Number(String(cantidad).replace(',', '.'));
  return Number.isFinite(n) ? n > 1 : /\d\s+\d|\d+-\d+/.test(cantidad);
}

// cantidad "2" + unidad "taza" -> "2 tazas"
export function armarMedida(cantidad, unidad) {
  if (SIN_CANTIDAD.has(unidad)) return unidad;
  const c = cantidad.trim();
  if (!unidad) return c;
  const u = UNIDADES.find(([valor]) => valor === unidad);
  if (!c) return u[1];
  return `${c} ${esPlural(c) ? u[2] : u[1]}`;
}

// "2 tazas" -> { cantidad: "2", unidad: "taza" }. Si no la reconoce, queda todo como cantidad.
export function separarMedida(medida = '') {
  const m = medida.trim();
  if (SIN_CANTIDAD.has(m.toLowerCase())) return { cantidad: '', unidad: m.toLowerCase() };
  const partes = m.match(/^([\d.,/½¼¾⅓\s-]*\d[\d.,/½¼¾⅓]*|[½¼¾⅓])\s*(.*)$/);
  if (partes) {
    const texto = partes[2].toLowerCase();
    const u = UNIDADES.find(([valor, sing, plural]) => valor && (texto === sing || texto === plural));
    if (u) return { cantidad: partes[1].trim(), unidad: u[0] };
    if (!texto || texto === 'unidad' || texto === 'unidades') return { cantidad: partes[1].trim(), unidad: '' };
  }
  return { cantidad: m, unidad: '' };
}
