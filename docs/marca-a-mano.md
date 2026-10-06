# A Mano: identidad de marca (documento de traspaso)

Este archivo reúne todas las decisiones de marca tomadas para la web de recetas (antes "Recetario", publicada en recetario-virid.vercel.app). Sirve como contexto para implementarlas en el código. Guardarlo en el repo como `docs/marca-a-mano.md` y referenciarlo desde `CLAUDE.md`.

## Cómo trabajar (instrucciones para Claude Code)

1. **Leer primero** `css/estilos.css` (bloque `:root` y modo oscuro), el HTML principal y `js/` antes de cambiar nada.
2. **Mapear** las variables CSS actuales a las nuevas y mostrar el mapeo antes de aplicarlo.
3. **Cambiar por fases** (orden en la sección "Plan de implementación"). No mezclar nombre, colores, textos, íconos e IA en un mismo cambio.
4. **No renombrar el proyecto de Vercel ni la URL** sin preguntar.
5. **No tocar las 850 recetas** ni sus fotos. Solo interfaz.
6. Si algo no está definido acá, preguntar en lugar de inventar.

## Estado de las decisiones

| Elemento | Decisión | Estado |
|---|---|---|
| Nombre | **A Mano** (wordmark en minúsculas: "a mano") | Elegido, **sin verificar** disponibilidad |
| Promesa | **Con lo que hay, alcanza.** | Cerrada |
| Descriptor (buscadores y tiendas) | Cocina latinoamericana a tu medida | Propuesto |
| Asistente de IA | **Manitas** | Provisorio, sin verificar |
| Trato al usuario | Neutro por defecto + selector Neutro / Vos / Tú | Cerrado |
| Tipografías | Bricolage Grotesque (títulos), DM Sans (texto), Fraunces cursiva (solo citas cortas) | Propuesto, probar en pantalla real |
| Logo | Dirección A: la "a" minúscula cuyo bucle se abre como una palma | Propuesto, a dibujar |
| Niveles | 5 niveles, medallas como sello circular | Propuesto |
| IA dentro de cada receta | Además del chat | Propuesto (cambio de producto) |

**Pendiente de verificar (no se comprobó nada):** dominios, usuarios de redes, marcas (INPI, OMPI, TMview), apps con el mismo nombre (App Store, Google Play), resultados de Google para "a mano cocina" y "manitas cocina", y significados regionales del nombre y del asistente (consultar personas de México, Colombia, Chile, Perú y España).

## Concepto

- **Producto:** cocinar con lo que tenés, donde estés. Cocina latinoamericana que se adapta al país, a la heladera y al nivel de cada persona.
- **Diferencial real:** dificultad según lo que se consigue en cada país, con reemplazos.
- **Potenciales:** variantes por país de un mismo plato y vocabulario regional (palta/aguacate, choclo/elote), ritual diario (Plato del día), IA que adapta recetas.
- **Posicionamiento:** la cocina latinoamericana que se adapta a tu país y a tu heladera.
- **Arquetipo:** Amigo de barrio (principal), Bromista en dosis chicas (solo juegos y errores).
- **La marca ES:** una amiga que cocina bien y te dice "no tenés X, usá Y". Un puente entre países.
- **La marca NO ES:** un restaurante, una revista gourmet, una startup fría, un juego infantil ni un manual argentino.

## Paleta

Los contrastes marcados con ✔ fueron calculados (WCAG). El resto debe verificarse (WebAIM Contrast Checker).

### Modo claro

| Rol | Variable | HEX | Contraste |
|---|---|---|---|
| Principal (Ají) | `--aji` | `#C8401F` | ✔ blanco encima 4.99; sobre fondo 4.63 |
| Secundario (Hierba) | `--hierba` | `#1F4D3A` | ✔ blanco encima 9.63 |
| Acento (Maíz) | `--maiz` | `#F2B632` | ✔ texto oscuro encima 9.47 |
| Fondo | `--fondo` | `#FBF6EC` | |
| Fondo 2 | `--fondo-2` | `#F3EADB` | |
| Superficie | `--superficie` | `#FFFFFF` | |
| Texto | `--texto` | `#1E1A17` | ✔ 16.04 |
| Texto suave | `--texto-suave` | `#5E554D` | ✔ 6.76 |
| Borde | `--borde` | `#E5D9C5` | decorativo |
| Éxito | `--exito` | `#2F7D4F` | ✔ 4.68 |
| Error | `--error` | `#B3261E` | ✔ 6.07 |
| Aviso (texto) | `--aviso` | `#8A5A00` | ✔ 5.5 |
| Info | `--info` | `#2A6F97` | ✔ 5.1 |

Sin verificar: `--aji-suave #F8E1D8`, `--hierba-suave #DCEBE2`, `--aviso-fondo #FCEFD0` (fondos con texto oscuro).

### Modo oscuro

| Rol | HEX | Contraste |
|---|---|---|
| Fondo / superficie | `#16130F` / `#211C17` | |
| Texto / texto suave | `#F5EEE3` / `#B8AB9C` | ✔ 16.07 / 8.24 |
| Ají claro | `#F0764F` | ✔ 6.53 (botón con texto `#16130F`, no blanco) |
| Hierba clara | `#7BC29A` | ✔ 8.84 |
| Maíz | `#F2B632` | ✔ 10.15 |
| Borde | `#3A322A` | sin verificar |

### Reglas de color

- **Ají = acción. Hierba = estructura y marca. Maíz = premio.**
- El Maíz **nunca** lleva texto blanco ni se usa como color de texto sobre crema. Solo en medallas, rachas y logros.
- El Ají sobre crema (4.63) está al límite: no usarlo en texto chico ni sobre grises.
- Éxito y Hierba son ambos verdes: el Éxito siempre lleva ícono de tilde.
- Dificultad siempre con texto, nunca solo color.

## CSS propuesto

Nombres de variables **sin acentos** (`--aji`, `--maiz`) para evitar problemas de compatibilidad.

```css
:root {
  --aji: #C8401F;
  --aji-suave: #F8E1D8;
  --hierba: #1F4D3A;
  --hierba-suave: #DCEBE2;
  --maiz: #F2B632;

  --fondo: #FBF6EC;
  --fondo-2: #F3EADB;
  --superficie: #FFFFFF;
  --texto: #1E1A17;
  --texto-suave: #5E554D;
  --borde: #E5D9C5;

  --exito: #2F7D4F;
  --error: #B3261E;
  --aviso: #8A5A00;
  --aviso-fondo: #FCEFD0;
  --info: #2A6F97;

  --radio: 18px;
  --radio-boton: 14px;
  --fuente-titulos: 'Bricolage Grotesque', system-ui, sans-serif;
  --fuente-texto: 'DM Sans', system-ui, sans-serif;
  --fuente-detalle: 'Fraunces', Georgia, serif;
}

[data-tema="oscuro"] {
  --aji: #F0764F;
  --hierba: #7BC29A;
  --maiz: #F2B632;
  --fondo: #16130F;
  --fondo-2: #211C17;
  --superficie: #211C17;
  --texto: #F5EEE3;
  --texto-suave: #B8AB9C;
  --borde: #3A322A;
}

h1, h2, h3 { font-family: var(--fuente-titulos); font-weight: 700; line-height: 1.15; }
body { font-family: var(--fuente-texto); font-size: 16px; line-height: 1.55; }
.paso-cocina { font-size: 20px; }
```

`<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
<meta name="theme-color" content="#C8401F">
```

Adaptar el selector del modo oscuro al mecanismo real que usa el sitio.

## Tipografía: tamaños (móvil / escritorio)

H1 28 / 40 px · H2 22 / 28 · H3 18 / 20 · texto 16 / 17 · **pasos del modo cocina 20 px mínimo** · metadatos 13 / 14 (nunca menos).

## Logo y archivos

- Wordmark "a mano" en Bricolage Grotesque Bold: Ají sobre crema, blanco sobre Hierba.
- Isotipo: la "a" sola; en la app, dentro de un cuadrado redondeado en Ají.
- Mínimos: wordmark 80 px de ancho, isotipo 16 px. Zona de respeto: el alto de la "a".
- Sistema visual: tres formas (círculo, arco, punto). Si un elemento nuevo no usa ninguna, revisar.
- Probar la "a" a 16 px, en blanco y negro y en recorte circular. Si no se lee, simplificar.

Archivos en `img/`: `logo.svg`, `logo-blanco.svg`, `isotipo.svg`, `favicon.svg`, `favicon.ico` (32×32), `apple-touch-icon.png` (180×180), `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `og-image.png` (1200×630), carpeta `medallas/` y carpeta `iconos/`.

## Componentes

- **Botón principal:** Ají, texto blanco, radio 14 px, al presionar se hunde 2 px. En modo oscuro, texto `#16130F`.
- **Botón secundario:** contorno Hierba 2 px, texto Hierba, fondo transparente.
- **Card de receta:** fondo blanco, borde `--borde`, radio 18 px, foto 4:3 arriba, etiqueta de país abajo a la izquierda.
- **Badge de dificultad:** píldora con punto de color y texto (fácil = Éxito, intermedia = Aviso, difícil = Ají).
- **Badge de reemplazo:** píldora Hierba suave con ícono de intercambio (función propia de la marca).
- **Patrón:** puntos y arcos en crema oscuro, solo fondos y estados vacíos.
- **Íconos:** línea, trazo 2 px, extremos y esquinas redondeadas, cuadrícula de 24 px. Base Lucide o Phosphor, más 8 a 10 propios (reemplazo, ingrediente, modo cocina, país, dificultad, medalla, guardada, Manitas).
- **Emojis:** fuera de la interfaz. Solo en contenido de la comunidad y redes, máximo uno por mensaje.
- **"Del mundo":** no retocar las fotos; unificar con un marco visual uniforme (proporción y esquinas iguales).

## Voz y textos

- **Personalidad:** amiga que cocina bien y no se cree por eso. Explica sin dar cátedra, se ríe con vos y nunca de vos.
- **Regla de oro:** cuanto más riesgo o urgencia (fuego, cuchillo, tiempo), menos personalidad y más claridad. Cero humor en pasos críticos.
- **Neutro por defecto:** evitar verbos marcadores de región. Usar infinitivos o primera persona plural ("Cocinemos", "Dejar reposar 5 minutos").
- **Regionalismos:** aparecen como contenido cultural ("¿cómo le dicen al choclo en tu país?"), no como tono.
- Palabras gastronómicas con variante local entre paréntesis cuando importe: "palta (aguacate)".

### Selector Neutro / Vos / Tú

Textos de interfaz en un archivo con tres variantes. Preferencia guardada en Supabase (usuario registrado) o `localStorage` (visitante).

```js
// js/textos.js
const TEXTOS = {
  "buscar.titulo":  { neutro: "¿Qué hay a mano hoy?", vos: "¿Qué tenés a mano hoy?", tu: "¿Qué tienes a mano hoy?" },
  "cocina.reposar": { neutro: "Dejar reposar 5 minutos.", vos: "Dejá reposar 5 minutos.", tu: "Deja reposar 5 minutos." },
  "reemplazo.cta":  { neutro: "Buscar un reemplazo", vos: "Buscá un reemplazo", tu: "Busca un reemplazo" }
};
function t(clave) {
  const modo = localStorage.getItem("trato") || "neutro";
  return (TEXTOS[clave] && TEXTOS[clave][modo]) || TEXTOS[clave]?.neutro || clave;
}
```

Empezar con 40 a 60 textos de interfaz visibles. Las recetas no se tocan.

### Cambios de texto

| Dónde | Cambio |
|---|---|
| `<title>` y meta descripción | "A Mano · Cocina latinoamericana a tu medida" |
| Header | Logo nuevo, sin el texto "Recetario" |
| Inicio | Una pregunta: "¿Qué hay a mano hoy?" |
| "¿Qué tengo en casa?" | Pasa a llamarse "¿Qué hay a mano?" |
| Asistente de IA | "Manitas", avatar = isotipo sobre círculo Maíz |
| Secciones "De la casa / comunidad / mundo" | Se mantienen |
| Pie | "A Mano · Con lo que hay, alcanza." |

### Ejemplos de tono

- **CTA:** Ver qué puedo cocinar · Empezar a cocinar · Buscar un reemplazo · Guardar para después · Jugar el Plato del día · Sumar mi receta
- **Cocinando:** "Dejar reposar 5 minutos. El sabor lo agradece." · "Sin crema, sirve yogur natural. Queda distinto, pero funciona." · "Cuidado: el aceite salpica." · "Listo. Apagar el fuego."
- **Juegos:** "Casi. Mañana hay otro plato." · "Nueva medalla: Cebolla sin lágrimas"
- **Racha perdida:** "Ayer no jugaste. Hoy arrancamos de nuevo." (sin dramatismo)
- **Publicar:** "Tu receta ya está en A Mano. Gracias por sumarla."

## Asistente: Manitas

- Vive **dentro de cada receta** ("¿No tenés algo? Adaptá esta receta") además del chat.
- Responde con **tarjetas** (receta, reemplazo) y con **botones rápidos**: "No tengo X", "Somos 2", "Sin horno", "Algo más liviano".
- Conoce el **país del usuario** y usa los nombres e ingredientes de ese país.
- Más breve que el resto del sitio: 2 a 4 líneas, un dato útil, una pregunta como máximo. Sin muletillas tipo "¡Claro! Con gusto te ayudo".
- Sin cara ni mascota: avatar = isotipo.
- Necesita un *system prompt* fijo con la guía de voz y ejemplos, y probarlo con 20 preguntas reales antes de publicar. La calidad de una IA gratuita varía y el tono se desvía sin ese prompt.

## Gamificación

- Es una **capa**, no el carácter de la marca. El Maíz solo aparece en premios.
- **Medallas:** sello circular de borde levemente irregular. Estados: bloqueada (contorno crema oscuro), lograda (relleno Maíz, ícono Hierba), especial (relleno Ají, ícono crema). Nada de oro, plata y bronce.
- **Niveles:** Primer hervor · A fuego lento · En su punto · Sazón propia · Mano maestra. Barra fina, sin "XP".
- **Rankings:** semanales con reinicio; mostrar la posición propia con dos arriba y dos abajo; pestaña de ranking por país (mantener tono de juego, sin premios reales).
- **Animación:** una sola de marca, el sello que se "estampa" con rebote de unos 400 ms. Confeti solo en logros grandes (nivel nuevo, racha de 7 días). Respetar `prefers-reduced-motion`.
- Lenguaje sobrio: "Nueva medalla: X", nada de "¡INCREÍBLE!".

## Momentos de marca prioritarios

1. **Autocompletar regional:** escribir "choclo" también encuentra "elote" (tabla de sinónimos por país).
2. **Entrada con la pregunta** "¿Qué hay a mano hoy?" y el país preseleccionado.
3. **El sello que se estampa** al ganar una medalla.

Otros puntos de contacto: mostrar la dificultad real según el país en cada receta; modo cocina limpio y de letra grande; juegos que terminan con un dato curioso; derrota sin castigo; notificación de comentario con nombre y país.

## Fotografía

- Luz natural lateral de ventana, sin flash. Cenital o 45°. Mesa de madera clara o mantel liso. Vajilla simple. Color natural, algo cálido. Manos presentes (servir, pasar el plato). Edición mínima (luz y recorte).
- **No:** stock brillante, flash, fondos negros de restaurante, manos con manicura de estudio, brillo artificial, mezclar estilos en un mismo carrusel.
- Aplicar a "De la casa" y a nuevas recetas de la comunidad. No forzar en "Del mundo".

## Redes

- Empezar por **Instagram y TikTok**; Shorts reutiliza TikTok; Pinterest después.
- Foto de perfil: isotipo. Bio: "Con lo que hay, alcanza. Cocina latinoamericana a tu medida."
- Tres plantillas repetibles: "Un plato, mil nombres", "Reemplazo de la semana", "Receta de la comunidad".
- Frases reservadas: *Recetas que pasan de mano en mano* (comunidad), *Toda Latinoamérica, a mano* (lanzamientos), *Tu mano derecha en la cocina* (IA).

## Plan de implementación

**Fase 0. Antes de tocar nada:** verificar nombre (ver "Pendiente de verificar") y validar con 5 personas de distintos países.

**Fase 1. Base técnica (visible, bajo riesgo):**
1. Variables CSS y carga de fuentes.
2. `theme-color`.
3. Botones, cards y badges.

**Fase 2. Marca visible:**
1. Logo, isotipo y favicons en `img/`.
2. Renombrar `<title>`, header y pie.
3. Pantalla de inicio con "¿Qué hay a mano hoy?" y sección "¿Qué hay a mano?".

**Fase 3. Interfaz:**
1. Set de íconos propio y reemplazo de emojis (primero navegación y botones).
2. Textos de interfaz en `textos.js`.
3. 5 medallas rediseñadas con el sello y animación.

**Fase 4. Diferenciación de producto:**
1. Manitas dentro de cada receta, con tarjetas y botones rápidos, más el prompt probado.
2. Autocompletar con sinónimos regionales.

**Fase 5. Escala:**
1. Selector Neutro / Vos / Tú.
2. Ranking por país (campo de país en Supabase).
3. Marco uniforme para "Del mundo".
4. Analítica gratuita (Plausible en prueba o Cloudflare Analytics) para medir uso de "¿Qué hay a mano?", medallas y retención.

**Riesgos:** cambiar el nombre del proyecto de Vercel cambia la URL (dejar redirección); hacer todo junto impide saber qué funcionó; la IA con contexto por receta y el autocompletar regional aportan más diferenciación que el logo, no dejarlos para el final.

## Herramientas gratuitas

Penpot o Figma o Inkscape (logo) · Lucide y Phosphor (íconos) · Coolors y WebAIM Contrast Checker · Google Fonts · RealFaviconGenerator y maskable.app · Canva y CapCut (redes) · Pexels y Unsplash solo como apoyo, revisando licencias · Pinterest solo de referencia. Las herramientas de IA generativa, solo para ideas: la licencia y la coherencia de estilo son inciertas, no las usaría para el logo final.

## Lo que falta definir

- Brand book (esencia, propósito, misión, visión, valores, ejemplos correctos e incorrectos).
- Brand Core final en una hoja.
- Confirmar Manitas tras la verificación.
- Mapeo real de las variables CSS existentes (requiere ver `estilos.css`).
