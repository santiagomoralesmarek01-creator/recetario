# Pedidos Interactivos (demos)

Páginas de pedido para locales gastronómicos chicos: el cliente arma el pedido y
le llega al local como un solo mensaje de WhatsApp, sin comisiones. Santi
(San Martín, Buenos Aires) usa estas demos para escribirles a locales que todavía
no son clientes. Esta carpeta no tiene nada que ver con el recetario A Mano y no
se publica (está en `.vercelignore`).

## Estructura
- `motor/core.js`: lógica fija (carga de datos, carrito, armadores, descuentos,
  resumen, WhatsApp). Sin estilos. **No se toca por un local nuevo**: sólo si hay
  un error real, y se arregla ahí para todos.
- `motor/base.css`: estructura neutra de diálogos y formularios. Usa variables `--pi-*`.
- `motor/layouts/<id>/layout.html + layout.css`: composiciones. **No se reescriben por un local.**
  `menu-impreso` · `mosaico` (pide fotos) · `editorial` · `panel` (pedido fijo al costado) ·
  `ticket` (pedido dentro del ticket) · `portada` (pide foto de portada) · `estantes` (filas que se deslizan).
- `motor/recorrido.py`: guion compartido de video y capturas.
- `locales/<slug>/`: `brief.json`, `datos.json`, `estilo.css`, opcional `portada.html`
  (bloque propio, va antes del layout) y `fotos/`.
- `registro.md`: lo usado en cada demo. `mensaje.md`: plantilla de contacto.
- `locales/_prueba/`: local ficticio que usa los 4 armadores. Sirve de ejemplo de formato.

## Flujo por demo nueva
1. Leer `registro.md` (sólo la tabla). Escribir `brief.json` en pocas líneas:
   ```json
   {"local": "qué lo hace propio: barrio, materiales, cómo se ve su Instagram, su carta, su nombre",
    "layout": "id del catálogo",
    "tipografias": [{"familia": "Google Font", "pesos": [400, 700], "uso": "títulos"}, {"familia": "…", "pesos": [400], "uso": "texto"}],
    "colores": [{"hex": "#…", "uso": "fondo", "de_donde": "toldo / logo / packaging…"}],
    "portada": "idea concreta para la portada",
    "memorable": "el único elemento que se recuerda"}
   ```
   Distinto de lo registrado en layout, paleta y tipografías.
2. `datos.json` (formato: ver `locales/_prueba/datos.json`). Lo que no se lee bien va como
   `"sin_verificar": true` en el ítem o `null` en el precio (se muestra "a confirmar").
   **Nunca inventar** precios, platos, horarios ni descuentos. `whatsapp_demo` es un número
   de prueba, nunca el del local. `demo` queda en `true` (cartel "Propuesta de diseño, no oficial").
3. `estilo.css`, idealmente < 150 líneas: variables `--pi-fondo --pi-texto --pi-suave --pi-acento
   --pi-sobre-acento --pi-superficie --pi-linea --pi-titulo --pi-cuerpo --pi-radio` + el elemento memorable.
   `url(fotos/x.jpg)` se embebe sola.
4. `python3 build.py <slug>` → `python3 capturas.py <slug>` → mirar sólo `1-portada.png` y
   `4-pedido.png` → máximo dos rondas de arreglos → `python3 video.py <slug>`.
   Salidas en `locales/<slug>/salida/`.
5. Anotar la fila en `registro.md` y entregar video, capturas y mensaje.

## Armadores (`categorias[].armador`)
- `mitad` (pizza): mitad y mitad entre los ítems de la categoría. `mitad_precio`: `"mayor"` (por defecto) o `"promedio"`.
  Si los ítems traen `variantes` (tamaños) se elige tamaño.
- `capas` (hamburguesas): `variantes` del ítem = medallones; `extras` [{nombre, precio}] y `quitar` [texto] en la categoría.
- `combo` (sushi): `combos` [{piezas, precio, nombre?}], `paso` (piezas por variedad, 5 por defecto); los ítems son las variedades.
- `docena` (empanadas): `docena` {precio_unidad, precio_media, precio_docena}; si falta la unidad se vende por media/docena.
- sin armador: se agrega directo; con `variantes` se elige una.
Descuentos (`descuentos[]`): `porcentaje` + condiciones combinables `pago`, `entrega`, `minimo`, `categoria`
(todas las presentes deben cumplirse; ej. efectivo **y** retiro). `tipo: "info"` sólo muestra el texto.

## Reglas de diseño
- Nada de estilo por defecto: paleta, tipografía y composición salen de lo que el local es.
- Cada demo distinta de las anteriores a simple vista, aun del mismo rubro.
- Un solo elemento memorable, el resto sobrio. Bien en celular, foco visible, sin animaciones
  automáticas salvo una entrada.
- Evitar: títulos con una palabra de otro color, etiquetas en mayúsculas sobre cada sección,
  tarjetas idénticas con la misma sombra, degradados decorativos.

## Ahorro de tokens
- No leer archivos grandes completos (nunca `index.html`): grep o rangos. No imprimir HTML ni base64.
- Por local nuevo sólo se escriben brief, datos y estilo (y `portada.html` si hace falta).
- Respuesta final corta: qué se entregó y qué quedó "sin verificar".

## Contenido
- Sólo información pública. Sin datos personales de dueños ni empleados.
- Una demo con nombre, colores o fotos de un local real **no se publica online**: sólo video o
  archivo. `index.html`, `fotos/` y `salida/` están en `.gitignore` por eso.
- Mensaje de contacto: ver `mensaje.md`. Nunca pedir claves ni datos fiscales. Evitar cadenas.

## Requisitos
Python 3 con `playwright` (`pip install playwright`) y Pillow; `ffmpeg` con libx264.
Usa el Chromium de Playwright, o el de `PI_CHROMIUM` si está definida.
`PI_LAYOUT=<id> python3 build.py <slug>` prueba otro layout sin tocar el brief.
