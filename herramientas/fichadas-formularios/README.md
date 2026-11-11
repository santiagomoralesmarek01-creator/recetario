# Fichadas a formularios

Página estática que convierte las fichadas del sistema en los formularios de Google
(cambio de horario, compenso y horas extra) ya completos. No usa servidor ni IA:
todo se calcula en el navegador y queda guardado en `localStorage` de cada persona.

Publicada en Vercel como proyecto aparte: **https://fichadas-formularios.vercel.app**
(proyecto `fichadas-formularios`, separado del recetario). Esta carpeta está en
`.vercelignore` del recetario para que no se publique dentro de ese sitio.

## Archivos

- `logic.js`: reglas (tolerancia, redondeos, horas extra, agrupado, links prellenados).
- `app.js`: interfaz y almacenamiento local.
- `index.html`, `estilos.css`: página.
- `test.js`: prueba con fichadas reales de oct/nov 2026 → `node test.js`.
- `build.js`: arma `dist/index.html` en un solo archivo → `node build.js`.

## Probar y publicar

```bash
node test.js
python3 -m http.server   # abrir http://localhost:8000
node build.js
```

Para publicar, subir `dist/index.html` al proyecto `fichadas-formularios` de Vercel
(por ejemplo `npx vercel deploy dist --prod` con la cuenta del dueño).

## Reglas

- Jornada 9 h; en semana con sábado trabajado 8 h lun–vie y 5 h el sábado (horario base, sin formulario).
- Sábados no trabajados: cambio de horario con FRANCO. Feriados: sin formulario.
- Hasta 25 min tarde se declara el horario previsto y suma a la tolerancia del período (16 al 15).
  Más de 25 min: se declara desde la entrada redondeada a la media hora siguiente.
- Entrar antes no suma. Si entra y sale antes cubriendo la jornada, se declara ese horario corrido.
- Salida antes del fin: compenso desde la salida (media hora anterior) hasta el fin de la jornada.
- Horas extra: solo horas enteras, mínimo 1 h, desde el fin de la jornada declarada.
- Días seguidos con el mismo horario van en un solo formulario de cambio de horario.
- Viernes sin salida fichada (semana sin sábado): se supone fin de jornada.
