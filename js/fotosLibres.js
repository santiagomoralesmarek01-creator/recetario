// Búsqueda de fotos con licencia libre para las recetas (sólo administradores):
// Wikimedia Commons y Openverse (Flickr y otros bancos con licencias Creative
// Commons que permiten uso comercial). Las dos APIs aceptan pedidos desde el
// navegador. Cada resultado trae lo necesario para dar el crédito.

// { id, miniatura, url, autor, licencia, fuente, pagina }
const sinHtml = (s) => new DOMParser().parseFromString(String(s || ''), 'text/html').body.textContent.trim().replace(/\s+/g, ' ');

async function deCommons(consulta) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', origin: '*',
    generator: 'search', gsrnamespace: '6', gsrsearch: `${consulta} filetype:bitmap`, gsrlimit: '24',
    prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '400', iiextmetadatafilter: 'Artist|LicenseShortName',
  });
  const r = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`Commons ${r.status}`);
  const datos = await r.json();
  return Object.values(datos.query?.pages || {})
    .sort((a, b) => (a.index || 0) - (b.index || 0))
    .filter((p) => p.imageinfo?.[0]?.thumburl)
    .map((p) => {
      const info = p.imageinfo[0];
      const archivo = p.title.replace(/^File:/, '').replace(/ /g, '_');
      const meta = info.extmetadata || {};
      return {
        id: `commons:${archivo}`,
        miniatura: info.thumburl,
        url: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(archivo)}?width=800`,
        autor: sinHtml(meta.Artist?.value).slice(0, 80),
        licencia: sinHtml(meta.LicenseShortName?.value),
        fuente: 'Wikimedia Commons',
        // Enlace corto a la página del archivo (el crédito tiene 200 caracteres como máximo).
        pagina: `https://commons.wikimedia.org/?curid=${p.pageid}`,
      };
    });
}

const LICENCIAS = { cc0: 'CC0', pdm: 'Dominio público', by: 'CC BY', 'by-sa': 'CC BY-SA' };

async function deOpenverse(consulta) {
  const params = new URLSearchParams({ q: consulta, license: 'cc0,pdm,by,by-sa', page_size: '20', mature: 'false' });
  const r = await fetch(`https://api.openverse.org/v1/images/?${params}`, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`Openverse ${r.status}`);
  const datos = await r.json();
  return (datos.results || []).filter((f) => f.url && LICENCIAS[f.license]).map((f) => ({
    id: `openverse:${f.id}`,
    miniatura: f.thumbnail || f.url,
    url: f.url,
    autor: sinHtml(f.creator).slice(0, 80),
    licencia: `${LICENCIAS[f.license]}${f.license_version && !['cc0', 'pdm'].includes(f.license) ? ` ${f.license_version}` : ''}`,
    fuente: f.source === 'flickr' ? 'Flickr' : (f.provider || f.source || 'Openverse'),
    pagina: f.foreign_landing_url || '',
  }));
}

// Busca en las dos fuentes a la vez; si una falla, se muestran las de la otra.
export async function buscarFotosLibres(consulta) {
  const [commons, openverse] = await Promise.allSettled([deCommons(consulta), deOpenverse(consulta)]);
  const lista = [
    ...(commons.status === 'fulfilled' ? commons.value : []),
    ...(openverse.status === 'fulfilled' ? openverse.value : []),
  ];
  if (!lista.length && commons.status === 'rejected' && openverse.status === 'rejected') {
    throw new Error('No se pudo buscar. Probá de nuevo en un rato.');
  }
  return lista;
}

// "Foto: Ana Pérez · CC BY-SA 4.0 · Wikimedia Commons https://…": el enlace
// final se muestra como link en la receta (ver aplicarFotos en fotos.js).
export function creditoDe(foto) {
  const enlace = foto.pagina && foto.pagina.length <= 120 ? ` ${foto.pagina}` : '';
  const texto = [foto.autor && `Foto: ${foto.autor}`, foto.licencia, foto.fuente].filter(Boolean).join(' · ');
  return texto.slice(0, 200 - enlace.length) + enlace;
}
