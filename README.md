# Recetario

Web de recetas con cuentas de usuario, recetas propias y modo cocina.
Hecho con HTML, CSS y JavaScript, sin build ni dependencias que instalar.

## Qué hace

- **Repertorio de tres fuentes**
  - *De la casa*: recetas en español en `data/recetas-casa.json` (10 clásicos para empezar).
  - *De la comunidad*: las que cargan los usuarios (públicas).
  - *Del mundo*: las 791 recetas de TheMealDB, **traducidas al español**
    (ver "Catálogo en español" más abajo).
- **Búsqueda** en español en las tres fuentes, por nombre o ingrediente.
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
   Crea la tabla `recetas`, las reglas de seguridad y el bucket de fotos.
3. **Settings → API**: copiá *Project URL* y *anon public key* en `js/config.js`.
   La anon key es pública por diseño; la seguridad la dan las reglas RLS.
   Nunca uses la *service_role key* en la web.
4. **Authentication → URL Configuration**: poné la URL de Vercel en *Site URL*
   y agregala también en *Redirect URLs* (y `http://localhost:8000` para probar).
   Así funcionan los emails de confirmación y de recuperar contraseña.
5. Opcional: en **Authentication → Providers → Email** podés desactivar
   *Confirm email* si no querés que se confirme el correo al registrarse.

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
├── img/                      íconos de reemplazo (SVG)
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
    ├── cocina.js             progreso del modo cocina y pantalla encendida
    ├── imagenes.js           URLs de imágenes y reemplazos
    ├── traducciones.js       diccionario español ↔ inglés
    ├── dom.js                helpers de interfaz
    └── vistas/               inicio, búsqueda, receta, cuenta, formulario
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
