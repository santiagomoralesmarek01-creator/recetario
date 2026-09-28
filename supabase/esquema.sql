-- Esquema del Recetario para Supabase.
-- Pegar y ejecutar completo en: Supabase → SQL Editor → New query → Run.
-- Se puede ejecutar más de una vez sin romper nada.

-- ---------------------------------------------------------------------
-- Tabla de recetas de los usuarios
-- ---------------------------------------------------------------------
create table if not exists public.recetas (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre        text not null check (char_length(nombre) between 2 and 120),
  descripcion   text check (char_length(descripcion) <= 300),
  categoria     text,
  origen        text,
  porciones     int check (porciones between 1 and 100),
  minutos       int check (minutos between 1 and 2000),
  imagen_url    text,
  -- [{ "nombre": "Cebolla", "medida": "2 unidades" }, ...]
  ingredientes  jsonb not null default '[]'::jsonb check (jsonb_typeof(ingredientes) = 'array'),
  -- ["Picar la cebolla", "Rehogar...", ...]
  pasos         jsonb not null default '[]'::jsonb check (jsonb_typeof(pasos) = 'array'),
  publica       boolean not null default true,
  autor_nombre  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists recetas_user_id_idx on public.recetas (user_id);
create index if not exists recetas_publicas_idx on public.recetas (created_at desc) where publica;
create index if not exists recetas_categoria_idx on public.recetas (categoria);

-- Mantener updated_at al día
create or replace function public.recetas_tocar_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists recetas_updated_at on public.recetas;
create trigger recetas_updated_at
  before update on public.recetas
  for each row execute function public.recetas_tocar_updated_at();

-- ---------------------------------------------------------------------
-- Seguridad (RLS): cada uno edita lo suyo; las públicas las ve cualquiera
-- ---------------------------------------------------------------------
alter table public.recetas enable row level security;

drop policy if exists "Ver recetas públicas o propias" on public.recetas;
create policy "Ver recetas públicas o propias" on public.recetas
  for select using (publica or auth.uid() = user_id);

drop policy if exists "Crear recetas propias" on public.recetas;
create policy "Crear recetas propias" on public.recetas
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Editar recetas propias" on public.recetas;
create policy "Editar recetas propias" on public.recetas
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Borrar recetas propias" on public.recetas;
create policy "Borrar recetas propias" on public.recetas
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Fotos: bucket público; cada usuario sólo escribe en su carpeta <user_id>/
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-recetas', 'fotos-recetas', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

drop policy if exists "Subir fotos propias" on storage.objects;
create policy "Subir fotos propias" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos-recetas' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Editar fotos propias" on storage.objects;
create policy "Editar fotos propias" on storage.objects
  for update to authenticated
  using (bucket_id = 'fotos-recetas' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Borrar fotos propias" on storage.objects;
create policy "Borrar fotos propias" on storage.objects
  for delete to authenticated
  using (bucket_id = 'fotos-recetas' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------
-- Ayudante de cocina: cuántos mensajes mandó cada usuario por día.
-- Nadie lee ni escribe la tabla directamente (RLS sin políticas); sólo
-- la función usar_ayudante(), que suma uno para el usuario de la sesión.
-- ---------------------------------------------------------------------
create table if not exists public.uso_ayudante (
  user_id   uuid not null references auth.users (id) on delete cascade,
  dia       date not null default current_date,
  mensajes  int not null default 0,
  primary key (user_id, dia)
);

alter table public.uso_ayudante enable row level security;

create or replace function public.usar_ayudante()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  usados int;
begin
  if auth.uid() is null then
    raise exception 'Hay que iniciar sesión' using errcode = '42501';
  end if;
  insert into public.uso_ayudante as u (user_id, dia, mensajes)
  values (auth.uid(), current_date, 1)
  on conflict (user_id, dia) do update set mensajes = u.mensajes + 1
  returning u.mensajes into usados;
  return usados;
end;
$$;

revoke all on function public.usar_ayudante() from public, anon;
grant execute on function public.usar_ayudante() to authenticated;

-- ---------------------------------------------------------------------
-- Me gusta: cualquier receta (catálogo, de la casa o de la comunidad).
-- Cada uno ve y toca sólo los suyos; los totales se leen con una función.
-- ---------------------------------------------------------------------
create table if not exists public.me_gusta (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  receta_id  text not null check (receta_id ~ '^[A-Za-z0-9_-]{1,80}$'),
  created_at timestamptz not null default now(),
  primary key (user_id, receta_id)
);
create index if not exists me_gusta_receta_idx on public.me_gusta (receta_id);

alter table public.me_gusta enable row level security;

drop policy if exists "Ver mis me gusta" on public.me_gusta;
create policy "Ver mis me gusta" on public.me_gusta
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Dar me gusta" on public.me_gusta;
create policy "Dar me gusta" on public.me_gusta
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Sacar me gusta" on public.me_gusta;
create policy "Sacar me gusta" on public.me_gusta
  for delete to authenticated using (auth.uid() = user_id);

-- Cantidad de me gusta de varias recetas (sin mostrar quién los dio).
create or replace function public.conteo_me_gusta(ids text[])
returns table (receta_id text, cantidad bigint)
language sql stable security definer set search_path = public
as $$
  select m.receta_id, count(*) from public.me_gusta m
  where m.receta_id = any (ids[1:100])
  group by m.receta_id;
$$;
grant execute on function public.conteo_me_gusta(text[]) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Actividad para medallas y juegos: recetas cocinadas y partidas jugadas.
-- ---------------------------------------------------------------------
create table if not exists public.actividad (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo       text not null check (tipo in ('receta-cocinada', 'juego-plato-del-dia', 'juego-pais', 'juego-falta', 'juego-armar')),
  detalle    text check (char_length(detalle) <= 80),
  puntos     int not null default 0 check (puntos between 0 and 1000),
  dia        date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists actividad_user_idx on public.actividad (user_id, tipo);
create index if not exists actividad_semana_idx on public.actividad (created_at) where tipo like 'juego-%';
-- El plato del día se juega una vez por día; cada receta cuenta una sola vez como cocinada.
create unique index if not exists actividad_plato_dia_idx on public.actividad (user_id, dia) where tipo = 'juego-plato-del-dia';
create unique index if not exists actividad_cocinada_idx on public.actividad (user_id, detalle) where tipo = 'receta-cocinada';

alter table public.actividad enable row level security;

drop policy if exists "Ver mi actividad" on public.actividad;
create policy "Ver mi actividad" on public.actividad
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Registrar mi actividad" on public.actividad;
-- La fecha puede venir del navegador (el plato del día usa la hora de Argentina),
-- pero sólo ayer, hoy o mañana.
create policy "Registrar mi actividad" on public.actividad
  for insert to authenticated
  with check (auth.uid() = user_id and dia between current_date - 1 and current_date + 1);

-- Todo lo que hace falta para calcular las medallas, en una sola llamada.
create or replace function public.mis_logros()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'recetas_subidas', (select count(*) from public.recetas where user_id = auth.uid()),
    'me_gusta_dados', (select count(*) from public.me_gusta where user_id = auth.uid()),
    'me_gusta_recibidos', (
      select count(*) from public.me_gusta m
      join public.recetas r on m.receta_id = 'u-' || r.id::text
      where r.user_id = auth.uid() and m.user_id <> auth.uid()),
    'recetas_cocinadas', (select count(*) from public.actividad where user_id = auth.uid() and tipo = 'receta-cocinada'),
    'juegos', coalesce((
      select jsonb_object_agg(tipo, jsonb_build_object('partidas', partidas, 'mejor', mejor, 'total', total))
      from (
        select tipo, count(*) as partidas, max(puntos) as mejor, sum(puntos) as total
        from public.actividad where user_id = auth.uid() and tipo like 'juego-%'
        group by tipo
      ) j), '{}'::jsonb),
    'dias_plato', coalesce((
      select jsonb_agg(dia order by dia desc) from (
        select dia from public.actividad
        where user_id = auth.uid() and tipo = 'juego-plato-del-dia' and puntos > 0
        order by dia desc limit 400
      ) d), '[]'::jsonb)
  )
  where auth.uid() is not null;
$$;
revoke all on function public.mis_logros() from public, anon;
grant execute on function public.mis_logros() to authenticated;

-- Ranking de los juegos de los últimos 7 días (sólo el nombre visible).
create or replace function public.ranking_semanal()
returns table (nombre text, puntos bigint, soy_yo boolean)
language sql stable security definer set search_path = public
as $$
  select coalesce(nullif(trim(u.raw_user_meta_data ->> 'nombre'), ''), 'Cocinero/a'),
         sum(a.puntos), a.user_id = auth.uid()
  from public.actividad a
  join auth.users u on u.id = a.user_id
  where a.tipo like 'juego-%' and a.created_at > now() - interval '7 days'
  group by a.user_id, u.raw_user_meta_data
  order by 2 desc
  limit 10;
$$;
grant execute on function public.ranking_semanal() to anon, authenticated;
