-- =====================================================================
-- Publicación automática en Instagram (@amanorecetas)
-- ---------------------------------------------------------------------
-- Correr entero en Supabase → SQL Editor (se puede volver a correr).
-- Después seguir los pasos de docs/redes-instagram.md: guardar el secreto
-- del disparador en Vault y cargar el token desde /admin/redes.
--
-- Quién usa qué:
--   · publicaciones_redes: la lee el panel /admin/redes (sólo administradores)
--     y la cambia la función api/redes.js con la service_role key.
--   · redes_credenciales: el token de Instagram. RLS activado y SIN políticas:
--     desde el navegador nadie la puede leer ni escribir. Sólo la service_role.
--   · bucket "redes": imágenes y videos con URL pública (Instagram los descarga
--     desde ahí). Sólo los administradores suben archivos.
-- =====================================================================

-- ---------- calendario ----------
create table if not exists public.publicaciones_redes (
  id              bigint generated always as identity primary key,
  clave           text not null unique check (clave ~ '^[A-Za-z0-9_.-]{1,120}$'),
  semana          text not null check (semana ~ '^[A-Za-z0-9_.-]{1,80}$'),
  fecha           timestamptz not null,
  tipo            text not null check (tipo in ('imagen', 'carrusel', 'reel', 'historia')),
  archivos        text[] not null check (cardinality(archivos) between 1 and 10),
  texto           text check (char_length(texto) <= 2200),
  portada         text,
  nota            text check (char_length(nota) <= 500),
  -- pendiente → procesando → publicada; o error / vencida (con aviso por mail).
  -- manual: historias con sticker de enlace, que se suben a mano desde el celular.
  -- solo_prueba: semanas cargadas para probar; nunca se publican de verdad.
  estado          text not null default 'pendiente'
                  check (estado in ('pendiente', 'procesando', 'publicada', 'error', 'pausada', 'manual', 'solo_prueba', 'vencida')),
  contenedor_id   text,          -- contenedor de Instagram listo para publicar
  hijos           text[],        -- contenedores de cada lámina del carrusel
  ig_media_id     text,          -- id de la publicación ya hecha
  enlace          text,          -- permalink
  intentos        int not null default 0,
  proximo_intento timestamptz,
  bloqueada_hasta timestamptz,   -- la tomó una ejecución del publicador
  ultimo_error    text,
  avisado         boolean not null default false,
  prueba          jsonb,         -- resultado del último modo de prueba
  publicada_en    timestamptz,
  creada_en       timestamptz not null default now(),
  actualizada_en  timestamptz not null default now()
);
create index if not exists publicaciones_redes_pendientes on public.publicaciones_redes (fecha)
  where estado in ('pendiente', 'procesando');
alter table public.publicaciones_redes enable row level security;
drop policy if exists "Administradores ven publicaciones" on public.publicaciones_redes;
create policy "Administradores ven publicaciones" on public.publicaciones_redes
  for select to authenticated
  using (exists (select 1 from public.administradores a where a.user_id = auth.uid()));
-- Los cambios desde el navegador van sólo por las funciones redes_cargar y
-- redes_admin (más abajo), que controlan qué se puede tocar.

-- ---------- token (privado) ----------
create table if not exists public.redes_credenciales (
  red            text primary key check (red in ('instagram')),
  token          text,
  ig_user_id     text,
  usuario        text,
  cargado_en     timestamptz,     -- cuándo se emitió o renovó el token
  vence_en       timestamptz,
  ultimo_error   text,
  avisado_en     timestamptz,     -- último mail de aviso (para no repetir)
  ultima_corrida timestamptz      -- última vez que corrió el publicador
);
alter table public.redes_credenciales enable row level security;
-- Sin políticas a propósito. Además se quitan los permisos directos.
revoke all on public.redes_credenciales from anon, authenticated;

-- ---------- archivos ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('redes', 'redes', true, 52428800, array['image/jpeg', 'video/mp4'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Administradores suben archivos de redes" on storage.objects;
create policy "Administradores suben archivos de redes" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'redes' and exists (select 1 from public.administradores a where a.user_id = auth.uid()));
drop policy if exists "Administradores cambian archivos de redes" on storage.objects;
create policy "Administradores cambian archivos de redes" on storage.objects
  for update to authenticated
  using (bucket_id = 'redes' and exists (select 1 from public.administradores a where a.user_id = auth.uid()))
  with check (bucket_id = 'redes' and exists (select 1 from public.administradores a where a.user_id = auth.uid()));
drop policy if exists "Administradores ven archivos de redes" on storage.objects;
create policy "Administradores ven archivos de redes" on storage.objects
  for select to authenticated
  using (bucket_id = 'redes' and exists (select 1 from public.administradores a where a.user_id = auth.uid()));
drop policy if exists "Administradores borran archivos de redes" on storage.objects;
create policy "Administradores borran archivos de redes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'redes' and exists (select 1 from public.administradores a where a.user_id = auth.uid()));

-- ---------- cargar una semana (panel o scripts/redes-subir.mjs) ----------
-- p: { semana, solo_prueba, publicaciones: [{ clave, fecha, tipo, archivos, texto, portada, manual, nota }] }
-- con archivos y portada ya como rutas dentro del bucket. Lo ya publicado o en
-- curso no se toca; lo pendiente se actualiza, y lo pendiente que ya no está en
-- el calendario se borra.
drop function if exists public.redes_cargar(jsonb);
create or replace function public.redes_cargar(p jsonb)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_semana text := p ->> 'semana';
  v_prueba boolean := coalesce((p ->> 'solo_prueba')::boolean, false);
  v_pub jsonb;
  v_claves text[] := '{}';
  v_n int := 0;
begin
  if not exists (select 1 from administradores a where a.user_id = auth.uid()) then
    raise exception 'Sólo para administradores.';
  end if;
  for v_pub in select * from jsonb_array_elements(p -> 'publicaciones') loop
    v_claves := v_claves || (v_pub ->> 'clave');
    insert into publicaciones_redes (clave, semana, fecha, tipo, archivos, texto, portada, nota, estado)
    values (
      v_pub ->> 'clave', v_semana, (v_pub ->> 'fecha')::timestamptz, v_pub ->> 'tipo',
      array(select jsonb_array_elements_text(v_pub -> 'archivos')),
      nullif(v_pub ->> 'texto', ''), nullif(v_pub ->> 'portada', ''), nullif(v_pub ->> 'nota', ''),
      case when v_prueba then 'solo_prueba'
           when coalesce((v_pub ->> 'manual')::boolean, false) then 'manual'
           else 'pendiente' end)
    on conflict (clave) do update set
      semana = excluded.semana, fecha = excluded.fecha, tipo = excluded.tipo, archivos = excluded.archivos,
      texto = excluded.texto, portada = excluded.portada, nota = excluded.nota,
      estado = case when publicaciones_redes.estado in ('pendiente', 'manual', 'solo_prueba') then excluded.estado
                    else publicaciones_redes.estado end,
      contenedor_id = null, hijos = null, actualizada_en = now()
    where publicaciones_redes.estado not in ('publicada', 'procesando');
    v_n := v_n + 1;
  end loop;
  delete from publicaciones_redes
  where semana = v_semana and not (clave = any (v_claves))
    and estado in ('pendiente', 'manual', 'solo_prueba', 'pausada', 'vencida');
  return v_n;
end;
$$;
revoke all on function public.redes_cargar(jsonb) from public, anon;
grant execute on function public.redes_cargar(jsonb) to authenticated;

-- ---------- acciones del panel ----------
--   pausar      pendiente / manual / error / vencida → pausada
--   reanudar    pausada → pendiente
--   reintentar  error / vencida → pendiente (con los intentos en cero)
--   automatica  manual → pendiente (se publica sin el sticker de enlace)
--   hecha       manual / vencida → publicada (la subiste a mano)
--   reprogramar cambia la fecha de algo que todavía no salió (p_fecha)
drop function if exists public.redes_admin(bigint, text, timestamptz);
create or replace function public.redes_admin(p_id bigint, p_accion text, p_fecha timestamptz default null)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_estado text;
begin
  if not exists (select 1 from administradores a where a.user_id = auth.uid()) then
    raise exception 'Sólo para administradores.';
  end if;
  select estado into v_estado from publicaciones_redes where id = p_id for update;
  if v_estado is null then raise exception 'No existe esa publicación.'; end if;

  if p_accion = 'pausar' and v_estado in ('pendiente', 'manual', 'error', 'vencida') then
    update publicaciones_redes set estado = 'pausada', actualizada_en = now() where id = p_id;
  elsif p_accion = 'reanudar' and v_estado = 'pausada' then
    update publicaciones_redes set estado = 'pendiente', actualizada_en = now() where id = p_id;
  elsif p_accion = 'reintentar' and v_estado in ('error', 'vencida') then
    update publicaciones_redes set estado = 'pendiente', intentos = 0, proximo_intento = null,
      ultimo_error = null, avisado = false, actualizada_en = now() where id = p_id;
  elsif p_accion = 'automatica' and v_estado = 'manual' then
    update publicaciones_redes set estado = 'pendiente', actualizada_en = now() where id = p_id;
  elsif p_accion = 'hecha' and v_estado in ('manual', 'vencida') then
    update publicaciones_redes set estado = 'publicada', publicada_en = now(), nota = trim(coalesce(nota, '') || ' · Subida a mano.'),
      actualizada_en = now() where id = p_id;
  elsif p_accion = 'reprogramar' and p_fecha is not null and v_estado in ('pendiente', 'manual', 'pausada', 'error', 'vencida') then
    update publicaciones_redes set fecha = p_fecha, contenedor_id = null, hijos = null,
      estado = case when v_estado in ('error', 'vencida') then 'pendiente' else v_estado end,
      intentos = 0, proximo_intento = null, ultimo_error = null, avisado = false, actualizada_en = now() where id = p_id;
  else
    raise exception 'No se puede "%" una publicación en estado "%".', p_accion, v_estado;
  end if;
  return (select estado from publicaciones_redes where id = p_id);
end;
$$;
revoke all on function public.redes_admin(bigint, text, timestamptz) from public, anon;
grant execute on function public.redes_admin(bigint, text, timestamptz) to authenticated;

-- ---------- token desde el panel (sólo escribir, nunca leer) ----------
drop function if exists public.redes_guardar_token(text);
create or replace function public.redes_guardar_token(p_token text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from administradores a where a.user_id = auth.uid()) then
    raise exception 'Sólo para administradores.';
  end if;
  if p_token is null or char_length(trim(p_token)) < 50 then raise exception 'Ese token no parece válido.'; end if;
  insert into redes_credenciales (red, token, cargado_en, vence_en, ultimo_error, ig_user_id, usuario)
  values ('instagram', trim(p_token), now(), now() + interval '60 days', null, null, null)
  on conflict (red) do update set token = excluded.token, cargado_en = excluded.cargado_en,
    vence_en = excluded.vence_en, ultimo_error = null, avisado_en = null, ig_user_id = null, usuario = null;
end;
$$;
revoke all on function public.redes_guardar_token(text) from public, anon;
grant execute on function public.redes_guardar_token(text) to authenticated;

-- Estado del token para el panel, sin el token.
drop function if exists public.redes_estado_token();
create or replace function public.redes_estado_token()
returns table (hay_token boolean, usuario text, ig_user_id text, cargado_en timestamptz, vence_en timestamptz,
               ultimo_error text, ultima_corrida timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from administradores a where a.user_id = auth.uid()) then
    raise exception 'Sólo para administradores.';
  end if;
  return query select c.token is not null, c.usuario, c.ig_user_id, c.cargado_en, c.vence_en, c.ultimo_error, c.ultima_corrida
    from redes_credenciales c where c.red = 'instagram';
end;
$$;
revoke all on function public.redes_estado_token() from public, anon;
grant execute on function public.redes_estado_token() to authenticated;

-- ---------- para el publicador (sólo service_role) ----------
-- Toma las publicaciones que ya llegaron (o llegan en los próximos 20 minutos,
-- para ir preparando los videos) y las bloquea 4 minutos: dos ejecuciones al
-- mismo tiempo nunca agarran la misma.
drop function if exists public.redes_tomar(int);
create or replace function public.redes_tomar(p_limite int default 5)
returns setof public.publicaciones_redes
language sql security invoker set search_path = public as $$
  update publicaciones_redes p set bloqueada_hasta = now() + interval '4 minutes'
  where p.id in (
    select id from publicaciones_redes
    where estado in ('pendiente', 'procesando')
      and fecha <= now() + interval '20 minutes'
      and (proximo_intento is null or proximo_intento <= now())
      and (bloqueada_hasta is null or bloqueada_hasta < now())
    order by fecha
    limit p_limite
    for update skip locked)
  returning p.*;
$$;
revoke all on function public.redes_tomar(int) from public, anon, authenticated;
grant execute on function public.redes_tomar(int) to service_role;

-- =====================================================================
-- Disparador: cada 10 minutos, pg_cron llama al publicador.
-- ANTES de correr este bloque, guardá el secreto (el mismo valor que la
-- variable CRON_SECRET de Vercel) en Vault, una sola vez:
--   select vault.create_secret('EL-SECRETO', 'redes_cron_secret');
-- (Para cambiarlo: select vault.update_secret(id, 'NUEVO') con el id de
--  select id from vault.secrets where name = 'redes_cron_secret').
-- =====================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'redes-publicar';
select cron.schedule('redes-publicar', '*/10 * * * *', $cron$
  select net.http_post(
    url := 'https://amanorecetas.com.ar/api/redes?accion=publicar',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'redes_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000);
$cron$);

-- Para ver si está corriendo:
--   select * from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'redes-publicar') order by start_time desc limit 5;
--   select id, status_code, left(content, 200) from net._http_response order by id desc limit 5;
-- Para frenarlo todo:  select cron.unschedule('redes-publicar');
