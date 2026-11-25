#!/usr/bin/env python3
"""Graba el recorrido de un local para Instagram y WhatsApp.

Uso: python3 video.py <slug> [vertical|horizontal]
Si no se pasa, usa "formato" de brief.json, y si no, vertical.
vertical: 1080x1920 (celular). horizontal: 1080x608 (web en compu, 16:9).
Sale en locales/<slug>/salida/<slug>-<formato>.mp4: H.264 high, yuv420p,
30 fps, audio AAC silencioso, faststart. 25 a 35 segundos.
"""
import subprocess, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).resolve().parent / 'motor'))
from recorrido import FORMATOS, RAIZ, Grabador, abrir_local, elegir_formato, recorrido

FPS, MIN_S, MAX_S = 30, 25, 35


def main(slug, formato):
    ancho, alto, escala, sal_w, sal_h = FORMATOS[formato]['video']
    salida = RAIZ / 'locales' / slug / 'salida'
    salida.mkdir(parents=True, exist_ok=True)
    mp4 = salida / f'{slug}-{formato}.mp4'
    ff = subprocess.Popen([
        'ffmpeg', '-y', '-loglevel', 'error',
        '-f', 'image2pipe', '-framerate', str(FPS), '-c:v', 'mjpeg', '-i', '-',
        '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
        '-vf', f'scale={sal_w}:{sal_h}:flags=lanczos,format=yuv420p', '-r', str(FPS),
        '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.1', '-preset', 'slow', '-crf', '19',
        '-g', str(FPS * 2), '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', str(mp4),
    ], stdin=subprocess.PIPE)
    with sync_playwright() as p:
        nav, page = abrir_local(p, slug, ancho, alto, escala)
        g = Grabador(page, FPS, al_cuadro=ff.stdin.write)
        g.preparar()
        recorrido(g)
        if g.segundos() < MIN_S:
            g.esperar(MIN_S - g.segundos())
        nav.close()
    ff.stdin.close()
    ff.wait()
    dur = g.segundos()
    aviso = '' if MIN_S <= dur <= MAX_S else f'  ← fuera de {MIN_S}-{MAX_S} s, ajustar el recorrido'
    print(f'OK {mp4.relative_to(RAIZ)} · {formato} {sal_w}x{sal_h} · {dur:.1f} s{aviso}')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1], elegir_formato(sys.argv[1], sys.argv[2:]))
