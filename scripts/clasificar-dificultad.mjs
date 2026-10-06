// Precalcula la dificultad de las recetas del catálogo (data/mealdb/*.json)
// para poder mostrarla y filtrar en los listados sin abrir cada receta.
// Genera data/mealdb/dificultad.json: { id: [nivel, ingredientesDifícilesDeConseguir] }
// Uso: node scripts/clasificar-dificultad.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { clasificar } from '../js/dificultad.js';

const DIR = new URL('../data/mealdb/', import.meta.url);
const salida = {};
const cuenta = { 1: 0, 2: 0, 3: 0 };
let conDificiles = 0;
for (const archivo of readdirSync(DIR).filter((f) => /^\d+\.json$/.test(f)).sort()) {
  const d = JSON.parse(readFileSync(new URL(archivo, DIR), 'utf8'));
  const { nivel, dificiles } = clasificar({ ingredientes: d.ingredientes.map(([nombre, medida]) => ({ nombre, medida })), pasos: d.pasos || [] });
  salida[d.id] = [nivel, dificiles.length];
  cuenta[nivel]++;
  if (dificiles.length) conDificiles++;
}
writeFileSync(new URL('dificultad.json', DIR), JSON.stringify(salida));
const total = Object.keys(salida).length;
console.log(`${total} recetas · fáciles ${cuenta[1]} · intermedias ${cuenta[2]} · difíciles ${cuenta[3]} · con ingredientes difíciles de conseguir ${conDificiles}`);
