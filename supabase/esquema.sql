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
