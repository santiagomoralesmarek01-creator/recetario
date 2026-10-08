# Publicación automática en Instagram (@amanorecetas)

Los posteos, carruseles, reels e historias se publican solos en el día y la hora
del calendario de cada semana, sin servicios pagos.

```
docs/marca/instagram/semana-N/                 tu carpeta de siempre (PNG, MP4, 00-CALENDARIO-Y-TEXTOS.txt)
   │  node scripts/redes-calendario.mjs <carpeta>      → calendario.json
   │  /admin/redes → "Subir semana"  (o scripts/redes-subir.mjs)
   ▼
Supabase Storage, bucket público "redes"      los PNG pasan a JPG (Instagram sólo acepta JPEG)
Supabase, tabla publicaciones_redes           una fila por publicación, con su estado
   ▲
   │  cada 10 min: pg_cron → POST /api/redes?accion=publicar   (con CRON_SECRET)
api/redes.js (Vercel)  ── Instagram API ──▶  @amanorecetas
   │  una vez por día: Vercel Cron → /api/redes?accion=diario
   └─ revisa el token, avisa por mail (Resend) lo que va a mano y cualquier problema
```

## Qué se puede y qué no por la API

Verificado contra la documentación de Meta en octubre de 2026. Cambia seguido: si
algo falla, revisá primero [Content Publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing).

| | Por API | Notas |
|---|---|---|
| Imagen | Sí | **Sólo JPEG** (por eso se convierten los PNG). 4:5 (1080×1350) va bien. |
| Carrusel | Sí | De 2 a 10 láminas. Se recortan todas a la proporción de la primera. |
| Reel | Sí | MP4 (H.264). Texto, **portada (`cover_url`)** y "compartir en el feed". |
| Historia | Sí, **sólo cuentas Empresa** | Una imagen o un video, sin texto. Duran 24 h. |
| Sticker de enlace, encuesta, ubicación, música en historias | **No** | Esas historias quedan "Va a mano" y llega un mail ese día. |
| Música en reels | **No** | Los reels salen sin audio. Si querés música, publicá ese reel a mano. |
| Fijar un posteo arriba del perfil, guardar en Destacadas, fijar un comentario | **No** | Se hace desde la app. |
| Límite de publicaciones | Por cuenta, 24 h móviles | El publicador consulta `content_publishing_limit` antes de publicar y, si se llegó al tope, espera una hora. |

Una cosa más: los MP4 de los reels no traen pista de audio. Instagram los suele
aceptar así, pero confirmalo con el modo de prueba (paso 7), que procesa el
video de verdad.

## Activarlo: una sola vez

### 1. Instagram y página de Facebook
- En la app de Instagram: Configuración → **Tipo de cuenta y herramientas**. Tiene que
  decir **Empresa**. Con una cuenta de Creador no se pueden publicar historias por API.
- @amanorecetas tiene que estar **vinculada a la página de Facebook de A Mano**. Se ve en
  Business Suite → Configuración → Cuentas → Cuentas de Instagram, o en el Centro de
  cuentas de Instagram. Si no hay página, creala y vinculala desde ahí.

### 2. Meta for Developers (app "API/amano", ya creada)
La app quedó con el caso de uso de Instagram **con inicio de sesión con Facebook**: se
publica con el token de la página vinculada, que **no vence**.

1. developers.facebook.com/apps → **API/amano** → Casos de uso → *Administrar mensajes y contenido en Instagram* → **Personalizar** → **Permisos y funciones**.
   Agregá (botón "+ Añadir") los que pide: `instagram_basic`, `instagram_content_publish`,
   `pages_show_list`, `pages_read_engagement` y `business_management`.
2. **Configuración de la app → Básica:** copiá el **Identificador de la app** y la
   **Clave secreta de la app** (botón "Mostrar"). Van a Vercel (paso 5) y a ningún otro lado.
3. Cuando el PR esté unido y el panel funcionando (paso 6):
   **Herramientas → Explorador de la API Graph**:
   - Aplicación de Meta: **API/amano**.
   - "Usuario o página": **Token de acceso de usuario**.
   - Permisos: los 5 del punto 1.
   - **Generate Access Token**. En la ventana que se abre, elegí la página de A Mano y la cuenta @amanorecetas y aceptá.
   - Copiá el token (empieza con `EAA`). **Dura 1 o 2 horas**: pegalo enseguida en el panel.

   El servidor lo cambia por un token de usuario de larga duración, busca la página
   que tiene vinculado @amanorecetas y guarda **el token de esa página, que no vence**.

La app puede quedar **sin publicar** (modo desarrollo): como la cuenta es tuya y
tenés rol en la app, publica igual. No hace falta revisión de Meta ni "proveedor de tecnología".

> Si algún día Meta te ofrece el camino "con inicio de sesión de **Instagram**"
> (token que empieza con `IG`), también funciona: el panel lo detecta, publica por
> graph.instagram.com y la tarea diaria renueva ese token cada 7 días.

### 3. Supabase
1. SQL Editor → crear el secreto del disparador (una sola vez):
   ```sql
   select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'redes_cron_secret');
   select decrypted_secret from vault.decrypted_secrets where name = 'redes_cron_secret';
   ```
   Copiá el valor que muestra la segunda línea: va a Vercel como `CRON_SECRET`.
2. SQL Editor → pegar y correr **todo** `supabase/redes.sql`. Crea:
   - las tablas `publicaciones_redes` y `redes_credenciales` (esta última con RLS y sin políticas: sólo la lee el servidor);
   - el bucket público `redes`;
   - las funciones del panel;
   - la tarea de pg_cron que corre cada 10 minutos.

   Se puede volver a correr cuantas veces haga falta.

### 4. Resend (mails de aviso, gratis)
1. Creá la cuenta en resend.com **con amanorecetas@gmail.com**. El plan gratis manda 3.000 mails por mes.
2. API Keys → Create → permiso *Sending access*. Copiala para Vercel.

Sin dominio verificado, Resend manda desde `onboarding@resend.dev` y **sólo al
email de la cuenta**, que es justo lo que necesitamos. Si los avisos llegan a
spam, marcalos como "no es spam".

### 5. Vercel → Settings → Environment Variables (Production)

| Variable | Valor |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API Keys → la **secret** / `service_role` key. Sólo va acá, nunca en el navegador ni en el repo. |
| `CRON_SECRET` | El valor del paso 3.1. Vercel Cron lo manda solo a la tarea diaria. |
| `RESEND_API_KEY` | La del paso 4. |
| `META_APP_ID` | Identificador de la app API/amano (paso 2.2). |
| `META_APP_SECRET` | Clave secreta de la app (paso 2.2). Sólo va acá. |
| `AVISO_EMAIL` | *(opcional)* A dónde mandar los avisos. Por defecto amanorecetas@gmail.com. |
| `IG_API_VERSION` | *(opcional)* Versión de la API. Por defecto `v24.0`. |
| `REDES_TOLERANCIA_HORAS` | *(opcional)* Si el publicador estuvo caído, lo que se atrasó más de esto no se publica (queda "Vencida"). Por defecto 6. |

Después **Redeploy** para que tome las variables. La tarea diaria (`vercel.json`,
`crons`) corre a las 10:00 UTC, o sea a las 7 de Argentina. En el plan Hobby
puede caer en cualquier momento de esa hora.

### 6. Cargar el token
amanorecetas.com.ar/admin/redes → **Cargar un token nuevo** → pegar el token del
paso 2.3 → Guardar. Tiene que decir "Token guardado para @amanorecetas (token de
página, no vence)". Después tocá **Probar la conexión**: muestra `@amanorecetas` y
el cupo de 24 h.

### 7. Probar sin publicar
La semana 2 (`docs/marca/instagram/semana-2-7-al-13-oct`) ya trae su
`calendario.json` marcado `"solo_prueba": true`. Ya está programada en Business
Suite, así que **nunca se publica por la API**: queda en estado "Sólo prueba",
que el publicador no toca.

1. En el panel → **Cargar una semana** → elegí esa carpeta → **Subir semana**.
2. **Probar la semana sin publicar.** Para cada publicación:
   - arma los contenedores de verdad en Instagram, así que Instagram descarga las imágenes y procesa los videos y la portada;
   - **no llama nunca a `media_publish`**;
   - los contenedores sin publicar vencen solos a las 24 h;
   - el resultado queda en la columna Detalle ("✓ Prueba OK" con los pasos).

### 8. Ver que pg_cron esté corriendo
Lo más fácil es mirar en el panel la "Última corrida del publicador", que se
actualiza cada 10 minutos. En SQL:
```sql
select * from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'redes-publicar') order by start_time desc limit 5;
select id, status_code, left(content, 200) from net._http_response order by id desc limit 5;
```
Si devuelve 401, el `CRON_SECRET` de Vercel no es igual al de Vault.

## Cada semana

1. Generá la carpeta de la semana como siempre (PNG, MP4 y `00-CALENDARIO-Y-TEXTOS.txt`).
2. `node scripts/redes-calendario.mjs docs/marca/instagram/semana-3-… --anio 2026`
   escribe `calendario.json` y avisa si algo no cumple los límites de Instagram
   (texto de más de 2.200 caracteres, más de 30 hashtags, más de 10 láminas…).
   Revisalo: ahí podés cambiar una hora, un texto o poner `"manual": false` a una
   historia para que salga sola sin sticker.
3. Panel → **Subir semana**. No hace falta deploy ni unir nada a `main`.
   Con ffmpeg instalado también sirve `node scripts/redes-subir.mjs <carpeta>`, que pide tu email y contraseña de admin.
4. Revisá la lista, y si querés tocá **Probar la semana sin publicar**.
5. Listo. El día de cada historia "Va a mano" llega un mail a la mañana con las
   imágenes. Después de subirla tocá **Ya la subí**.

Volver a subir una semana actualiza sólo lo que todavía no salió: no duplica y no
toca lo publicado. Si borrás una entrada del calendario, al volver a subirla
desaparece del panel, salvo que ya haya salido.

## Estados y botones del panel

| Estado | Qué pasa | Botones |
|---|---|---|
| Programada (`pendiente`) | Sale sola a su hora. Unos 20 minutos antes se prepara el contenedor, así los reels salen en hora. | Pausar · Cambiar hora · Probar |
| Preparando (`procesando`) | El contenedor está creado e Instagram procesa el video, o espera la hora exacta. | — |
| Publicada | Tiene el id de Instagram y el enlace. | — |
| Error | Falló 3 veces (o el token no sirve). Llega un mail. | Reintentar · Cambiar hora · Pausar · Probar |
| Vencida | No salió a tiempo (el disparador estuvo caído más de 6 h). Llega un mail. | Cambiar hora · Ya la subí · Pausar |
| Pausada | No sale hasta que la reanudes. | Reanudar · Cambiar hora · Probar |
| Va a mano (`manual`) | Historia con sticker de enlace: llega un mail ese día. | Ya la subí · Publicar sin sticker · Cambiar hora |
| Sólo prueba | Semanas de prueba: nunca se publican. | Probar |

**No publica dos veces.** Cada id se guarda apenas Instagram lo devuelve. Antes de
publicar se mira el estado del contenedor: si ya figura `PUBLISHED` (se publicó
pero se perdió la respuesta), se marca como publicada sin repetir. Además, cada
fila se bloquea mientras una ejecución la procesa (`for update skip locked`).

**Reintentos.** Un error se reintenta a los 5, 20 y 60 minutos. Si se llega al
límite de publicaciones o a demasiados pedidos, se espera una hora sin contar el
intento. Si el token no sirve, no se reintenta y llega el aviso.

**Token.** Se guarda en `redes_credenciales`, que el navegador no puede leer
(desde el panel sólo se puede cargar uno nuevo, a través del servidor). El token
de página no vence, pero se invalida si cambiás la contraseña de Facebook o le
sacás el permiso a la app: la tarea diaria comprueba que siga andando y, si no,
manda un mail. En ese caso generá uno nuevo (paso 2.3) y cargalo en el panel.
(Con el inicio de sesión de Instagram, la tarea diaria además lo renueva cada 7
días y avisa si faltan menos de 10 para que venza.)

## Pruebas

- `node scripts/probar-redes.mjs`: prueba sin red. Simula Supabase e Instagram y
  recorre imagen, carrusel, reel con portada, historia, idempotencia, reintentos,
  token vencido, modo de prueba, tarea diaria y el secreto del endpoint.
- `node scripts/redes-subir.mjs <carpeta> --simulacro`: convierte y lista lo que subiría, sin conectarse.
- El modo de prueba del panel (paso 7) contra la cuenta real, sin publicar.

## Para apagarlo

- Todo: `select cron.unschedule('redes-publicar');` en Supabase.
- Una publicación: **Pausar** en el panel.

## TikTok (más adelante)

Se haría con la Content Posting API. Hace falta:
- una app en developers.tiktok.com con el permiso `video.publish`;
- pasar la **auditoría de TikTok**: mientras no la apruebe, todo lo que se publique queda privado. Piden la web, la política de privacidad y un video mostrando el flujo;
- un token por usuario, que se renueva con un refresh token.

El calendario ya guarda el texto de TikTok (`tiktok`) de cada reel. Los carruseles
irían en modo foto (`photo_mode`), que también se publica por API.
