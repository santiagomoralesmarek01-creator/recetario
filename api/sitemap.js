// /sitemap.xml: todas las direcciones que conviene que Google conozca
// (secciones, categorías, países y cada receta pública).
import { SITIO, CATEGORIAS, recetasDeLaCasa, indiceDelMundo, rutaReceta, recetasPublicasDeLaComunidad } from './_datos.js';

const escapar = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default async function handler(req, res) {
  const casa = recetasDeLaCasa();
  const mundo = indiceDelMundo();
  const comunidad = await recetasPublicasDeLaComunidad();
  const categorias = [...new Set([...casa, ...mundo].map((r) => r.categoria).filter((c) => CATEGORIAS[c]))];
  const paises = [...new Set([...casa, ...mundo].map((r) => r.origen).filter(Boolean))];

  const urls = [
    ['/', '1.0'], ['/casa', '0.9'], ['/paises', '0.7'], ['/faciles', '0.7'], ['/que-tengo', '0.8'], ['/juegos', '0.6'], ['/comunidad', '0.6'], ['/privacidad', '0.2'], ['/terminos', '0.2'],
    ...categorias.map((c) => [`/categoria/${encodeURIComponent(c)}`, '0.6']),
    ...paises.map((p) => [`/pais/${encodeURIComponent(p)}`, '0.6']),
    ...casa.map((r) => [rutaReceta(r.id, r.nombre), '0.9']),
    ...comunidad.map((r) => [rutaReceta(`u-${r.id}`, r.nombre), '0.5', r.updated_at?.slice(0, 10)]),
    ...mundo.map((r) => [rutaReceta(r.id, r.nombre), '0.5']),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([ruta, prioridad, fecha]) => `  <url><loc>${escapar(SITIO + ruta)}</loc>${fecha ? `<lastmod>${fecha}</lastmod>` : ''}<priority>${prioridad}</priority></url>`).join('\n')}
</urlset>
`;
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800');
  res.end(xml);
}
