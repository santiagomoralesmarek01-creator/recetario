#!/usr/bin/env python3
"""Arma locales/<slug>/index.html autocontenido.

Uso: python3 build.py <slug>

Junta motor/base.css + layout elegido en brief.json + estilo.css del local,
embebe tipografías (Google Fonts, sólo subset latin, con caché en .cache/),
fotos (achicadas con Pillow si está) y datos.json, y mete core.js inline.
"""
import base64, json, mimetypes, os, re, sys, urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
CACHE = RAIZ / '.cache' / 'fuentes'
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'


def bajar(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def fuentes(tipos):
    """tipos: [{"familia": "Fraunces", "pesos": [400, 700], "italica": false}]"""
    css_total = []
    CACHE.mkdir(parents=True, exist_ok=True)
    for t in tipos:
        fam = t['familia']
        pesos = sorted(set(t.get('pesos') or [400]))
        if t.get('italica'):
            eje = 'ital,wght@' + ';'.join([f'0,{p}' for p in pesos] + [f'1,{p}' for p in pesos])
        else:
            eje = 'wght@' + ';'.join(map(str, pesos))
        url = f"https://fonts.googleapis.com/css2?family={fam.replace(' ', '+')}:{eje}&display=swap"
        clave = CACHE / (re.sub(r'\W+', '_', fam + eje) + '.css')
        try:
            if not clave.exists():
                css = bajar(url).decode()
                # sólo los bloques latin (incluye ñ y tildes)
                bloques = re.findall(r'/\* latin \*/\s*(@font-face\s*{[^}]*})', css)
                salida = []
                for b in bloques:
                    def embeber(m):
                        f = CACHE / re.sub(r'\W+', '_', m.group(1))[-80:]
                        if not f.exists():
                            f.write_bytes(bajar(m.group(1)))
                        return 'url(data:font/woff2;base64,' + base64.b64encode(f.read_bytes()).decode() + ')'
                    salida.append(re.sub(r'url\((https://[^)]+)\)', embeber, b))
                clave.write_text('\n'.join(salida))
            css_total.append(clave.read_text())
        except Exception as e:  # sin red: queda la fuente de respaldo del estilo
            print(f'  aviso: no pude bajar la tipografía {fam}: {e}')
    return '\n'.join(css_total)


def data_uri(ruta, ancho_max=1000):
    if not ruta.exists():
        print(f'  aviso: falta la imagen {ruta.name}')
        return None
    mime = mimetypes.guess_type(ruta.name)[0] or 'image/jpeg'
    datos = ruta.read_bytes()
    if mime != 'image/svg+xml':
        try:
            from PIL import Image
            import io
            im = Image.open(ruta)
            if im.width > ancho_max:
                im = im.resize((ancho_max, round(im.height * ancho_max / im.width)), Image.LANCZOS)
            buf = io.BytesIO()
            if im.mode in ('RGBA', 'LA', 'P') and mime == 'image/png':
                im.save(buf, 'PNG', optimize=True)
            else:
                im.convert('RGB').save(buf, 'JPEG', quality=80, optimize=True, progressive=True)
                mime = 'image/jpeg'
            datos = buf.getvalue()
        except ImportError:
            pass
    return f'data:{mime};base64,' + base64.b64encode(datos).decode()


def armar(slug):
    dir_local = RAIZ / 'locales' / slug
    brief = json.loads((dir_local / 'brief.json').read_text())
    datos = json.loads((dir_local / 'datos.json').read_text())
    layout = os.environ.get('PI_LAYOUT') or brief['layout']  # PI_LAYOUT sólo para probar
    dir_layout = RAIZ / 'motor' / 'layouts' / layout
    if not dir_layout.exists():
        sys.exit(f'No existe el layout "{layout}". Opciones: ' + ', '.join(p.name for p in (RAIZ / 'motor' / 'layouts').iterdir()))

    # imágenes del JSON
    for clave, ancho in (('logo', 500), ('portada', 1600)):
        if datos.get(clave) and not datos[clave].startswith('data:'):
            datos[clave] = data_uri(dir_local / datos[clave], ancho)
    for cat in datos.get('categorias', []):
        for it in cat.get('items', []):
            if it.get('foto') and not it['foto'].startswith('data:'):
                it['foto'] = data_uri(dir_local / it['foto'], 900)

    estilo = (dir_local / 'estilo.css').read_text() if (dir_local / 'estilo.css').exists() else ''
    # url(fotos/...) dentro del estilo
    estilo = re.sub(r'url\(["\']?((?!data:|https?:)[^)"\']+)["\']?\)',
                    lambda m: f'url({data_uri(dir_local / m.group(1), 1600) or m.group(1)})', estilo)
    portada_html = (dir_local / 'portada.html').read_text() if (dir_local / 'portada.html').exists() else ''

    cuerpo = (dir_layout / 'layout.html').read_text()
    if portada_html:  # bloque de portada propio del local, va antes del layout
        cuerpo = portada_html + '\n' + cuerpo
    datos_js = json.dumps(datos, ensure_ascii=False).replace('</', '<\\/')
    core = (RAIZ / 'motor' / 'core.js').read_text()

    html = f'''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>{datos['nombre']} · Pedidos</title>
<style>{fuentes(brief.get('tipografias', []))}</style>
<style>{(RAIZ / 'motor' / 'base.css').read_text()}</style>
<style>{(dir_layout / 'layout.css').read_text()}</style>
<style>{estilo}</style>
</head>
<body data-layout="{layout}">
{cuerpo}
<script>window.PI_DATOS = {datos_js};</script>
<script type="module">{core}</script>
</body>
</html>
'''
    salida = dir_local / 'index.html'
    salida.write_text(html)
    print(f'OK {salida.relative_to(RAIZ)} · layout {layout} · {len(html) / 1024:.0f} KB')
    return salida


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    armar(sys.argv[1])
