# Aprender SQL y Supabase con el propio Recetario

Plan de estudio de 6 semanas (unas 4–5 horas por semana) usando como material
lo que A Mano **ya tiene en producción**: `supabase/esquema.sql`, `torneo.sql`,
`redes.sql` y el código de `js/` que les habla.

La práctica va en [`supabase/practica/ejercicios.sql`](../supabase/practica/ejercicios.sql),
que trabaja en un esquema aparte (`practica`) y nunca toca las tablas reales.

> **Dónde practicar.** Lo ideal es **no** usar el proyecto de producción:
> 1. **Supabase local** (recomendado): `npx supabase init` en una carpeta aparte y
>    `npx supabase start` (pide Docker). Abre Studio en `http://localhost:54323`.
> 2. **Un segundo proyecto gratis** en supabase.com, sólo para estudiar.
> 3. Si igual usás producción, sólo el esquema `practica` y las consultas de
>    lectura marcadas como tales. Al terminar: `drop schema practica cascade;`

---

## Semana 1 — Consultas básicas (SELECT)

**Conceptos:** `select`, `where`, `order by`, `limit`, `distinct`, `like`/`ilike`,
`is null`, `coalesce`.

**Mirar en el repo:**
- `js/misRecetas.js`: `COLUMNAS_RESUMEN` es literalmente la lista de columnas de un `select`.
- `js/actividad.js:36`: `.select('receta_id').order('created_at', …)` es
  `select receta_id from me_gusta order by created_at desc`. Traducir cada llamada
  de `supabase-js` a SQL a mano es el mejor ejercicio de esta semana.

**Práctica:** bloques 0 y 1 de `ejercicios.sql`.

## Semana 2 — Agrupar y resumir

**Conceptos:** `count`, `sum`, `avg`, `group by`, `having`, fechas (`now()`,
`interval`, `date_trunc`).

**Mirar en el repo:**
- `conteo_me_gusta` en `esquema.sql`: un `group by` simple.
- `ranking_semanal` en `esquema.sql`: `sum`, `join`, filtro por fecha
  (`now() - interval '7 days'`), `order by 2 desc limit 10`.

**Práctica:** bloque 2.

## Semana 3 — Modelado relacional y JOIN

**Conceptos:** claves primarias y foráneas, uno a muchos, **muchos a muchos con
tabla intermedia**, `inner`/`left join`, normalización.

**Discusión con el propio proyecto:** `recetas.ingredientes` es un `jsonb`
(una lista dentro de la fila). Es cómodo para guardar y mostrar, pero hace difícil
preguntar "¿qué recetas usan cebolla?" o "¿cuál es el ingrediente más usado?".
En la práctica se arma la versión normalizada (`receta`, `ingrediente`,
`receta_ingrediente`) y se comparan las dos.

**Práctica:** bloque 3.

## Semana 4 — JSON en Postgres y restricciones

**Conceptos:** `jsonb`, `->`, `->>`, `jsonb_array_elements`, `jsonb_array_length`,
`check`, `unique`, índices parciales.

**Mirar en el repo:**
- Los `check` de `recetas` (largo del nombre, `jsonb_typeof(...) = 'array'`).
- Los índices parciales de `actividad`: `unique ... where tipo = 'juego-plato-del-dia'`
  hace que el plato del día se juegue **una vez por día** directamente desde la base.

**Práctica:** bloque 4.

## Semana 5 — Seguridad: RLS y funciones

Es lo más importante de Supabase: la `anon key` es pública (está en `js/config.js`)
y **lo único que protege los datos son las políticas RLS**.

**Conceptos:** `enable row level security`, `create policy ... using / with check`,
roles `anon` / `authenticated`, `auth.uid()`, funciones `security definer`,
`grant execute`.

**Mirar en el repo:**
- Las 4 políticas de `recetas`: ver las públicas o las propias, y crear, editar
  o borrar sólo las propias.
- `usar_ayudante()`: `insert ... on conflict do update` (upsert) para contar
  mensajes por día, con `security definer` y `revoke`/`grant`.
- `torneo.sql`: funciones que validan reglas antes de escribir.

**Práctica:** bloque 5 (simular ser un usuario con `set local role`).

## Semana 6 — Supabase como plataforma

**Conceptos:** cliente JS (`select`, `insert`, `upsert`, `rpc`), Auth, Storage
con políticas por carpeta, Edge Functions, migraciones con la CLI.

**Ejercicios en el repo (en una rama aparte):**
1. Pasar `supabase/*.sql` a migraciones de la CLI (`supabase/migrations/…`) para
   que el esquema tenga historial en lugar de "pegar y ejecutar".
2. Escribir una vista o función `recetas_por_ingrediente(nombre text)` que use
   `jsonb_array_elements` sobre `recetas.ingredientes`, y llamarla con `sb.rpc(...)`.
3. Revisar los "Advisors" de seguridad y rendimiento en el panel de Supabase.

---

## Recursos

- Documentación de Supabase: <https://supabase.com/docs> (sobre todo *Database*,
  *Auth → Row Level Security* y *Local development*).
- Tutorial de PostgreSQL: <https://www.postgresqltutorial.com>.
- Práctica interactiva de SQL: <https://sqlbolt.com> y <https://pgexercises.com>.
- Referencia oficial: <https://www.postgresql.org/docs/current/>.

## Después de esto

Con SQL + Postgres + RLS firmes, Airtable, Notion o n8n se aprenden en días,
porque son variaciones de las mismas ideas: tablas, relaciones, permisos y
disparadores.
