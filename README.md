# A Mano

*Con lo que hay, alcanza.* Cocina latinoamericana a tu medida: recetas con
cuentas de usuario, recetas propias y modo cocina. La identidad de marca está en
[`docs/marca-a-mano.md`](docs/marca-a-mano.md).
Hecho con HTML, CSS y JavaScript, sin build ni dependencias que instalar.

## Qué hace

- **Repertorio de tres fuentes**
  - *De la casa*: recetas en español en `data/recetas-casa.json` (10 clásicos para empezar).
  - *De la comunidad*: las que cargan los usuarios (públicas).
  - *Del mundo*: las 791 recetas de TheMealDB, **traducidas al español**
    (ver "Catálogo en español" más abajo).
- **Búsqueda** en español en las tres fuentes, por nombre o ingrediente.
- **Comunidad** (`#/comunidad`): todas las recetas públicas que suben los
  usuarios, con filtro por categoría, buscador y "Ver más"; también aparece
  como primera categoría en el inicio. Cada autor tiene su página (`#/autor/…`).
- **Recetas por país**: más de 60 países agrupados por continente, con banderas.
- **Cuentas** (Supabase): registro, ingreso, recuperar contraseña.
- **Mis recetas** (requiere cuenta; el resto de la web no): crear, editar y
  borrar recetas con foto (subida desde el celular, se achica automáticamente)
  y elegir si son públicas o privadas. Los ingredientes se eligen de una lista
  de ~880 (con imagen, buscando por nombre) o se escriben libres, y la cantidad
  se carga con número + unidad (g, taza, cda, a gusto…).
- **Modo cocina** en cada receta: tildás ingredientes y pasos, ves el progreso,
  se resalta el paso que sigue, el avance queda guardado en el dispositivo y
  podés mantener la pantalla encendida.
- **Panel "Cocinando ahora"**: al tildar algo (o con "📌 Seguir al costado") la
  receta queda fija en una columna a la derecha con sus ingredientes y pasos,
  aunque sigas navegando. En pantallas angostas es un botón flotante que abre un
  cajón lateral. Todo se sincroniza con la ficha de la receta.
- **Temporizadores**: los pasos que mencionan un tiempo ("hornear 20 minutos")
  tienen un botón ⏱ para arrancarlo; también se puede poner uno a mano desde la
  barra de cocina. Siguen andando al cambiar de página y al terminar avisan con
  un cartel, sonido y vibración.
- **Me gusta** ❤️ en cualquier receta; las favoritas aparecen en "Mis recetas".
- **Juegos** (`#/juegos`): *Plato del día* (desafío diario igual para todos,
  con racha y resultado para compartir), *Adiviná el país*, *¿Qué le falta?*
  y *Armá el plato*, con ranking semanal.
- **Medallas** (`#/medallas`): 21 medallas por subir recetas, dar y recibir
  me gusta, completar recetas y jugar. Se calculan a partir de la actividad
  guardada en Supabase.
- **Imágenes sin huecos**: si una receta no tiene foto se muestra un collage de
  sus ingredientes; si una imagen no carga aparece un ícono de reemplazo.

## Correrlo en tu computadora

```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```

Sin configurar Supabase ya funciona todo menos las cuentas y las recetas propias.

## Publicar en Vercel

1. Entrá a <https://vercel.com/new> e importá el repositorio `recetario`.
2. **Framework Preset**: `Other`. Dejá vacíos Build Command y Output Directory.
3. Deploy. La rama `main` se publica en producción; las demás ramas generan
   *previews* con su propia URL.

Cada push posterior vuelve a publicar solo.


## Activar cuentas y recetas propias (Supabase)

1. Creá un proyecto gratis en <https://supabase.com> (o usá uno existente).
2. **SQL Editor → New query**: pegá todo `supabase/esquema.sql` y ejecutalo.
   Crea las tablas (recetas, me gusta, actividad para juegos y medallas), las
   reglas de seguridad y el bucket de fotos. Se puede volver a ejecutar entero
   cada vez que el archivo cambia: no borra nada.
3. **Settings → API**: copiá *Project URL* y *anon public key* en `js/config.js`.
   La anon key es pública por diseño; la seguridad la dan las reglas RLS.
   Nunca uses la *service_role key* en la web.
4. **Authentication → URL Configuration**: poné la URL de Vercel en *Site URL*
   y agregala también en *Redirect URLs* (y `http://localhost:8000` para probar).
   Así funcionan los emails de confirmación y de recuperar contraseña.
5. Opcional: en **Authentication → Providers → Email** podés desactivar
   *Confirm email* si no querés que se confirme el correo al registrarse.

## Ayudante de cocina (chat con IA gratuita)

El botón 🍳 abre un chat que responde dudas de cocina y, en una receta, conoce
sus ingredientes y pasos. Usa el plan gratuito de Google Gemini a través de la
función `api/ayudante.js` (Vercel), así la clave nunca llega al navegador.
Sólo lo pueden usar personas con sesión iniciada, con un máximo de 40 mensajes
por día cada una.

1. Entrá a <https://aistudio.google.com/apikey> con una cuenta de Google y creá
   una clave (*Create API key*). Es gratis y no pide tarjeta.
2. En Vercel: **Settings → Environment Variables** → agregá `GEMINI_API_KEY`
   con esa clave (entornos *Production* y *Preview*) y volvé a desplegar.
   No la pegues en el código ni la compartas.
3. En Supabase, volvé a ejecutar `supabase/esquema.sql` completo (se puede
   repetir sin problema): suma la tabla que cuenta los mensajes de cada día.

Recomendado: cargá también `GROQ_API_KEY` (clave gratis, sin tarjeta, en
<https://console.groq.com/keys>). Con las dos claves responde primero Groq, que
suele tardar uno o dos segundos, y si no puede, Gemini (que a veces está
saturado). Cada pedido tiene un máximo de 25 segundos.

Para comprobar la configuración abrí `/api/ayudante` en el navegador: tiene que
decir `"listo":true`.

Opcional: `GEMINI_MODELO` / `GROQ_MODELO` fuerzan un modelo en particular.
El plan gratuito tiene un tope diario por proyecto; si se alcanza, el chat avisa
que tiene mucha demanda y vuelve a andar al día siguiente. En el plan gratuito,
Google puede usar las conversaciones para mejorar sus productos: no hace falta
(ni conviene) contarle datos personales al ayudante.

## Cargar fotos de recetas (administradores)

Las recetas sin foto muestran un fondo con un emoji. Para cargarles foto sin
tocar código:

1. Hacete administrador (una sola vez): en Supabase, **SQL Editor**, ejecutá
   `supabase/esquema.sql` completo y después, con el email de tu cuenta:
   ```sql
   insert into public.administradores (user_id)
   select id from auth.users where email = 'tu-email@ejemplo.com'
   on conflict do nothing;
   ```
2. Entrá a la web con esa cuenta: en el menú de tu cuenta aparece
   **📷 Fotos de recetas** (`#/fotos`), con la lista de recetas sin foto.
   También podés tocar **📷 Subir foto** sobre la foto de cualquier receta.
3. Elegí la foto (desde el celular se puede sacar en el momento) y, si no es
   tuya, completá el crédito. La foto se achica sola y aparece enseguida.

De dónde sacar fotos: propias (lo mejor), o de bancos gratuitos que permiten
usarlas sin pagar: Unsplash, Pexels o Pixabay. Wikimedia Commons también sirve,
pero ahí casi siempre hay que poner el crédito del autor. No uses fotos de
otros sitios de recetas ni de Google Imágenes: tienen dueño.

Varias recetas de la casa usan fotos de Wikimedia Commons: en
`data/recetas-casa.json` tienen `imagen` (enlace `Special:FilePath`),
`creditoFoto` y `fuenteFoto` (la página del archivo, con autor y licencia, que
se enlaza desde el crédito). Una foto cargada desde `#/fotos` las reemplaza.

## Estructura

```
├── index.html
├── vercel.json               cabeceras y caché para Vercel
├── css/estilos.css
├── data/recetas-casa.json    recetas propias del sitio (se pueden sumar más)
├── data/mealdb/              catálogo del mundo en español (generado)
├── data/fuente/              catálogo original y traducciones a mano
├── scripts/                  descarga y traducción del catálogo
├── .github/workflows/        Actions que corren esos scripts
├── img/                      logo, isotipo, favicons, íconos de la app, og-image y reemplazos (SVG)
├── manifest.webmanifest      nombre e íconos para instalar la web en el celular
├── supabase/esquema.sql      tabla, seguridad y bucket de fotos
└── js/
    ├── app.js                ruteo y menú de sesión
    ├── config.js             URL y anon key de Supabase
    ├── supabase.js           carga el cliente de Supabase sólo si está configurado
    ├── auth.js               registro, ingreso, salida
    ├── repositorio.js        une las tres fuentes de recetas
    ├── recetasCasa.js        recetas de data/recetas-casa.json
    ├── misRecetas.js         recetas de usuarios (tabla + fotos)
    ├── catalogo.js           catálogo en español (data/mealdb/)
    ├── api.js                API de TheMealDB (respaldo en inglés)
    ├── ingredientes.js       lista de ingredientes y unidades para el formulario
    ├── cocina.js             progreso del modo cocina, receta actual y pantalla encendida
    ├── panelCocina.js        panel lateral "Cocinando ahora"
    ├── temporizador.js       temporizadores de cocina y detección de tiempos en los pasos
    ├── actividad.js          me gusta, actividad y ranking (Supabase)
    ├── medallas.js           definición y cálculo de medallas
    ├── ayudante.js           chat del ayudante de cocina
    ├── recomendaciones.js    recetas candidatas que el ayudante puede recomendar
    ├── juegos/               Plato del día, Adiviná el país, ¿Qué le falta?, Armá el plato
    ├── imagenes.js           URLs de imágenes y reemplazos
    ├── traducciones.js       diccionario español ↔ inglés
    ├── dom.js                helpers de interfaz
    └── vistas/               inicio, búsqueda, receta, cuenta, formulario, comunidad
```

## Catálogo en español

Las recetas del mundo salen de TheMealDB (en inglés) y se traducen una sola vez,
en GitHub Actions, para que la web cargue todo en español sin depender de nadie:

1. **Descargar catálogo** (`scripts/descargar-mealdb.mjs`) baja todo a
   `data/fuente/mealdb-en.json`. Se puede volver a correr desde la pestaña
   *Actions* de GitHub para sumar recetas nuevas.
2. **Traducir catálogo** (`scripts/traducir-catalogo.py`) genera `data/mealdb/`:
   - nombres de recetas e ingredientes: traducidos a mano en
     `data/fuente/nombres-es.json` y `data/fuente/ingredientes-es.json`;
   - medidas: `scripts/medidas.py` ("2 tbsp" → "2 cdas", libras y onzas a gramos);
   - países que TheMealDB no trae: `data/fuente/origenes-es.json`;
   - pasos: Argos Translate (traductor libre) + glosario rioplatense + arreglos
     de temperaturas (°C) y términos de cocina. Quedan en
     `data/fuente/pasos-es.json`; si corregís uno a mano ahí, se respeta.

Para corregir una traducción, editá esos archivos y hacé push: la Action vuelve
a armar el catálogo sola. Si `data/mealdb/` no existiera, la web usa la API de
TheMealDB en inglés como respaldo.

## Sumar recetas de la casa

Agregá un objeto a `data/recetas-casa.json`:

```json
{
  "slug": "nombre-unico",
  "nombre": "Nombre visible",
  "categoria": "Beef",
  "origen": "Argentina",
  "porciones": 4,
  "minutos": 30,
  "descripcion": "Una línea.",
  "etiquetas": ["Horno"],
  "imagen": "",
  "ingredientes": [{ "nombre": "Cebolla", "medida": "2", "imagen": "Onion" }],
  "pasos": ["Paso uno.", "Paso dos."]
}
```

`categoria` usa las claves en inglés de `CATEGORIAS` en `js/traducciones.js`.
En los ingredientes, `imagen` (el nombre en inglés de TheMealDB) es opcional:
si falta se intenta deducir del diccionario.

## Antes de tener mucho tráfico

- La clave `1` de TheMealDB es de prueba. Para un sitio público conviene una
  propia (se obtiene apoyando el proyecto en Patreon) y cambiarla en `js/api.js`.
- Mantener el crédito a TheMealDB en el pie de página.
