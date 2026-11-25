#!/usr/bin/env python3
"""Graba el recorrido de un local para Instagram y WhatsApp.

Uso: python3 video.py <slug>
Sale en locales/<slug>/salida/<slug>.mp4: 1080x1920, H.264 high, yuv420p,
30 fps, audio AAC silencioso, faststart. 25 a 35 segundos.
"""
import subprocess, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).resolve().parent / 'motor'))
from recorrido import RAIZ, Grabador, abrir_local, recorrido

FPS, MIN_S, MAX_S = 30, 25, 35


def main(slug):
    salida = RAIZ / 'locales' / slug / 'salida'
    salida.mkdir(parents=True, exist_ok=True)
    mp4 = salida / f'{slug}.mp4'
    ff = subprocess.Popen([
        'ffmpeg', '-y', '-loglevel', 'error',
        '-f', 'image2pipe', '-framerate', str(FPS), '-c:v', 'mjpeg', '-i', '-',
        '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
        '-vf', 'scale=1080:1920:flags=lanczos,format=yuv420p', '-r', str(FPS),
        '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.1', '-preset', 'slow', '-crf', '19',
        '-g', str(FPS * 2), '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', str(mp4),
    ], stdin=subprocess.PIPE)
    with sync_playwright() as p:
        nav, page = abrir_local(p, slug, 360, 640, 3)
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
    print(f'OK {mp4.relative_to(RAIZ)} · {dur:.1f} s{aviso}')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1])
