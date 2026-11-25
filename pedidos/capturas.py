#!/usr/bin/env python3
"""Saca 4 capturas PNG del local: portada, armador, carta y pedido.

Uso: python3 capturas.py <slug>
Salen en locales/<slug>/salida/ a 1080x2340 (celular 360x780 a 3x).
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).resolve().parent / 'motor'))
from recorrido import RAIZ, Grabador, abrir_local, recorrido

ORDEN = {'portada': 1, 'armador': 2, 'carta': 3, 'pedido': 4}


def main(slug):
    salida = RAIZ / 'locales' / slug / 'salida'
    salida.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        nav, page = abrir_local(p, slug, 360, 780, 3)
        g = Grabador(page, modo='fotos')
        g.preparar()
        hechas = []

        def momento(nombre):
            g.esperar(3)  # que terminen las animaciones de entrada
            if nombre == 'pedido':  # mostrar las líneas y el total, no el formulario
                page.evaluate('() => document.querySelectorAll(".pi-pedido .pi-dlg-cuerpo").forEach(c => c.scrollTop = 0)')
            f = salida / f'{ORDEN[nombre]}-{nombre}.png'
            page.screenshot(path=str(f))
            hechas.append(f.name)

        recorrido(g, momento)
        nav.close()
    print('OK', ', '.join(sorted(hechas)), '→', salida.relative_to(RAIZ))


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1])
