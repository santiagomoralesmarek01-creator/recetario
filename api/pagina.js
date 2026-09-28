// Páginas para buscadores y redes: Vercel manda acá toda dirección de la web
// (ver vercel.json) y esta función devuelve el mismo index.html con el título,
// la descripción, la foto y, en las recetas, los datos estructurados de
// schema.org/Recipe y el contenido en texto. Después la web arranca igual
// que siempre y reemplaza ese contenido.
import {
  SITIO, CATEGORIAS, indexHtml, buscarReceta, recetasDeLaCasa, indiceDelMundo, rutaReceta, idDeRuta,
} from './_datos.js';

const TITULO = 'A Mano · Cocina latinoamericana a tu medida';
const DESCRIPCION = 'Recetas latinoamericanas que se adaptan a tu país, a tu heladera y a tu nivel. Con lo que hay, alcanza.';
const IMAGEN = `${SITIO}/img/og-image.png`;

const escapar = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const recortar = (s, n = 160) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

// Páginas que no deben aparecer en buscadores.
const PRIVADAS = /^(mis-recetas|nueva|editar|entrar|registro|recuperar|nueva-clave|fotos|buscar|medallas|preferencias)(\/|$)/;

const SECCIONES = {
  '': { titulo: TITULO, descripcion: DESCRIPCION },
  casa: { titulo: 'Clásicos latinoamericanos · A Mano', descripcion: 'Las recetas de siempre de Latinoamérica, explicadas paso a paso y con reemplazos para lo que no se consigue.' },
  paises: { titulo: 'Recetas por país · A Mano', descripcion: 'Recetas de más de 60 países, con Latinoamérica primero.' },
  faciles: { titulo: 'Recetas fáciles con ingredientes de todos los días · A Mano', descripcion: 'Recetas simples, con pocos pasos y lo que hay en cualquier cocina.' },
  'que-tengo': { titulo: '¿Qué hay a mano? Recetas con lo que tenés · A Mano', descripcion: 'Elegí los ingredientes que hay en casa y mirá qué recetas se pueden hacer.' },
  juegos: { titulo: 'Juegos de cocina: Plato del día y más · A Mano', descripcion: 'Adiviná el plato del día, el país de cada receta y el ingrediente que falta.' },
  comunidad: { titulo: 'Recetas de la comunidad · A Mano', descripcion: 'Recetas caseras que comparte la gente de A Mano.' },
  privacidad: { titulo: 'Política de privacidad · A Mano', descripcion: 'Qué datos guarda A Mano, para qué y cómo pedir acceso o borrarlos.' },
  terminos: { titulo: 'Términos y condiciones · A Mano', descripcion: 'Condiciones de uso de A Mano, sus recetas, Manitas y la comunidad.' },
};

function duracion(minutos) {
  const m = Number(minutos);
  if (!m) return undefined;
  const h = Math.floor(m / 60);
  return `PT${h ? `${h}H` : ''}${m % 60 ? `${m % 60}M` : ''}`;
}

function datosEstructurados(r, url) {
  const datos = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: r.nombre,
    url,
    image: r.imagen ? [r.imagen] : undefined,
    description: r.descripcion || `Receta de ${r.nombre}${r.origen ? ` (${r.origen})` : ''}, paso a paso.`,
    recipeCuisine: r.origen || undefined,
    recipeCategory: CATEGORIAS[r.categoria] || r.categoria || undefined,
    recipeYield: r.porciones ? `${r.porciones} porciones` : undefined,
    totalTime: duracion(r.minutos),
    keywords: r.etiquetas?.length ? r.etiquetas.join(', ') : undefined,
    recipeIngredient: r.ingredientes,
    recipeInstructions: r.pasos.map((texto, i) => ({ '@type': 'HowToStep', position: i + 1, text: texto })),
    author: r.autor ? { '@type': 'Person', name: r.autor } : { '@type': 'Organization', name: 'A Mano' },
  };
  // "<" escapado para que el JSON no pueda cerrar la etiqueta <script>.
  return JSON.stringify(datos).replace(/</g, '\\u003c');
}

function contenidoReceta(r) {
  return `<article class="pagina-estatica">
  <h1>${escapar(r.nombre)}</h1>
  ${[CATEGORIAS[r.categoria] || r.categoria, r.origen].filter(Boolean).length ? `<p class="meta">${escapar([CATEGORIAS[r.categoria] || r.categoria, r.origen].filter(Boolean).join(' · '))}</p>` : ''}
  ${r.descripcion ? `<p>${escapar(r.descripcion)}</p>` : ''}
  <h2>Ingredientes</h2>
  <ul>${r.ingredientes.map((i) => `<li>${escapar(i)}</li>`).join('')}</ul>
  <h2>Preparación</h2>
  <ol>${r.pasos.map((p) => `<li>${escapar(p)}</li>`).join('')}</ol>
</article>`;
}

function enlaces(titulo, lista) {
  if (!lista.length) return '';
  return `<nav class="pagina-estatica" aria-label="${escapar(titulo)}"><h2>${escapar(titulo)}</h2><ul>${lista.map(([href, texto]) => `<li><a href="${escapar(href)}">${escapar(texto)}</a></li>`).join('')}</ul></nav>`;
}

function todas() {
  return [...recetasDeLaCasa(), ...indiceDelMundo()];
}

// { titulo, descripcion, imagen, contenido, jsonld, estado, indexar }
async function armar(ruta) {
  const [seccion, ...resto] = ruta.split('/');
  const param = decodeURIComponent(resto.join('/'));

  if (seccion === 'receta' && param) {
    const r = await buscarReceta(idDeRuta(param));
    if (!r) return { estado: 404, titulo: `Receta no encontrada · A Mano`, indexar: false };
    const canonica = rutaReceta(r.id, r.nombre);
    return {
      titulo: `${r.nombre}${r.origen ? ` (${r.origen})` : ''} · Receta · A Mano`,
      descripcion: recortar(r.descripcion || `Receta de ${r.nombre} paso a paso: ${r.ingredientes.length} ingredientes${r.origen ? `, cocina de ${r.origen}` : ''}. Con reemplazos para lo que no se consigue.`),
      imagen: r.imagen,
      canonica,
      contenido: contenidoReceta(r),
      jsonld: datosEstructurados(r, SITIO + canonica),
      indexar: true,
    };
  }
  if (seccion === 'categoria' && param) {
    const nombre = CATEGORIAS[param] || param;
    const lista = todas().filter((r) => r.categoria === param).slice(0, 120);
    if (!lista.length) return { estado: 404, titulo: 'Categoría no encontrada · A Mano', indexar: false };
    return {
      titulo: `Recetas de ${nombre.toLowerCase()} · A Mano`,
      descripcion: `${lista.length} recetas de ${nombre.toLowerCase()} explicadas paso a paso, con Latinoamérica primero.`,
      contenido: `<h1>Recetas de ${escapar(nombre.toLowerCase())}</h1>${enlaces('Recetas', lista.map((r) => [rutaReceta(r.id, r.nombre), r.nombre]))}`,
      indexar: true,
    };
  }
  if (seccion === 'pais' && param) {
    const lista = todas().filter((r) => r.origen === param);
    if (!lista.length) return { estado: 404, titulo: 'País no encontrado · A Mano', indexar: false };
    return {
      titulo: `Recetas de ${param}: comida típica · A Mano`,
      descripcion: `${lista.length} recetas de ${param} explicadas paso a paso, con reemplazos para lo que no se consigue.`,
      contenido: `<h1>Recetas de ${escapar(param)}</h1>${enlaces('Recetas', lista.map((r) => [rutaReceta(r.id, r.nombre), r.nombre]))}`,
      indexar: true,
    };
  }
  const base = SECCIONES[seccion];
  if (!base || resto.length) return { titulo: TITULO, descripcion: DESCRIPCION, indexar: !PRIVADAS.test(ruta) && !ruta };
  let contenido = '';
  if (seccion === '' || seccion === 'casa') {
    contenido = enlaces('Clásicos latinoamericanos', recetasDeLaCasa().map((r) => [rutaReceta(r.id, r.nombre), r.nombre]));
  }
  if (seccion === '' || seccion === 'paises') {
    const paises = [...new Set(todas().map((r) => r.origen).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
    contenido += enlaces('Recetas por país', paises.map((p) => [`/pais/${encodeURIComponent(p)}`, p]));
  }
  return { ...base, contenido, indexar: true };
}

function inyectar(html, p, ruta) {
  const url = SITIO + (p.canonica || `/${encodeURI(ruta)}`);
  const imagen = p.imagen || IMAGEN;
  let salida = html
    .replace(/<title>[^<]*<\/title>/, `<title>${escapar(p.titulo)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${escapar(p.descripcion || DESCRIPCION)}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${escapar(p.titulo)}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${escapar(p.descripcion || DESCRIPCION)}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${escapar(url)}$2`)
    .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${escapar(imagen)}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${escapar(url)}$2`);
  // og:image:width/height describen la imagen general; con una foto de receta no aplican.
  if (p.imagen) salida = salida.replace(/\s*<meta property="og:image:(width|height)" content="\d+" \/>/g, '');
  const extras = [
    !p.indexar && '<meta name="robots" content="noindex" />',
    p.jsonld && `<script type="application/ld+json">${p.jsonld}</script>`,
  ].filter(Boolean).join('\n  ');
  if (extras) salida = salida.replace('</head>', `  ${extras}\n</head>`);
  if (p.contenido) salida = salida.replace('<p class="estado">Cargando…</p>', p.contenido);
  return salida;
}

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://x');
  const ruta = (url.searchParams.get('ruta') || '').replace(/^\/+|\/+$/g, '');
  let html;
  try {
    html = indexHtml();
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('No se pudo cargar la página.');
    return;
  }
  let pagina;
  try {
    pagina = await armar(ruta);
  } catch (err) {
    console.error('pagina:', err);
    pagina = { titulo: TITULO, descripcion: DESCRIPCION, indexar: true };
  }
  res.statusCode = pagina.estado || 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // En el CDN de Vercel un día (se renueva solo en cada deploy); el navegador siempre pregunta.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800');
  res.end(inyectar(html, pagina, ruta));
}
