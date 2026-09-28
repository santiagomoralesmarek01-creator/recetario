# Recetario → A Mano

- La identidad de marca y el plan de implementación por fases están en
  [`docs/marca-a-mano.md`](docs/marca-a-mano.md). Leerlo antes de tocar interfaz,
  colores, textos o íconos.
- Cambiar por fases, sin mezclar nombre, colores, textos, íconos e IA en un mismo cambio.
- No renombrar el proyecto de Vercel ni la URL sin preguntar.
- No tocar las recetas (`data/`) ni sus fotos al trabajar la marca: sólo interfaz.
- Colores: usar siempre las variables de `css/estilos.css` (`--aji`, `--hierba`,
  `--maiz`, `--exito`, `--error`, `--aviso`…), nunca valores sueltos.
- Sitio estático sin build: HTML, CSS y JS con módulos ES. Probar con
  `python3 -m http.server` y revisar modo claro y oscuro.
