-- =====================================================================
-- Práctica de SQL para el plan de docs/aprender-sql-supabase.md
--
-- Todo vive en el esquema "practica": no toca las tablas reales del sitio
-- ni las recetas de data/. Ideal: correrlo en Supabase local o en un
-- proyecto de prueba. Para borrar todo:  drop schema practica cascade;
--
-- Cómo usarlo: ejecutar el BLOQUE 0 una vez y después ir ejercicio por
-- ejercicio. Intentá cada uno antes de mirar la solución (comentada abajo).
-- =====================================================================


-- ---------------------------------------------------------------------
-- BLOQUE 0 — Preparar datos de práctica (versión normalizada)
-- ---------------------------------------------------------------------
create schema if not exists practica;

drop table if exists practica.receta_ingrediente, practica.ingrediente, practica.receta cascade;

create table practica.receta (
  id         int generated always as identity primary key,
  nombre     text not null unique,
  categoria  text not null,
  origen     text,
  minutos    int check (minutos > 0),
  porciones  int check (porciones between 1 and 100),
  creada     date not null default current_date
);

create table practica.ingrediente (
  id     int generated always as identity primary key,
  nombre text not null unique
);

-- Muchos a muchos: una receta tiene muchos ingredientes y un ingrediente
-- está en muchas recetas.
create table practica.receta_ingrediente (
  receta_id      int references practica.receta (id) on delete cascade,
  ingrediente_id int references practica.ingrediente (id),
  medida         text,
  primary key (receta_id, ingrediente_id)
);

insert into practica.receta (nombre, categoria, origen, minutos, porciones, creada) values
  ('Empanadas de carne', 'Carne',     'Argentina', 90, 24, current_date - 30),
  ('Lomo saltado',       'Carne',     'Perú',      40,  4, current_date - 20),
  ('Humita en olla',     'Vegetariana','Argentina', 60,  4, current_date - 12),
  ('Sopa paraguaya',     'Vegetariana','Paraguay',  70,  8, current_date - 9),
  ('Arroz con pollo',    'Pollo',     'Perú',      55,  6, current_date - 5),
  ('Guacamole',          'Vegetariana','México',    10,  4, current_date - 2),
  ('Ñoquis de papa',     'Pastas',    'Argentina', 75,  4, current_date - 1),
  ('Flan casero',        'Postre',    null,        80,  8, current_date);

insert into practica.ingrediente (nombre) values
  ('Cebolla'), ('Carne vacuna'), ('Tapas de empanada'), ('Papa'), ('Tomate'),
  ('Choclo'), ('Queso'), ('Huevo'), ('Harina'), ('Arroz'), ('Pollo'),
  ('Palta'), ('Limón'), ('Leche'), ('Azúcar'), ('Ají amarillo'), ('Dulce de leche');

-- Carga las relaciones buscando los id por nombre (patrón muy común).
insert into practica.receta_ingrediente (receta_id, ingrediente_id, medida)
select r.id, i.id, v.medida
from (values
  ('Empanadas de carne', 'Carne vacuna', '1 kg'),
  ('Empanadas de carne', 'Cebolla', '3 unidades'),
  ('Empanadas de carne', 'Tapas de empanada', '24 unidades'),
  ('Empanadas de carne', 'Huevo', '2 unidades'),
  ('Lomo saltado', 'Carne vacuna', '600 g'),
  ('Lomo saltado', 'Cebolla', '1 unidad'),
  ('Lomo saltado', 'Tomate', '2 unidades'),
  ('Lomo saltado', 'Papa', '3 unidades'),
  ('Lomo saltado', 'Ají amarillo', '1 unidad'),
  ('Humita en olla', 'Choclo', '6 unidades'),
  ('Humita en olla', 'Cebolla', '1 unidad'),
  ('Humita en olla', 'Leche', '200 ml'),
  ('Humita en olla', 'Queso', '150 g'),
  ('Sopa paraguaya', 'Harina', '500 g'),
  ('Sopa paraguaya', 'Cebolla', '2 unidades'),
  ('Sopa paraguaya', 'Queso', '300 g'),
  ('Sopa paraguaya', 'Huevo', '4 unidades'),
  ('Sopa paraguaya', 'Leche', '500 ml'),
  ('Arroz con pollo', 'Arroz', '2 tazas'),
  ('Arroz con pollo', 'Pollo', '1 kg'),
  ('Arroz con pollo', 'Cebolla', '1 unidad'),
  ('Arroz con pollo', 'Ají amarillo', '2 cucharadas'),
  ('Guacamole', 'Palta', '3 unidades'),
  ('Guacamole', 'Tomate', '1 unidad'),
  ('Guacamole', 'Cebolla', '½ unidad'),
  ('Guacamole', 'Limón', '1 unidad'),
  ('Ñoquis de papa', 'Papa', '1 kg'),
  ('Ñoquis de papa', 'Harina', '300 g'),
  ('Ñoquis de papa', 'Huevo', '1 unidad'),
  ('Flan casero', 'Huevo', '6 unidades'),
  ('Flan casero', 'Leche', '1 litro'),
  ('Flan casero', 'Azúcar', '250 g')
) as v (receta, ingrediente, medida)
join practica.receta r on r.nombre = v.receta
join practica.ingrediente i on i.nombre = v.ingrediente;


-- ---------------------------------------------------------------------
-- BLOQUE 1 — SELECT básico (semana 1)
-- ---------------------------------------------------------------------
-- 1.1 Nombre y minutos de todas las recetas, de la más rápida a la más lenta.
-- 1.2 Recetas argentinas que se hacen en menos de 80 minutos.
-- 1.3 Lista de orígenes sin repetir (¡ojo con el null!).
-- 1.4 Recetas cuyo nombre contenga "de" sin importar mayúsculas.
-- 1.5 Mostrar el origen, o 'Sin origen' cuando sea null.

-- Soluciones:
-- 1.1 select nombre, minutos from practica.receta order by minutos;
-- 1.2 select nombre from practica.receta where origen = 'Argentina' and minutos < 80;
-- 1.3 select distinct origen from practica.receta where origen is not null order by 1;
-- 1.4 select nombre from practica.receta where nombre ilike '%de%';
-- 1.5 select nombre, coalesce(origen, 'Sin origen') as origen from practica.receta;


-- ---------------------------------------------------------------------
-- BLOQUE 2 — Agrupar (semana 2)
-- ---------------------------------------------------------------------
-- 2.1 Cuántas recetas hay por categoría.
-- 2.2 Promedio de minutos por origen, redondeado, sólo orígenes con 2+ recetas.
-- 2.3 Recetas creadas en los últimos 7 días (como ranking_semanal en esquema.sql).
-- 2.4 Recetas por semana de creación (date_trunc).

-- Soluciones:
-- 2.1 select categoria, count(*) from practica.receta group by categoria order by 2 desc;
-- 2.2 select origen, round(avg(minutos)) as prom from practica.receta
--       where origen is not null group by origen having count(*) >= 2;
-- 2.3 select nombre, creada from practica.receta where creada > current_date - interval '7 days';
-- 2.4 select date_trunc('week', creada)::date as semana, count(*)
--       from practica.receta group by 1 order by 1;


-- ---------------------------------------------------------------------
-- BLOQUE 3 — JOIN y muchos a muchos (semana 3)
-- ---------------------------------------------------------------------
-- 3.1 Ingredientes (con medida) de "Lomo saltado".
-- 3.2 Recetas que usan Cebolla.
-- 3.3 Los 5 ingredientes más usados.
-- 3.4 Ingredientes que no usa ninguna receta (pista: left join ... is null).
-- 3.5 "¿Qué hay a mano?": con Huevo, Leche, Harina y Azúcar, ¿qué recetas tienen
--     TODOS sus ingredientes cubiertos?
-- 3.6 Igual que 3.5, pero recetas a las que les falta como mucho 1 ingrediente,
--     mostrando cuántos faltan.

-- Soluciones:
-- 3.1 select i.nombre, ri.medida
--       from practica.receta r
--       join practica.receta_ingrediente ri on ri.receta_id = r.id
--       join practica.ingrediente i on i.id = ri.ingrediente_id
--      where r.nombre = 'Lomo saltado';
-- 3.2 select r.nombre from practica.receta r
--       join practica.receta_ingrediente ri on ri.receta_id = r.id
--       join practica.ingrediente i on i.id = ri.ingrediente_id
--      where i.nombre = 'Cebolla';
-- 3.3 select i.nombre, count(*) as recetas
--       from practica.receta_ingrediente ri join practica.ingrediente i on i.id = ri.ingrediente_id
--      group by i.nombre order by recetas desc limit 5;
-- 3.4 select i.nombre from practica.ingrediente i
--       left join practica.receta_ingrediente ri on ri.ingrediente_id = i.id
--      where ri.receta_id is null;
-- 3.5 / 3.6
--     select r.nombre,
--            count(*) filter (where i.nombre <> all (array['Huevo','Leche','Harina','Azúcar'])) as faltan
--       from practica.receta r
--       join practica.receta_ingrediente ri on ri.receta_id = r.id
--       join practica.ingrediente i on i.id = ri.ingrediente_id
--      group by r.nombre
--     having count(*) filter (where i.nombre <> all (array['Huevo','Leche','Harina','Azúcar'])) <= 1  -- 3.5: = 0
--      order by faltan;


-- ---------------------------------------------------------------------
-- BLOQUE 4 — jsonb y restricciones (semana 4)
-- ---------------------------------------------------------------------
-- La tabla real public.recetas guarda ingredientes como jsonb. Acá armamos
-- la misma forma a partir de las tablas normalizadas, y la desarmamos.

-- 4.1 Armar, por receta, un jsonb con la forma de public.recetas.ingredientes:
--     [{ "nombre": "Cebolla", "medida": "2 unidades" }, ...]
-- 4.2 Guardar ese resultado en una tabla practica.receta_json (id, nombre, ingredientes jsonb).
-- 4.3 Sobre receta_json: recetas con más de 4 ingredientes (jsonb_array_length).
-- 4.4 Sobre receta_json: recetas que usan Queso (jsonb_array_elements o @>).
-- 4.5 Agregar un check para que receta_json.ingredientes siempre sea un array
--     (igual que en esquema.sql) y probar que un insert con '{}' falla.

-- Soluciones:
-- 4.1 select r.nombre,
--            jsonb_agg(jsonb_build_object('nombre', i.nombre, 'medida', ri.medida)) as ingredientes
--       from practica.receta r
--       join practica.receta_ingrediente ri on ri.receta_id = r.id
--       join practica.ingrediente i on i.id = ri.ingrediente_id
--      group by r.nombre;
-- 4.2 create table practica.receta_json as <consulta 4.1>;
-- 4.3 select nombre from practica.receta_json where jsonb_array_length(ingredientes) > 4;
-- 4.4 select nombre from practica.receta_json where ingredientes @> '[{"nombre":"Queso"}]';
--     -- o bien:
--     select distinct j.nombre from practica.receta_json j,
--            jsonb_array_elements(j.ingredientes) e where e ->> 'nombre' = 'Queso';
-- 4.5 alter table practica.receta_json
--       add constraint ingredientes_es_array check (jsonb_typeof(ingredientes) = 'array');
--     insert into practica.receta_json values ('Prueba', '{}');  -- debe fallar


-- ---------------------------------------------------------------------
-- BLOQUE 5 — RLS: cada uno ve lo suyo (semana 5)
-- Necesita Supabase (usa auth.uid() y los roles anon/authenticated).
-- ---------------------------------------------------------------------
create table if not exists practica.nota (
  id      bigint generated always as identity primary key,
  user_id uuid not null default auth.uid(),
  texto   text not null
);
alter table practica.nota enable row level security;
grant usage on schema practica to anon, authenticated;
grant select, insert on practica.nota to authenticated;

-- 5.1 Escribí la política para que cada usuario vea sólo sus notas
--     (mirá "Ver mi actividad" en esquema.sql).
-- 5.2 Escribí la política de insert para que nadie cree notas a nombre de otro.
-- 5.3 Probalo simulando dos usuarios dentro de una transacción que se deshace:
--
--   begin;
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
--   insert into practica.nota (texto) values ('nota del usuario 1');
--   set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
--   select * from practica.nota;   -- el usuario 2 no debería ver nada
--   insert into practica.nota (user_id, texto)
--     values ('11111111-1111-1111-1111-111111111111', 'trampa');  -- debe fallar
--   rollback;
--
-- 5.4 ¿Qué pasa si te olvidás de "enable row level security"? ¿Y si lo
--     activás pero no creás ninguna política?

-- Soluciones:
-- 5.1 create policy "Ver mis notas" on practica.nota
--       for select to authenticated using (auth.uid() = user_id);
-- 5.2 create policy "Crear mis notas" on practica.nota
--       for insert to authenticated with check (auth.uid() = user_id);
-- 5.4 Sin RLS, con el grant cualquiera con la anon key lee y escribe todo.
--     Con RLS y sin políticas, nadie (salvo service_role) ve nada: Postgres
--     niega por defecto.


-- ---------------------------------------------------------------------
-- BLOQUE 6 — Lectura sobre las tablas reales (sólo SELECT, opcional)
-- Desde el SQL Editor corrés como dueño, así que acá RLS no te limita:
-- por eso son sólo consultas de lectura.
-- ---------------------------------------------------------------------
-- 6.1 Recetas públicas de la comunidad por categoría:
--     select categoria, count(*) from public.recetas where publica group by 1 order by 2 desc;
-- 6.2 Ingredientes más usados en las recetas de la comunidad (jsonb):
--     select e ->> 'nombre' as ingrediente, count(*)
--       from public.recetas r, jsonb_array_elements(r.ingredientes) e
--      where r.publica group by 1 order by 2 desc limit 15;
-- 6.3 Partidas por tipo de juego en los últimos 7 días:
--     select tipo, count(*), sum(puntos) from public.actividad
--      where tipo like 'juego-%' and created_at > now() - interval '7 days' group by 1;
-- 6.4 Recetas con más me gusta:
--     select receta_id, count(*) from public.me_gusta group by 1 order by 2 desc limit 10;


-- Para limpiar todo lo de la práctica:
-- drop schema practica cascade;
