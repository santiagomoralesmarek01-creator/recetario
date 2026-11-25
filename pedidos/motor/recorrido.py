"""Recorrido común para video.py y capturas.py.

Maneja el navegador cuadro por cuadro: el tiempo de las animaciones, el scroll
y el cursor los mueve este script, así el video sale parejo aunque la
máquina sea lenta. Se apoya sólo en los ganchos de core.js (data-pi*).
"""
import json, os, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent

INIT_JS = r"""
window.PI_SIN_MEMORIA = true;
window.__pi = { t: 0, inicio: 0 };
window.__piTick = (t) => {
  __pi.t = t;
  for (const a of document.getAnimations()) {
    if (a.__t0 === undefined) a.__t0 = Math.max(t, __pi.inicio);
    a.pause();
    a.currentTime = Math.max(0, t - a.__t0);
  }
};
document.addEventListener('pi:enviar', (e) => {
  e.preventDefault();
  const w = document.createElement('div');
  w.id = '__wa'; w.popover = 'manual';
  w.innerHTML = `<div class="__wa-cab"><b></b><small>en línea</small></div><div class="__wa-chat"><pre></pre></div>`;
  w.querySelector('b').textContent = window.PI.datos.nombre;
  w.querySelector('pre').textContent = e.detail.mensaje;
  document.body.append(w); w.showPopover();
  window.__piCursorArriba?.();
});
"""

ESTILO_GRAB = """
html { scroll-behavior: auto !important; }
#__cursor { position: fixed; inset: 0 auto auto 0; margin: 0; padding: 0; border: 2px solid #fff; width: 30px; height: 30px;
  border-radius: 50%; background: rgba(15,15,15,.38); box-shadow: 0 0 0 1px rgba(0,0,0,.4), 0 2px 6px rgba(0,0,0,.3);
  pointer-events: none; overflow: visible; translate: -15px -15px; }
#__titulo { position: fixed; inset: 0; width: 100%; height: 100%; max-width: none; max-height: none; margin: 0; border: 0;
  display: grid; place-content: center; text-align: center; gap: .9rem; padding: 2rem;
  background: var(--pi-acento); color: var(--pi-sobre-acento); }
#__titulo h1 { font: 700 2.6rem/1.05 var(--pi-titulo); margin: 0; }
#__titulo p { font: 1rem/1.4 var(--pi-cuerpo); margin: 0; opacity: .85; }
#__wa { position: fixed; inset: 0; width: 100%; height: 100%; max-width: none; max-height: none; margin: 0; border: 0; padding: 0;
  background: #efe7de; display: flex; flex-direction: column; font-family: system-ui, sans-serif; }
#__wa .__wa-cab { background: #075e54; color: #fff; padding: 1rem 1.1rem; display: grid; }
#__wa .__wa-cab small { opacity: .8; }
#__wa .__wa-chat { padding: 1rem; overflow: hidden; flex: 1; display: flex; flex-direction: column; justify-content: flex-end; }
#__wa pre { align-self: flex-end; max-width: 88%; margin: 0; white-space: pre-wrap; font: .86rem/1.4 system-ui, sans-serif;
  background: #d9fdd3; color: #111; padding: .7rem .8rem; border-radius: .6rem 0 .6rem .6rem; box-shadow: 0 1px 0 rgba(0,0,0,.12); }
"""


def lanzar(p):
    ruta = os.environ.get('PI_CHROMIUM') or ('/opt/pw-browsers/chromium' if Path('/opt/pw-browsers/chromium').exists() else None)
    return p.chromium.launch(executable_path=ruta) if ruta else p.chromium.launch()


def ease(x):
    return 4 * x ** 3 if x < .5 else 1 - (-2 * x + 2) ** 3 / 2


class Grabador:
    """modo 'video': cada paso genera cuadros. modo 'fotos': pasos instantáneos."""

    def __init__(self, page, fps=30, al_cuadro=None, modo='video'):
        self.page, self.fps, self.al_cuadro, self.modo = page, fps, al_cuadro, modo
        self.t = 0.0  # ms virtuales
        self.n = 0
        self.cx, self.cy = 300, 520
        self.escala = 1.0

    # ---------- base ----------
    def cuadro(self):
        self.page.evaluate('([t, x, y, s]) => { __piTick(t); const c = document.getElementById("__cursor"); if (c) c.style.transform = `translate(${x}px, ${y}px) scale(${s})`; }',
                           [self.t, self.cx, self.cy, self.escala])
        if self.modo == 'video' and self.al_cuadro:
            self.al_cuadro(self.page.screenshot(type='jpeg', quality=90))
        self.n += 1
        self.t += 1000 / self.fps

    def cuadros(self, seg):
        return max(1, round(seg * self.fps)) if self.modo == 'video' else 1

    def esperar(self, seg):
        if self.modo != 'video':
            self.t += seg * 1000
            self.page.evaluate('t => __piTick(t)', self.t)
            return
        for _ in range(self.cuadros(seg)):
            self.cuadro()

    def segundos(self):
        return self.n / self.fps

    # ---------- preparación ----------
    def preparar(self):
        self.page.add_style_tag(content=ESTILO_GRAB)
        self.page.evaluate('() => document.fonts.ready')
        if self.modo == 'video':
            self.page.evaluate("""() => {
              const c = document.createElement('div'); c.id = '__cursor'; c.popover = 'manual';
              document.body.append(c); c.showPopover();
              window.__piCursorArriba = () => { c.hidePopover(); c.showPopover(); };
            }""")

    def titulo(self, nombre, bajada, seg=2.6):
        self.page.evaluate("""([n, b]) => { const t = document.createElement('div'); t.id = '__titulo'; t.popover = 'manual';
            t.innerHTML = '<h1></h1><p></p>'; t.querySelector('h1').textContent = n; t.querySelector('p').textContent = b;
            document.body.append(t); t.showPopover(); window.__piCursorArriba?.(); }""", [nombre, bajada])
        fundido = .6
        self.page.evaluate('t => { __pi.inicio = t; }', self.t + (seg - fundido) * 1000)
        self.esperar(seg - fundido)
        k = self.cuadros(fundido)
        for i in range(k):
            self.page.evaluate('o => { const t = document.getElementById("__titulo"); t.style.opacity = o; t.style.transform = `scale(${1 + (1 - o) * .04})`; }', 1 - ease((i + 1) / k))
            self.cuadro()
        self.page.evaluate('() => document.getElementById("__titulo").remove()')

    # ---------- cursor y clics ----------
    def mover(self, x, y, seg=.55):
        x0, y0 = self.cx, self.cy
        k = self.cuadros(seg)
        for i in range(k):
            e = ease((i + 1) / k)
            self.cx, self.cy = x0 + (x - x0) * e, y0 + (y - y0) * e
            self.cuadro()

    def caja(self, sel):
        return self.page.evaluate("""s => { const e = typeof s === 'string' ? document.querySelector(s) : s;
            if (!e) return null; const r = e.getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2, h: r.height, top: r.top}; }""", sel)

    def visible(self, sel, seg=.9, margen=.42):
        """Scroll suave (de la página o del diálogo abierto) hasta que sel quede a la vista."""
        info = self.page.evaluate("""([s, m]) => { const e = document.querySelector(s); if (!e) return null;
            const cont = e.closest('.pi-dlg-cuerpo') && e.closest('dialog[open]') ? e.closest('.pi-dlg-cuerpo') : document.scrollingElement;
            const r = e.getBoundingClientRect(); const vh = cont === document.scrollingElement ? innerHeight : cont.clientHeight;
            const top = cont === document.scrollingElement ? r.top : r.top - cont.getBoundingClientRect().top;
            if (top > vh * .12 && top + r.height < vh * .82) return {cont: null};
            const max = cont.scrollHeight - cont.clientHeight;
            const dest = Math.max(0, Math.min(max, cont.scrollTop + top - vh * m));
            window.__piCont = cont; return {cont: 1, desde: cont.scrollTop, hasta: dest}; }""", [sel, margen])
        if not info or not info['cont'] or abs(info['hasta'] - info['desde']) < 4:
            return
        k = self.cuadros(seg)
        for i in range(k):
            y = info['desde'] + (info['hasta'] - info['desde']) * ease((i + 1) / k)
            self.page.evaluate('y => { __piCont.scrollTop = y; }', y)
            self.cuadro()

    def deslizar(self, px, seg=1.2):
        """Scroll suave de la página una cantidad de px (para mostrar la carta)."""
        y0 = self.page.evaluate('() => scrollY')
        k = self.cuadros(seg)
        for i in range(k):
            self.page.evaluate('y => scrollTo(0, y)', y0 + px * ease((i + 1) / k))
            self.cuadro()

    def clic(self, sel, mover=.5):
        self.visible(sel)
        c = self.caja(sel)
        if not c:
            print(f'  aviso: no encontré {sel}')
            return False
        self.mover(c['x'], c['y'], mover)
        for s in (.85, .78, .78):
            self.escala = s
            self.cuadro()
        self.page.mouse.click(c['x'], c['y'])  # clic real: no dispara el anillo de foco de teclado
        self.page.evaluate('() => window.__piCursorArriba?.()')
        for s in (.88, .96, 1):
            self.escala = s
            self.cuadro()
        return True

    def escribir(self, sel, texto, cps=9):
        self.clic(sel)
        for i in range(1, len(texto) + 1):
            self.page.evaluate("""([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', {bubbles: true})); }""", [sel, texto[:i]])
            self.esperar(1 / cps)


# ---------- guion ----------
def recorrido(g, momento=lambda nombre: None):
    d = g.page.evaluate('() => window.PI.datos')
    cats = d['categorias']
    principal = next((c for c in cats if c.get('armador') in ('mitad', 'combo', 'docena', 'capas')), None)

    g.titulo(d['nombre'], d.get('bajada_video') or 'Pedidos por WhatsApp, sin comisiones')
    g.esperar(1.3)
    momento('portada')
    g.deslizar(min(520, g.page.evaluate('() => document.querySelector("[data-pi=carta]").getBoundingClientRect().top - 60')), 1.4)
    g.esperar(.5)
    momento('carta')

    # 1) el armador del rubro
    if principal:
        sel_cat = f'#cat-{principal["id"]}'
        if principal['armador'] == 'capas':
            g.clic(f'{sel_cat} .pi-plato .pi-agregar')
        else:
            g.clic(f'{sel_cat} [data-pi-accion=armar]')
        g.esperar(.6)
        tipo = g.page.evaluate('() => document.querySelector("dialog[open]")?.dataset.armador')
        completar_armador(g, tipo)
        momento('armador')
        g.clic('dialog[open] [data-pi-confirmar]')
        g.esperar(.5)

    # 2) un plato simple de otra categoría
    simple = g.page.evaluate("""(pid) => { const bs = [...document.querySelectorAll('.pi-seccion .pi-agregar')]
        .filter(b => b.textContent === 'Agregar' && /[$]/.test(b.closest('.pi-plato').querySelector('.pi-precio')?.textContent || '')
          && !/desde/.test(b.closest('.pi-plato').textContent));
        const otro = bs.find(b => b.closest('.pi-seccion').dataset.cat !== pid) || bs[0];
        if (!otro) return null; otro.id ||= '__simple'; return '#' + otro.id; }""", principal['id'] if principal else '')
    if simple:
        g.clic(simple)
        g.esperar(.6)

    # 3) el pedido
    es_dialogo = g.page.evaluate('() => !document.querySelector("[data-pi=pedido]") || document.querySelector("[data-pi=pedido]").tagName === "DIALOG"')
    if es_dialogo:
        g.clic('[data-pi-abrir-pedido]')
    else:
        g.visible('[data-pi="pedido"]', 1.4, .08)
    g.esperar(.5)
    raiz = 'dialog[open]' if es_dialogo else '[data-pi="pedido"]'
    g.escribir(f'{raiz} [data-pi-campo=nombre]', 'Sofi')
    entrega = g.page.evaluate("""(r) => { const i = [...document.querySelectorAll(r + ' input[data-pi-op=entrega]')];
        const e = i.find(x => !/env|domic|deliv/i.test(x.value)) || i[0]; return e ? e.value : null; }""", raiz)
    if entrega:
        g.clic(f'{raiz} input[data-pi-op=entrega][value="{entrega}"]')
    pago = g.page.evaluate("""([r, d]) => { const i = [...document.querySelectorAll(r + ' input[data-pi-op=pago]')];
        const con = (d.descuentos || []).find(x => x.tipo === 'pago'); const e = (con && i.find(x => x.value === con.pago)) || i[0];
        return e ? e.value : null; }""", [raiz, d])
    if pago:
        g.clic(f'{raiz} input[data-pi-op=pago][value="{pago}"]')
    g.esperar(.3)
    momento('pedido')
    g.visible(f'{raiz} .pi-mensaje', 1.1, .25)
    g.esperar(1.6)
    g.clic(f'{raiz} [data-pi-enviar]')
    g.esperar(2.6)


def completar_armador(g, tipo):
    R = 'dialog[open]'
    if tipo == 'mitad':
        g.clic(f'{R} input[name=mitadA][value="0"]')
        n = g.page.evaluate(f'() => document.querySelectorAll("{R} input[name=mitadB]").length')
        g.clic(f'{R} input[name=mitadB][value="{min(2, n - 1)}"]')
    elif tipo == 'capas':
        if g.page.evaluate(f'() => !!document.querySelector("{R} input[name=capa]")'):
            g.clic(f'{R} input[name=capa][value="1"]')
        for v in (0, 1):
            if g.page.evaluate(f'() => !!document.querySelector(\'{R} input[name=extra][value="{v}"]\')'):
                g.clic(f'{R} input[name=extra][value="{v}"]', .4)
    elif tipo in ('combo', 'docena'):
        botones = g.page.evaluate(f'() => document.querySelectorAll("{R} [data-pi-mas]").length')
        i = 0
        while i < 14 and g.page.evaluate(f'() => document.querySelector("{R} [data-pi-confirmar]").disabled'):
            j = (i % min(botones, 4)) + 1
            g.clic(f'{R} .pi-cont:nth-child({j + 1}) [data-pi-mas]', .35 if i else .5)
            i += 1
    g.visible(f'{R} [data-pi-confirmar]', .6)


def abrir_local(p, slug, ancho, alto, escala):
    html = RAIZ / 'locales' / slug / 'index.html'
    if not html.exists():
        raise SystemExit(f'Falta {html}. Corré antes: python3 build.py {slug}')
    nav = lanzar(p)
    page = nav.new_page(viewport={'width': ancho, 'height': alto}, device_scale_factor=escala, has_touch=False, reduced_motion='no-preference')
    page.add_init_script(INIT_JS)
    page.goto(html.as_uri())
    page.wait_for_function('() => window.PI && document.querySelector(".pi-plato")')
    return nav, page
