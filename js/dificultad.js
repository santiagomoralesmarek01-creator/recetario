// Dificultad de una receta pensada para quien cocina en Latinoamérica:
// cuánto trabajo lleva (pasos, tiempo, técnicas) y si los ingredientes se
// consiguen en un supermercado común, con qué reemplazarlos si no.
// Sin dependencias del navegador: también lo usa scripts/clasificar-dificultad.mjs.

const normalizar = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export const NIVELES = {
  1: { nombre: 'Fácil', icono: '🟢', descripcion: 'Pocos pasos y técnicas simples' },
  2: { nombre: 'Intermedia', icono: '🟡', descripcion: 'Lleva algo más de tiempo o de práctica' },
  3: { nombre: 'Difícil', icono: '🔴', descripcion: 'Muchos pasos, técnicas delicadas o varias horas' },
};

// Ingredientes que suelen ser difíciles de conseguir en Latinoamérica, con un
// reemplazo casero cuando lo hay. [patrón sobre el nombre normalizado, reemplazo]
const DIFICILES = [
  [/salsa de pescado|prahok|pasta de camarones|camarones secos/, 'salsa de soja con unas gotas de jugo de lima'],
  [/lemongrass/, 'ralladura de limón'],
  [/lima kaffir|hojas de lima\b/, 'ralladura de lima'],
  [/galanga/, 'jengibre fresco'],
  [/\bmiso\b/, 'salsa de soja'],
  [/\bmirin\b/, 'vinagre de arroz con una pizca de azúcar'],
  [/\bsake\b|vino de arroz|vino de shaoxing/, 'jerez seco o vino blanco'],
  [/golden syrup|almibar dorado/, 'miel'],
  [/melaza/, 'miel de caña o miel'],
  [/creme fraiche/, 'crema de leche con unas gotas de limón'],
  [/crema de leche doble|clotted cream|crema espesa/, 'crema de leche'],
  [/buttermilk|suero de manteca/, 'leche con una cucharada de jugo de limón'],
  [/garam masala|masala|ras el hanout|especias kabsa|cinco especias/, 'curry en polvo con una pizca de canela'],
  [/tahini|pasta de sesamo/, 'pasta de maní o semillas de sésamo procesadas'],
  [/harissa/, 'ají molido con ajo y aceite de oliva'],
  [/gochujang|doubanjiang|pasta de porotos picante/, 'ají molido con salsa de soja y azúcar'],
  [/salsa hoisin|salsa de ciruela/, 'salsa de soja con miel'],
  [/salsa de ostras/, 'salsa de soja con una pizca de azúcar'],
  [/paneer|halloumi|queso quark|bryndza|vasterbotten/, 'queso fresco o cremoso'],
  [/pak choi|bok choy|brocoli chino|repollo chino|espinaca de agua/, 'acelga'],
  [/daikon/, 'rabanitos'],
  [/zumaque|sumac/, 'ralladura de limón'],
  [/jarabe de arce/, 'miel'],
  [/scotch bonnet|ojo de pajaro|habanero/, 'ají picante'],
  [/pimienta de sichuan|pimienta de kampot/, 'pimienta negra'],
  [/agua de rosas|agua de azahar/, 'esencia de vainilla'],
  [/pasta de curry|curry jamaiquino/, 'curry en polvo con leche de coco'],
  [/pasta de tamarindo|pulpa de tamarindo|bola de tamarindo/, 'jugo de limón con azúcar negra'],
  [/fenogreco|mahleb|asafetida|amchur/, null],
  [/ackee|callaloo|longan|taro|yautia|name blanco|fruta del pan|papaya verde|mulujia/, null],
  [/hojas de pandan|hojas de parra|hojas de banano/, null],
  [/grasa de ganso|grasa de pella/, 'manteca'],
  [/nabo sueco|apionabo|chirivia|topinambur|ruibarbo/, 'papa, zanahoria o zapallo según la receta'],
  [/tempeh/, null],
  [/masa filo|masa kataifi|masa wonton|papel de arroz|obleas de harina de arroz/, null],
  [/fideos udon/, 'fideos gruesos'],
  [/queso stilton/, 'queso azul'],
  [/queso monterey|colby jack/, 'queso de máquina o pategrás'],
  [/relleno de frutas secas|mincemeat|budin de navidad/, null],
  [/rabano picante/, 'mostaza picante'],
  [/bayas de enebro|arandanos de saskatoon|grosella/, null],
  [/carne de cabrito|patas de pato|ancas de rana|rinon de cordero|haggis/, null],
  [/castanas de agua|brotes de bambu|hongos oreja de madera/, null],
  [/sriracha/, 'salsa picante'],
  [/salsa lizano|especias speculaas|delicias turcas|stroop/, null],
];

// Palabras que indican técnicas que requieren práctica.
const TECNICAS = [
  /\b(leud|lev(ar|e|en)|levadura|masa madre)/,
  /\b(laminar|hojaldr|hojaldre)/,
  /\btempl(ar|ado) (el )?chocolate/,
  /\b(caramelo|punto (de )?(bolita|hilo|letra)|termometro)/,
  /\bbano (de )?maria/,
  /\b(merengue|punto nieve)/,
  /\b(abundante aceite|freir en aceite caliente|fritura profunda|freidora)/,
  /\b(flamb|flamear)/,
  /\b(emulsi|mayonesa casera)/,
  /\b(repulg|enrollar|arrollar|rellenar y cerrar)/,
  /\b(gelatina|hidratar)/,
  /\b(deshuesar|filetear|descamar|limpiar (el|los) (pescado|calamar|pulpo))/,
  /\b(amasar)/,
];

const TRIVIAL = /^(sal|pimienta|agua|aceite|hielo)( |$)/;

// Esperas (reposo, marinada, heladera): hay que planificarlas, pero no cuestan trabajo.
const ESPERA = /repos|marin|remojo|heladera|refrigera|freezer|congela|enfri|leud|lev(ar|e|en)\b|toda la noche|de un dia para/;

// Minutos de trabajo que mencionan los pasos (se suma cada paso, tomando el
// tiempo más largo de cada uno; las esperas cuentan un cuarto).
function minutosEnPasos(pasos) {
  let total = 0;
  for (const paso of pasos) {
    const t = normalizar(paso)
      .replace(/toda la noche|de un dia para (el )?otro|overnight/g, '8 horas')
      .replace(/media hora/g, '30 minutos');
    let mayor = 0;
    for (const m of t.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:(?:a|o|-)\s*\d+(?:[.,]\d+)?\s*)?(horas?|hs|minutos?|min)\b/g)) {
      const n = Number(m[1].replace(',', '.'));
      mayor = Math.max(mayor, m[2].startsWith('h') ? n * 60 : n);
    }
    total += Math.min(mayor, 24 * 60) * (ESPERA.test(t) ? 0.25 : 1);
  }
  return total;
}

// Ingredientes difíciles de conseguir: [{ nombre, reemplazo }]. Acepta nombres
// o { nombre, medida } (a veces la medida aclara: "Lima" · "2 hojas de lima kaffir").
export function ingredientesDificiles(ingredientes) {
  const encontrados = [];
  for (const i of ingredientes) {
    const nombre = typeof i === 'string' ? i : i?.nombre;
    if (!nombre) continue;
    const n = normalizar(typeof i === 'string' ? i : `${i.nombre} ${i.medida || ''}`);
    const regla = DIFICILES.find(([patron]) => patron.test(n));
    if (regla && !encontrados.some((e) => e.nombre === nombre)) encontrados.push({ nombre, reemplazo: regla[1] });
  }
  return encontrados;
}

// { nivel: 1..3, dificiles: [{ nombre, reemplazo }], motivos: [...] }
export function clasificar({ ingredientes = [], pasos = [], minutos = null }) {
  const nombres = ingredientes.map((i) => (typeof i === 'string' ? i : i.nombre)).filter(Boolean);
  const utiles = nombres.filter((n) => !TRIVIAL.test(normalizar(n)));
  const texto = normalizar(pasos.join(' '));
  let puntos = 0;
  const motivos = [];

  // Umbrales calibrados con el catálogo (la mitad de las recetas tiene
  // 9 ingredientes o menos, 5 pasos o menos y unos 850 caracteres de preparación).
  if (utiles.length >= 14) { puntos += 2; motivos.push('muchos ingredientes'); }
  else if (utiles.length >= 11) puntos += 1;

  const cantidadPasos = pasos.length;
  if (cantidadPasos >= 9 || texto.length > 1800) { puntos += 2; motivos.push('preparación larga'); }
  else if (cantidadPasos >= 6 || texto.length > 1200) puntos += 1;

  // El tiempo total declarado suele incluir esperas: sólo se usa si los pasos no dicen tiempos.
  const tiempo = minutosEnPasos(pasos) || Number(minutos) || 0;
  if (tiempo >= 150) { puntos += 2; motivos.push('varias horas'); }
  else if (tiempo >= 60) { puntos += 1; motivos.push('más de una hora'); }

  const tecnicas = TECNICAS.filter((t) => t.test(texto)).length;
  if (tecnicas) { puntos += Math.min(3, tecnicas); if (tecnicas >= 2) motivos.push('técnicas que piden práctica'); }

  const nivel = puntos <= 1 ? 1 : puntos <= 4 ? 2 : 3;
  return { nivel, dificiles: ingredientesDificiles(ingredientes), motivos };
}
