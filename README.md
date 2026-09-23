# Recetario

Web de recetas con imágenes de platos e ingredientes. Es un proyecto independiente
del resto del repo: HTML, CSS y JavaScript sin build ni dependencias.

## Cómo correrlo

Los módulos de JavaScript necesitan un servidor (no alcanza con abrir el archivo):

```bash
cd recetas
python3 -m http.server 8000
# abrir http://localhost:8000
```

También se puede publicar tal cual en GitHub Pages, Netlify o Vercel.

## Qué hace

- **Inicio**: receta destacada al azar y grilla de categorías.
- **Búsqueda**: primero por nombre de receta y, si no hay resultados, por ingrediente.
  Traduce términos comunes del español ("pollo" → "chicken").
- **Receta**: foto, ingredientes con su imagen y medida, pasos, video y fuente.
- **🎲 Sorpresa**: abre una receta aleatoria.

## De dónde salen las imágenes

| Qué | Fuente | Archivo |
|---|---|---|
| Fotos de platos | `strMealThumb` de TheMealDB (miniatura con `/small`) | `js/imagenes.js` |
| Ingredientes | `https://www.themealdb.com/images/ingredients/<Nombre>-Small.png` | `js/imagenes.js` |
| Categorías | `strCategoryThumb` de TheMealDB | `js/api.js` |
| Reemplazos | `img/plato-generico.svg`, `img/ingrediente-generico.svg` (propios) | `img/` |

Si una imagen no carga, `crearImagen()` prueba la versión grande y, si también
falla, muestra el ícono genérico. Nunca queda una imagen rota.

Para cambiar de proveedor de imágenes (Spoonacular, Unsplash/Pexels, fotos propias
en Cloudinary, etc.) sólo hay que modificar `js/imagenes.js`.

## Estructura

```
recetas/
├── index.html
├── css/estilos.css
├── img/                  íconos de reemplazo (SVG)
└── js/
    ├── app.js            vistas y ruteo (#/, #/buscar/…, #/categoria/…, #/receta/…)
    ├── api.js            cliente de TheMealDB + normalización de datos
    ├── imagenes.js       URLs de imágenes y manejo de fallos
    └── traducciones.js   diccionario español ↔ inglés
```

## Antes de publicar

- La clave `1` de TheMealDB es de prueba/desarrollo. Para un sitio público conviene
  conseguir una clave propia (se obtiene apoyando el proyecto en Patreon) y
  cambiarla en `js/api.js`.
- Mantener el crédito a TheMealDB en el pie de página.
- Las instrucciones de las recetas vienen en inglés. El diccionario de
  `js/traducciones.js` cubre ingredientes y categorías, y se puede ampliar.

## Próximos pasos posibles

- Recetas propias en español (un JSON o una base de datos) mezcladas con las de la API.
- Favoritos guardados en el navegador.
- Filtro por país de origen (`filter.php?a=`).
