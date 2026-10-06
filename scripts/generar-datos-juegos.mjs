// Genera supabase/juegos-datos-1.sql, -2.sql y -3.sql: el catálogo que usan los juegos del
// torneo (recetas, ingredientes y países) para que las partidas las arme y
// las corrija el servidor. Usa el mismo código que la web (js/juegos/datos.js)
// corriendo en un navegador, así los datos coinciden exactamente.
//
// Uso: con la web servida en http://localhost:8812 (cualquier servidor
// estático sirve), ejecutar:
//   node scripts/generar-datos-juegos.mjs [url] [ruta-de-playwright]
// Después, correr las 3 partes en el SQL Editor de Supabase (después de torneo.sql).
import { writeFileSync } from 'node:fs';

const URL_WEB = process.argv[2] || 'http://localhost:8812/';
const PLAYWRIGHT = process.argv[3] || 'playwright';
const { chromium } = await import(PLAYWRIGHT);

const navegador = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const pagina = await navegador.newPage();
// Sin fotos cargadas por administradores: las rondas usan la foto original.
await pagina.route(/supabase\.co|jsdelivr|fonts\.|_vercel/, (r) => r.abort());
await pagina.goto(URL_WEB);
const datos = await pagina.evaluate(async () => {
  const { cargarDatos, esTrivial, raiz } = await import('/js/juegos/datos.js');
  const { normalizar } = await import('/js/ingredientes.js');
  const { continenteDe, LATINOAMERICA } = await import('/js/paises.js');
  const { recetas, comunes, paisesConRecetas } = await cargarDatos();
  // Igual que nombreDelata de js/juegos/pais.js.
  const delata = (r) => {
    const base = normalizar(r.origen).slice(0, 4);
    return normalizar(r.nombre).split(/[^a-z]+/).some((p) => p.length > 3 && p.startsWith(base));
  };
  const ing = (i) => ({ n: i.nombre, i: i.imagen, u: i.usos, r: raiz(i.nombre), t: esTrivial(i.nombre) });
  return {
    recetas: recetas.map((r) => ({
      id: String(r.id), nombre: r.nombre, origen: r.origen, categoria: r.codigoCategoria, categoriaEs: r.categoria,
      imagen: r.imagen, imagenGrande: r.imagenGrande, latina: r.latina, delata: delata(r), ingredientes: r.ingredientes.map(ing),
    })),
    comunes: comunes.map(ing),
    paises: paisesConRecetas.map((p) => ({ pais: p, continente: continenteDe(p), latina: LATINOAMERICA.has(p) })),
  };
});
await navegador.close();

const txt = (v) => (v == null || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
// Las imágenes de ingredientes se guardan como su clave ("Onion"): la URL completa
// se arma en el servidor (juego_img_ingrediente). Vacío = sin imagen.
const claveIng = (url) => {
  const m = /\/images\/ingredients\/(.+)-Small\.png$/.exec(url || '');
  return m ? decodeURIComponent(m[1]) : '';
};
const MEALDB = 'https://www.themealdb.com/images/media/meals/';
const corta = (url) => (url && url.startsWith(MEALDB) ? `m:${url.slice(MEALDB.length)}` : url || '');
// Ingrediente: [nombre, clave de imagen, usos, raíz, trivial (1/0)].
const ingr = (i) => [i.n, claveIng(i.i), i.u, i.r, i.t ? 1 : 0];
const filas = (tabla, columnas, valores) => {
  const out = [];
  for (let i = 0; i < valores.length; i += 200) {
    out.push(`insert into public.${tabla} (${columnas}) values\n${valores.slice(i, i + 200).map((v) => `(${v.join(', ')})`).join(',\n')}\non conflict do nothing;`);
  }
  return out;
};
// En 3 archivos para que cada uno entre cómodo en el SQL Editor de Supabase.
const recetas = datos.recetas.map((r) => [txt(r.id), txt(r.nombre), txt(r.origen), txt(r.categoria), txt(r.categoriaEs), txt(corta(r.imagenGrande || r.imagen)),
  r.latina, r.delata, `'${JSON.stringify(r.ingredientes.map(ingr)).replace(/'/g, "''")}'`]);
const tercio = Math.ceil(recetas.length / 3);
const partes = [0, 1, 2].map((n) => recetas.slice(n * tercio, (n + 1) * tercio));
partes.forEach((lote, n) => {
  const lineas = [
    `-- Catálogo de los juegos del torneo, parte ${n + 1} de 3. Lo genera scripts/generar-datos-juegos.mjs:`,
    '-- no editar a mano. Correr las 3 partes en orden después de supabase/torneo.sql.',
    'begin;',
    ...(n === 0 ? [
      'delete from public.juego_recetas;',
      'delete from public.juego_comunes;',
      'delete from public.juego_paises;',
      ...filas('juego_paises', 'pais, continente, latina', datos.paises.map((p) => [txt(p.pais), txt(p.continente), p.latina])),
      ...filas('juego_comunes', 'nombre, clave, raiz', datos.comunes.map((c) => [txt(c.n), txt(claveIng(c.i)), txt(c.r)])),
    ] : []),
    ...filas('juego_recetas', 'id, nombre, origen, categoria, categoria_es, imagen, latina, delata, ingredientes', lote),
    'commit;',
    '',
  ];
  writeFileSync(new URL(`../supabase/juegos-datos-${n + 1}.sql`, import.meta.url), lineas.join('\n'));
});
console.log(`${datos.recetas.length} recetas, ${datos.comunes.length} ingredientes comunes, ${datos.paises.length} países`);
