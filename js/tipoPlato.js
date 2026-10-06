// Momento del día (almuerzo/cena, desayuno/merienda, entrada, postre) y
// sabor (salado, dulce, agridulce) de una receta, a partir de su categoría,
// nombre e ingredientes. Sin dependencias del navegador.

const normalizar = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export const MOMENTOS = {
  principal: { nombre: 'Almuerzo/cena', icono: '🍽️' },
  desayuno: { nombre: 'Desayuno/merienda', icono: '🥐' },
  entrada: { nombre: 'Entradas y guarniciones', icono: '🥗' },
  postre: { nombre: 'Postres', icono: '🍰' },
};

export const SABORES = {
  salado: { nombre: 'Salado', icono: '🧂' },
  dulce: { nombre: 'Dulce', icono: '🍯' },
  agridulce: { nombre: 'Agridulce', icono: '🍋' },
};

const nombresDe = (r) => (r.nombresIngredientes
  || (r.ingredientes || []).map((i) => (typeof i === 'string' ? i : i?.nombre))).filter(Boolean);

// Ingredientes que hacen dulce una preparación que no es postre (tortas de merienda, panqueques).
// El azúcar sola no alcanza (muchos panes y masas saladas llevan una pizca), salvo en desayunos.
const DULCE = /\b(dulce de leche|chocolate|cacao|mermelada|leche condensada|jarabe|melaza|almibar|frutillas|frambuesas|banana|dulce de membrillo|coco rallado|chips de chocolate)\b/;
// Lo que da el toque dulce en un plato salado…
const TOQUE_DULCE = /\b(miel|anana|mango|mermelada|ciruelas?|datil\w*|pasas|jarabe|melaza|azucar negra|azucar mascabo|azucar de palma|ketchup|salsa agridulce|salsa de ciruela|salsa hoisin)\b/;
// …y lo que da el ácido.
const ACIDO = /\b(vinagre\w*|jugo de lima|jugo de limon|lima|tamarindo|aceto\w*)\b/;
// Ingredientes claramente salados: si un plato los tiene, no es "dulce" aunque lleve azúcar.
const SALADO = /\b(pollo|carnes?|cerdo|panceta|jamon|chorizo|salchicha\w*|pescado|langostino\w*|atun|cebolla\w*|ajo|papas?|repollo|zanahoria\w*|morron\w*|tomate\w*|berenjena\w*|salsa de soja|salsa de pescado|salmon|queso\w*|palta)\b/;

export function momentoDe(r) {
  const c = r.categoria || '';
  if (c === 'Dessert') return 'postre';
  if (c === 'Breakfast') return 'desayuno';
  if (c === 'Starter' || c === 'Side') return 'entrada';
  const etiquetas = (r.etiquetas || []).map(normalizar);
  if (etiquetas.includes('merienda') || etiquetas.includes('desayuno')) return 'desayuno';
  return 'principal';
}

export function saborDe(r) {
  const ingredientes = nombresDe(r).map(normalizar).join(' | ');
  const nombre = normalizar(r.nombre || '');
  if (/agridulce/.test(`${nombre} ${ingredientes}`)) return 'agridulce';
  if (r.categoria === 'Dessert') return 'dulce';
  const dulce = DULCE.test(ingredientes) || /\bdulce\b/.test(nombre)
    || (r.categoria === 'Breakfast' && /\b(azucar|miel|vainilla|esencia de vainilla)\b/.test(ingredientes));
  const salado = SALADO.test(ingredientes);
  // Desayunos, meriendas y panes dulces: dulce si no llevan nada claramente salado.
  if (dulce && !salado) return 'dulce';
  if (salado && TOQUE_DULCE.test(ingredientes) && ACIDO.test(ingredientes)) return 'agridulce';
  return 'salado';
}
