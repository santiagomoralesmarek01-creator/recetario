// TheMealDB está en inglés. Este diccionario muestra en español los nombres
// de ingredientes y categorías más comunes y permite buscar "pollo" -> "chicken".
// Lo que no esté en el diccionario se muestra en inglés; se puede ir ampliando.

export const CATEGORIAS = {
  Beef: 'Carne vacuna',
  Breakfast: 'Desayuno',
  Chicken: 'Pollo',
  Dessert: 'Postres',
  Goat: 'Cabra',
  Lamb: 'Cordero',
  Miscellaneous: 'Varios',
  Pasta: 'Pastas',
  Pork: 'Cerdo',
  Seafood: 'Pescados y mariscos',
  Side: 'Guarniciones',
  Starter: 'Entradas',
  Vegan: 'Vegano',
  Vegetarian: 'Vegetariano',
};

export const ORIGENES = {
  American: 'Estados Unidos', British: 'Reino Unido', Canadian: 'Canadá',
  Chinese: 'China', Croatian: 'Croacia', Dutch: 'Países Bajos', Egyptian: 'Egipto',
  Filipino: 'Filipinas', French: 'Francia', Greek: 'Grecia', Indian: 'India',
  Irish: 'Irlanda', Italian: 'Italia', Jamaican: 'Jamaica', Japanese: 'Japón',
  Kenyan: 'Kenia', Malaysian: 'Malasia', Mexican: 'México', Moroccan: 'Marruecos',
  Polish: 'Polonia', Portuguese: 'Portugal', Russian: 'Rusia', Spanish: 'España',
  Thai: 'Tailandia', Tunisian: 'Túnez', Turkish: 'Turquía', Ukrainian: 'Ucrania',
  Vietnamese: 'Vietnam', Argentinian: 'Argentina', Unknown: 'Desconocido',
};

export const INGREDIENTES = {
  'apple': 'manzana', 'avocado': 'palta', 'bacon': 'panceta', 'baking powder': 'polvo de hornear',
  'basil': 'albahaca', 'bay leaf': 'laurel', 'bay leaves': 'laurel', 'beef': 'carne vacuna',
  'black pepper': 'pimienta negra', 'bread': 'pan', 'breadcrumbs': 'pan rallado',
  'broccoli': 'brócoli', 'brown sugar': 'azúcar mascabo', 'butter': 'manteca',
  'carrot': 'zanahoria', 'carrots': 'zanahorias', 'celery': 'apio', 'cheddar cheese': 'queso cheddar',
  'chicken': 'pollo', 'chicken breast': 'pechuga de pollo', 'chicken breasts': 'pechugas de pollo',
  'chicken stock': 'caldo de pollo', 'chicken thighs': 'muslos de pollo', 'chili powder': 'ají molido',
  'chilli': 'ají picante', 'chilli powder': 'ají molido', 'chocolate': 'chocolate',
  'cinnamon': 'canela', 'cocoa': 'cacao', 'coconut milk': 'leche de coco', 'coriander': 'cilantro',
  'cream': 'crema', 'cumin': 'comino', 'double cream': 'crema de leche', 'egg': 'huevo',
  'egg yolks': 'yemas', 'eggs': 'huevos', 'flour': 'harina', 'garlic': 'ajo',
  'garlic clove': 'diente de ajo', 'ginger': 'jengibre', 'green pepper': 'morrón verde',
  'ham': 'jamón', 'honey': 'miel', 'lamb': 'cordero', 'lemon': 'limón', 'lemon juice': 'jugo de limón',
  'lettuce': 'lechuga', 'lime': 'lima', 'milk': 'leche', 'mint': 'menta', 'mozzarella': 'mozzarella',
  'mushrooms': 'hongos', 'mustard': 'mostaza', 'olive oil': 'aceite de oliva', 'onion': 'cebolla',
  'onions': 'cebollas', 'oregano': 'orégano', 'paprika': 'pimentón', 'parmesan': 'queso parmesano',
  'parmesan cheese': 'queso parmesano', 'parsley': 'perejil', 'peas': 'arvejas', 'penne rigate': 'penne',
  'pork': 'cerdo', 'potatoes': 'papas', 'potato': 'papa', 'prawns': 'langostinos',
  'red onions': 'cebollas moradas', 'red pepper': 'morrón rojo', 'red pepper flakes': 'ají molido',
  'rice': 'arroz', 'rosemary': 'romero', 'salmon': 'salmón', 'salt': 'sal', 'sausages': 'salchichas',
  'soy sauce': 'salsa de soja', 'spaghetti': 'espaguetis', 'spinach': 'espinaca',
  'spring onions': 'cebolla de verdeo', 'sugar': 'azúcar', 'thyme': 'tomillo', 'tomato': 'tomate',
  'tomato puree': 'puré de tomate', 'tomatoes': 'tomates', 'tuna': 'atún', 'vanilla extract': 'esencia de vainilla',
  'vegetable oil': 'aceite vegetal', 'vinegar': 'vinagre', 'water': 'agua', 'white wine': 'vino blanco',
  'red wine': 'vino tinto', 'yogurt': 'yogur', 'zucchini': 'zucchini', 'courgettes': 'zucchinis',
};

// Ingredientes en español que no están arriba, para encontrar su imagen.
const SOLO_IMAGEN = {
  'carne picada': 'minced beef', 'harina 0000': 'plain flour', 'harina': 'plain flour',
  'huevo': 'egg', 'huevos': 'eggs', 'papa': 'potatoes', 'papas': 'potatoes',
  'aceitunas': 'green olives', 'aceitunas verdes': 'green olives', 'grasa vacuna': 'lard',
  'lentejas': 'lentils', 'chorizo': 'chorizo', 'panceta': 'bacon', 'morron': 'red pepper',
  'queso': 'cheese', 'queso rallado': 'parmesan', 'nuez moscada': 'nutmeg',
  'vinagre de vino': 'red wine vinegar', 'pimienta': 'black pepper', 'caldo': 'vegetable stock',
  'caldo de verdura': 'vegetable stock', 'dulce de leche': 'condensed milk', 'nalga': 'beef',
  'cuadril': 'beef', 'muslos de pollo': 'chicken legs', 'pata muslo': 'chicken legs',
};

// Índice inverso español -> inglés, para las búsquedas.
const INGREDIENTE_EN = {
  ...Object.fromEntries(Object.entries(INGREDIENTES).map(([en, es]) => [sinTildes(es), en])),
  ...SOLO_IMAGEN,
};
const INVERSO = { ...INGREDIENTE_EN };
Object.entries(CATEGORIAS).forEach(([en, es]) => { INVERSO[sinTildes(es)] ??= en.toLowerCase(); });
Object.assign(INVERSO, {
  pasta: 'pasta', tarta: 'tart', torta: 'cake', sopa: 'soup', guiso: 'stew',
  ensalada: 'salad', pescado: 'fish', carne: 'beef', hamburguesa: 'burger',
  pan: 'bread', pizza: 'pizza', curry: 'curry', empanada: 'pie', pastel: 'pie',
});

function sinTildes(texto) {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

export function traducirIngrediente(nombreEn) {
  const es = INGREDIENTES[nombreEn.toLowerCase()];
  return es ? es.charAt(0).toUpperCase() + es.slice(1) : nombreEn;
}

// Nombre en inglés (con mayúsculas, como en TheMealDB) para buscar la imagen de un
// ingrediente escrito en español. Devuelve '' si no lo conoce.
export function ingredienteEnIngles(nombreEs) {
  const base = sinTildes(nombreEs).replace(/\s*\(.*\)\s*/g, '');
  const en = INGREDIENTE_EN[base] || INGREDIENTE_EN[base.replace(/s$/, '')] || '';
  return en.replace(/\b\w/g, (c) => c.toUpperCase());
}

export const traducirCategoria = (c) => CATEGORIAS[c] || c;
export const traducirOrigen = (o) => ORIGENES[o] || o;

// Devuelve el término en inglés para buscar en la API (o el mismo texto si no lo conoce).
export function terminoDeBusqueda(texto) {
  return INVERSO[sinTildes(texto)] || texto.trim();
}
