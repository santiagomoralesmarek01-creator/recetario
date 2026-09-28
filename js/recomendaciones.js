// Recetas de la web que el ayudante puede recomendar: antes de cada pregunta
// se buscan las que tienen que ver (por nombre, país, categoría o ingredientes)
// y se le pasan a la IA, que sólo puede recomendar de esa lista.
import * as catalogo from './catalogo.js';
import * as casa from './recetasCasa.js';
import { traducirCategoria } from './traducciones.js';
import { urlPlato } from './imagenes.js';
import { NIVELES } from './dificultad.js';

const MAX_CANDIDATAS = 12;

const sinTildes = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const palabras = (t) => sinTildes(t).split(/[^a-zñ0-9]+/).filter(Boolean);

// Palabras que no ayudan a encontrar recetas.
const VACIAS = new Set(`
  que qué para como cómo con sin una uno unas unos los las del por pero esta este esto estas estos
  hay tengo tenes tenés tiene quiero queres podes puedo puede hacer hago hace algo alguna algun alguno
  receta recetas recomenda recomendame recomendas recomendar sugeri sugerime idea ideas plato platos
  comida comidas cocinar cocino preparo preparar rico rica ricos ricas facil faciles rapido rapida
  hoy noche dia mañana manana cena almuerzo tarde casa mas menos muy bien todo toda todos todas
  cual cuales cuando donde mejor otra otro otras otros dame decime tenga tengan sea sean usar uso
`.split(/\s+/).filter(Boolean).map(sinTildes));

// Sinónimos que llevan a una categoría del catálogo.
const SINONIMOS = {
  dulce: 'Dessert', dulces: 'Dessert', torta: 'Dessert', tortas: 'Dessert', postre: 'Dessert',
  vegano: 'Vegan', vegana: 'Vegan', veganas: 'Vegan', veganos: 'Vegan',
  vaca: 'Beef', vacuna: 'Beef', mariscos: 'Seafood', pescado: 'Seafood', pescados: 'Seafood',
};

// Dos palabras "coinciden" si comparten las primeras 5 letras (o son iguales si son cortas):
// así "argentinas" encuentra "Argentina" y "mexicanas" encuentra "México".
function coincide(buscada, palabra) {
  if (buscada.length < 5 || palabra.length < 5) return buscada.replace(/s$/, '') === palabra.replace(/s$/, '');
  return buscada.slice(0, 5) === palabra.slice(0, 5);
}
const enTexto = (buscada, lista) => lista.some((p) => coincide(buscada, p));

let indicePromesa = null;

function cargarIndice() {
  indicePromesa ??= Promise.all([catalogo.todas().catch(() => []), casa.todas()])
    .then(([delCatalogo, deCasa]) => [...deCasa, ...delCatalogo].map((r) => {
      const categoria = r.categoria ? traducirCategoria(r.categoria) : '';
      const ingredientes = r.nombresIngredientes || (r.ingredientes || []).map((i) => i.nombre);
      return {
        id: r.id,
        nombre: r.nombre,
        detalle: [categoria, r.origen, r.dificultad && NIVELES[r.dificultad].nombre.toLowerCase()].filter(Boolean).join(' · '),
        imagen: r.imagen || '',
        codigoCategoria: r.categoria,
        esDeCasa: r.id.startsWith('c-'),
        pNombre: palabras(r.nombre),
        pOrigen: palabras(r.origen || ''),
        pCategoria: palabras(categoria),
        pIngredientes: palabras(ingredientes.join(' ')),
      };
    }))
    .catch((err) => {
      indicePromesa = null;
      throw err;
    });
  return indicePromesa;
}

// Busca recetas relacionadas con el texto. Devuelve [{ id, nombre, detalle, imagen }].
export async function buscarCandidatas(texto) {
  const buscadas = [...new Set(palabras(texto).filter((p) => p.length >= 3 && !VACIAS.has(p)))];
  if (!buscadas.length) return [];
  const recetas = await cargarIndice();
  // Ingredientes que están en casi todo (sal, aceite…) no sirven para elegir.
  const comunes = new Set(buscadas.filter((b) => recetas.filter((r) => enTexto(b, r.pIngredientes)).length > recetas.length / 4));

  const puntuadas = [];
  for (const r of recetas) {
    let puntos = 0;
    let acertadas = 0;
    for (const b of buscadas) {
      let p = 0;
      if (enTexto(b, r.pNombre)) p += 3;
      if (enTexto(b, r.pOrigen)) p += 3;
      if (enTexto(b, r.pCategoria) || SINONIMOS[b] === r.codigoCategoria) p += 2;
      if (!comunes.has(b) && enTexto(b, r.pIngredientes)) p += 1;
      if (p) { puntos += p; acertadas++; }
    }
    if (puntos) puntuadas.push({ r, puntos, acertadas });
  }
  puntuadas.sort((a, b) => b.acertadas - a.acertadas || b.puntos - a.puntos
    || Number(b.r.esDeCasa) - Number(a.r.esDeCasa) || a.r.nombre.localeCompare(b.r.nombre, 'es'));
  return puntuadas.slice(0, MAX_CANDIDATAS).map(({ r }) => ({
    id: r.id,
    nombre: r.nombre,
    detalle: r.detalle,
    imagen: r.imagen ? urlPlato(r.imagen, { miniatura: /themealdb\.com/.test(r.imagen) }) : '',
  }));
}

// La IA marca las recomendaciones como [[id]]. Devuelve las recetas citadas
// que estaban en la lista de candidatas (las inventadas se descartan).
export function recetasCitadas(texto, candidatas) {
  const porId = new Map(candidatas.map((c) => [c.id, c]));
  const citadas = [];
  for (const [, id] of texto.matchAll(/\[\[\s*([\w-]+)\s*\]\]/g)) {
    const c = porId.get(id);
    if (c && !citadas.includes(c)) citadas.push(c);
  }
  return citadas;
}
