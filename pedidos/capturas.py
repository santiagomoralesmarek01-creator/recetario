#!/usr/bin/env python3
"""Saca 4 capturas PNG del local: portada, armador, carta y pedido.

Uso: python3 capturas.py <slug> [vertical|horizontal]
Mismo criterio de formato que video.py.
vertical: 1080x2340 (celular). horizontal: 2880x1800 (compu 1440x900 a 2x).
Salen en locales/<slug>/salida/<formato>-N-nombre.png
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).resolve().parent / 'motor'))
from recorrido import FORMATOS, RAIZ, Grabador, abrir_local, elegir_formato, recorrido

ORDEN = {'portada': 1, 'armador': 2, 'carta': 3, 'pedido': 4}


def main(slug, formato):
    ancho, alto, escala = FORMATOS[formato]['fotos']
    salida = RAIZ / 'locales' / slug / 'salida'
    salida.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        nav, page = abrir_local(p, slug, ancho, alto, escala)
        g = Grabador(page, modo='fotos')
        g.preparar()
        hechas = []

        def momento(nombre):
            g.esperar(3)  # que terminen las animaciones de entrada
            if nombre == 'pedido':  # mostrar las líneas y el total, no el formulario
                page.evaluate('() => document.querySelectorAll(".pi-pedido .pi-dlg-cuerpo").forEach(c => c.scrollTop = 0)')
            f = salida / f'{formato}-{ORDEN[nombre]}-{nombre}.png'
            page.screenshot(path=str(f))
            hechas.append(f.name)

        recorrido(g, momento)
        nav.close()
    print('OK', ', '.join(sorted(hechas)), '→', salida.relative_to(RAIZ))


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1], elegir_formato(sys.argv[1], sys.argv[2:]))
