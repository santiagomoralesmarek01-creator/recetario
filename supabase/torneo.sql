-- =====================================================================
-- Torneo de juegos con premio: las partidas de "Adiviná el país", "¿Qué le
-- falta?" y "Armá el plato" las arma y las corrige el servidor, así nadie
-- puede mandar un puntaje inventado. Cada ronda se entrega recién cuando se
-- pide (no se pueden ver las siguientes) y el tiempo lo mide el servidor.
--
-- Cuenta para el torneo la PRIMERA partida de cada juego de cada día (la
-- "partida oficial"); las demás son de práctica. El Plato del día no suma al
-- torneo: es el mismo para todos y alguien podría pasar la respuesta.
--
-- Orden para instalar: este archivo y después supabase/juegos-datos-1.sql, -2 y -3
-- (el catálogo). Se puede volver a correr: no borra partidas ni ganadores.
-- =====================================================================

-- ---------- catálogo (lo carga juegos-datos.sql) ----------
create table if not exists public.juego_paises (
  pais       text primary key,
  continente text not null,
  latina     boolean not null
);
create table if not exists public.juego_comunes (
  nombre text primary key,
  clave  text,
  raiz   text not null
);
-- ingredientes: [[nombre, clave de imagen, usos, raíz, trivial 1/0], ...]
create table if not exists public.juego_recetas (
  id           text primary key,
  nombre       text not null,
  origen       text,
  categoria    text,
  categoria_es text,
  imagen       text,
  latina       boolean not null,
  delata       boolean not null,
  ingredientes jsonb not null
);
-- Sin políticas: sólo las funciones del servidor leen el catálogo.
alter table public.juego_paises enable row level security;
alter table public.juego_comunes enable row level security;
alter table public.juego_recetas enable row level security;

create or replace function public.juego_img_ing(p_clave text)
returns text language sql immutable as $$
  select case when coalesce(p_clave, '') = '' then 'img/ingrediente-generico.svg'
    else 'https://www.themealdb.com/images/ingredients/' || replace(p_clave, ' ', '%20') || '-Small.png' end;
$$;
create or replace function public.juego_img_receta(p_img text)
returns text language sql immutable as $$
  select case when p_img like 'm:%' then 'https://www.themealdb.com/images/media/meals/' || substr(p_img, 3) else p_img end;
$$;

-- ---------- configuración ----------
create table if not exists public.torneo_config (
  id             int primary key default 1 check (id = 1),
  inicio         date not null default '2026-10-12',   -- primer día del primer período
  dias           int not null default 14,              -- duración de cada período
  premio_juegos  int not null default 10000,           -- en pesos
  premio_receta  int not null default 10000,
  antiguedad_dias int not null default 7                -- antigüedad mínima de la cuenta al cierre
);
insert into public.torneo_config (id) values (1) on conflict do nothing;
alter table public.torneo_config enable row level security;
drop policy if exists "Ver configuración del torneo" on public.torneo_config;
create policy "Ver configuración del torneo" on public.torneo_config for select to anon, authenticated using (true);

create or replace function public.dia_argentina(p_t timestamptz default now())
returns date language sql stable as $$ select (p_t at time zone 'America/Argentina/Buenos_Aires')::date; $$;

-- Período del torneo que contiene un día: número (desde 1), inicio y fin (inclusive).
create or replace function public.torneo_periodo(p_dia date default null)
returns table (numero int, inicio date, fin date)
language sql stable security definer set search_path = public as $$
  with c as (select inicio as base, dias from torneo_config where id = 1),
  n as (select floor((coalesce(p_dia, dia_argentina()) - base)::numeric / dias)::int as k, base, dias from c)
  select k + 1, base + k * dias, base + k * dias + dias - 1 from n;
$$;
grant execute on function public.torneo_periodo(date) to anon, authenticated;

-- ---------- inscripción (requisitos para el premio) ----------
create table if not exists public.torneo_inscripciones (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  mayor_de_edad  boolean not null check (mayor_de_edad),
  vive_argentina boolean not null check (vive_argentina),
  bases_version  text not null,
  created_at     timestamptz not null default now()
);
alter table public.torneo_inscripciones enable row level security;
drop policy if exists "Ver mi inscripción" on public.torneo_inscripciones;
create policy "Ver mi inscripción" on public.torneo_inscripciones for select to authenticated using (auth.uid() = user_id);

create or replace function public.torneo_inscribirme(p_mayor boolean, p_argentina boolean, p_bases text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión.'; end if;
  if not (p_mayor and p_argentina) then raise exception 'Para participar hay que ser mayor de 18 y vivir en Argentina.'; end if;
  insert into torneo_inscripciones (user_id, mayor_de_edad, vive_argentina, bases_version)
  values (auth.uid(), true, true, left(p_bases, 20))
  on conflict (user_id) do update set bases_version = excluded.bases_version;
end;
$$;
revoke all on function public.torneo_inscribirme(boolean, boolean, text) from public, anon;
grant execute on function public.torneo_inscribirme(boolean, boolean, text) to authenticated;

-- ---------- partidas ----------
create table if not exists public.partidas (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  juego        text not null check (juego in ('pais', 'falta', 'armar')),
  modo         text not null check (modo in ('facil', 'normal', 'dificil')),
  dia          date not null,
  oficial      boolean not null default false,
  rondas       jsonb not null,               -- con las respuestas: nunca se manda entera
  ronda        int not null default 0,       -- ronda en juego (0 = la primera)
  servida_at   timestamptz,                  -- cuándo se entregó la ronda en juego
  respuestas   jsonb not null default '[]',  -- [{ms, puntos, bien}]
  puntos       int not null default 0,
  aciertos     int not null default 0,
  ms_total     bigint not null default 0,
  dispositivo  text,
  creada_at    timestamptz not null default now(),
  terminada_at timestamptz
);
create unique index if not exists partidas_oficial_idx on public.partidas (user_id, juego, dia) where oficial;
create index if not exists partidas_dia_idx on public.partidas (dia) where oficial;
create index if not exists partidas_user_idx on public.partidas (user_id, creada_at);
alter table public.partidas enable row level security;  -- sin políticas: sólo por las funciones

-- Las partidas de estos juegos ya no se pueden registrar desde el navegador:
-- las registra partida_responder al terminar.
drop policy if exists "Registrar mi actividad" on public.actividad;
create policy "Registrar mi actividad" on public.actividad
  for insert to authenticated
  with check (auth.uid() = user_id and dia between current_date - 1 and current_date + 1
              and tipo in ('receta-cocinada', 'juego-plato-del-dia'));

-- Reglas de cada juego y modo (iguales a las de js/juegos/*.js).
create or replace function public.juego_reglas(p_juego text, p_modo text)
returns jsonb language sql immutable as $$
  select case p_juego
    when 'pais' then jsonb_build_object('rondas', 10, 'latinas', case p_modo when 'facil' then 1 when 'normal' then 0.7 else 0.35 end,
      'segundos', case p_modo when 'facil' then 20 when 'normal' then 15 else 10 end,
      'cercanas', case p_modo when 'dificil' then 3 else 2 end,
      'puntos', case p_modo when 'facil' then 50 when 'normal' then 80 else 100 end)
    when 'falta' then jsonb_build_object('rondas', 10, 'latinas', case p_modo when 'facil' then 1 when 'normal' then 0.7 else 0.35 end,
      'opciones', case p_modo when 'facil' then 3 when 'normal' then 4 else 5 end,
      'puntos', case p_modo when 'facil' then 50 when 'normal' then 80 else 100 end)
    else jsonb_build_object('rondas', 5, 'latinas', case p_modo when 'facil' then 1 when 'normal' then 0.7 else 0.35 end,
      'correctos', case p_modo when 'facil' then 4 when 'normal' then 5 else 6 end,
      'falsos', case p_modo when 'facil' then 4 when 'normal' then 5 else 8 end,
      'acierto', case p_modo when 'facil' then 25 when 'normal' then 32 else 33 end,
      'error', case p_modo when 'facil' then 10 when 'normal' then 16 else 20 end)
  end;
$$;

-- Elige n recetas de la lista respetando la proporción de latinoamericanas.
create or replace function public.juego_elegir(p_ids text[], n int, p_latinas numeric)
returns text[] language sql volatile set search_path = public as $$
  with c as (select r.id, r.latina from juego_recetas r where r.id = any (p_ids)),
  l as (select id, row_number() over (order by random()) k from c where latina),
  m as (select id, row_number() over (order by random()) k from c where not latina),
  cuantas as (select least((select count(*) from l), round(n * p_latinas))::int as kl),
  base as (
    select id, 0 as orden from l, cuantas where k <= kl
    union all select id, 0 from m, cuantas where k <= n - kl),
  relleno as (
    select id, 1 as orden from (select id from l union all select id from m) x
    where id not in (select id from base) order by random()
    limit greatest(0, n - (select count(*) from base)))
  select array(select id from (select * from base union all select * from relleno) t order by random());
$$;

-- Ingrediente para mostrar: {n: nombre, i: imagen}.
create or replace function public.juego_ing_json(p_nombre text, p_clave text)
returns jsonb language sql immutable as $$ select jsonb_build_object('n', p_nombre, 'i', public.juego_img_ing(p_clave)); $$;

create or replace function public.juego_receta_json(r public.juego_recetas)
returns jsonb language sql immutable as $$
  -- Sin el id: con él se podría buscar la respuesta en el catálogo público.
  select jsonb_build_object('nombre', r.nombre, 'imagen', public.juego_img_receta(r.imagen),
    'categoria', r.categoria, 'categoriaEs', r.categoria_es, 'origen', r.origen);
$$;

-- Arma las rondas de una partida (con sus respuestas).
create or replace function public.juego_armar_rondas(p_juego text, p_modo text)
returns jsonb language plpgsql volatile set search_path = public as $$
declare
  reg jsonb := juego_reglas(p_juego, p_modo);
  ids text[];
  r juego_recetas;
  rondas jsonb := '[]';
  ings jsonb;
  oculto jsonb;
  correctos jsonb;
  falsos jsonb;
  raices text[];
  opciones jsonb;
  mismo_latina boolean;
  rid text;
begin
  if p_juego = 'pais' then
    select array_agg(id) into ids from (
      select distinct on (r2.origen) r2.id from juego_recetas r2 join juego_paises p on p.pais = r2.origen
      where not r2.delata and (r2.imagen is not null or r2.latina) order by r2.origen, random()) x;
    ids := juego_elegir(ids, (reg->>'rondas')::int, (reg->>'latinas')::numeric);
    foreach rid in array ids loop
      select * into r from juego_recetas where id = rid;
      mismo_latina := r.latina;
      with otros as (
        select p.pais, case when mismo_latina then p.latina else p.continente = (select continente from juego_paises where pais = r.origen) end as cerca
        from juego_paises p where p.pais <> r.origen),
      cerca as (select pais from otros where cerca order by random() limit (reg->>'cercanas')::int),
      lejos as (select pais from otros where pais not in (select pais from cerca) order by random()
                limit 3 - (select count(*) from cerca))
      select jsonb_agg(pais order by random()) into opciones
      from (select r.origen as pais union all select pais from cerca union all select pais from lejos) t;
      -- En este juego el país es la respuesta: no va en los datos de la receta.
      rondas := rondas || jsonb_build_array(jsonb_build_object('receta', juego_receta_json(r) - 'origen', 'opciones', opciones, 'respuesta', r.origen));
    end loop;

  elsif p_juego = 'falta' then
    select array_agg(id) into ids from juego_recetas where jsonb_array_length(ingredientes) between 5 and 14;
    ids := juego_elegir(ids, (reg->>'rondas')::int, (reg->>'latinas')::numeric);
    foreach rid in array ids loop
      select * into r from juego_recetas where id = rid;
      -- Candidatos: ni triviales ni sin foto, usados en 3+ recetas, de menos a más usados.
      with ing as (
        select e.v, e.o from jsonb_array_elements(r.ingredientes) with ordinality e(v, o)),
      cand as (
        select v, row_number() over (order by (v->>2)::int, o) k, count(*) over () total from ing
        where (v->>4)::int = 0 and v->>1 <> '' and (v->>2)::int >= 3),
      grupo as (
        select v from cand where case p_modo when 'dificil' then k <= 2 when 'facil' then k > total - 3 else k <= 4 end
        union all
        select v from ing where (v->>4)::int = 0 and not exists (select 1 from cand))
      select v into oculto from grupo order by random() limit 1;
      oculto := coalesce(oculto, r.ingredientes->0);
      raices := array(select e->>3 from jsonb_array_elements(r.ingredientes) e);
      select coalesce(jsonb_agg(juego_ing_json(nombre, clave)), '[]') into falsos from (
        select nombre, clave from (
          select distinct on (raiz) nombre, clave from juego_comunes where raiz <> all (raices) order by raiz, random()) x
        order by random() limit (reg->>'opciones')::int - 1) y;
      select jsonb_agg(o order by random()) into opciones
      from (select juego_ing_json(oculto->>0, oculto->>1) o union all select jsonb_array_elements(falsos)) t;
      select jsonb_agg(case when e = oculto then null else juego_ing_json(e->>0, e->>1) end order by o) into ings
      from jsonb_array_elements(r.ingredientes) with ordinality x(e, o);
      rondas := rondas || jsonb_build_array(jsonb_build_object('receta', juego_receta_json(r), 'ingredientes', ings,
        'opciones', opciones, 'respuesta', oculto->>0, 'respuestaImagen', juego_img_ing(oculto->>1)));
    end loop;

  else -- armar
    select array_agg(id) into ids from juego_recetas r2
    where (select count(distinct e->>3) from jsonb_array_elements(r2.ingredientes) e
           where (e->>4)::int = 0 and e->>1 <> '') >= (reg->>'correctos')::int;
    ids := juego_elegir(ids, (reg->>'rondas')::int, (reg->>'latinas')::numeric);
    foreach rid in array ids loop
      select * into r from juego_recetas where id = rid;
      -- Los más característicos del plato (menos usados), sin repetir raíz.
      select jsonb_agg(v order by u, o) into correctos from (
        select distinct on (e->>3) e as v, (e->>2)::int u, o
        from jsonb_array_elements(r.ingredientes) with ordinality x(e, o)
        where (e->>4)::int = 0 and e->>1 <> ''
        order by e->>3, (e->>2)::int, o) d;
      select jsonb_agg(v order by (v->>2)::int) into correctos from (
        select v from jsonb_array_elements(correctos) v order by (v->>2)::int limit (reg->>'correctos')::int) t;
      raices := array(select e->>3 from jsonb_array_elements(r.ingredientes) e);
      select coalesce(jsonb_agg(juego_ing_json(nombre, clave)), '[]') into falsos from (
        select nombre, clave from (
          select distinct on (raiz) nombre, clave from juego_comunes where raiz <> all (raices) order by raiz, random()) x
        order by random() limit (reg->>'falsos')::int) y;
      select jsonb_agg(o order by random()) into opciones from (
        select juego_ing_json(c->>0, c->>1) o from jsonb_array_elements(correctos) c
        union all select jsonb_array_elements(falsos)) t;
      rondas := rondas || jsonb_build_array(jsonb_build_object('receta', juego_receta_json(r), 'alacena', opciones,
        'respuesta', (select jsonb_agg(c->>0) from jsonb_array_elements(correctos) c)));
    end loop;
  end if;
  return rondas;
end;
$$;
revoke all on function public.juego_armar_rondas(text, text) from public, anon, authenticated;
revoke all on function public.juego_elegir(text[], int, numeric) from public, anon, authenticated;

-- Empieza una partida. La primera de cada juego del día es la oficial.
create or replace function public.partida_empezar(p_juego text, p_modo text, p_dispositivo text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  hoy date := dia_argentina();
  nueva uuid;
  es_oficial boolean;
  rondas jsonb;
begin
  if uid is null then raise exception 'Tenés que iniciar sesión.'; end if;
  if p_juego not in ('pais', 'falta', 'armar') or p_modo not in ('facil', 'normal', 'dificil') then
    raise exception 'Juego o modo inválido.';
  end if;
  if (select count(*) from partidas where user_id = uid and creada_at > now() - interval '1 hour') >= 60 then
    raise exception 'Jugaste muchas partidas seguidas. Probá de nuevo en un rato.';
  end if;
  rondas := juego_armar_rondas(p_juego, p_modo);
  es_oficial := not exists (select 1 from partidas where user_id = uid and juego = p_juego and dia = hoy and oficial);
  begin
    insert into partidas (user_id, juego, modo, dia, oficial, rondas, dispositivo)
    values (uid, p_juego, p_modo, hoy, es_oficial, rondas, left(p_dispositivo, 64)) returning id into nueva;
  exception when unique_violation then
    es_oficial := false;
    insert into partidas (user_id, juego, modo, dia, oficial, rondas, dispositivo)
    values (uid, p_juego, p_modo, hoy, false, rondas, left(p_dispositivo, 64)) returning id into nueva;
  end;
  return jsonb_build_object('id', nueva, 'oficial', es_oficial, 'total', jsonb_array_length(rondas), 'reglas', juego_reglas(p_juego, p_modo));
end;
$$;
revoke all on function public.partida_empezar(text, text, text) from public, anon;
grant execute on function public.partida_empezar(text, text, text) to authenticated;

-- Entrega la ronda en juego (sin la respuesta) y empieza a contar el tiempo.
-- Si ya se había entregado, devuelve la misma sin reiniciar el reloj.
create or replace function public.partida_ronda(p_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  p partidas;
  r jsonb;
begin
  select * into p from partidas where id = p_id and user_id = auth.uid() for update;
  if not found then raise exception 'Partida no encontrada.'; end if;
  if p.terminada_at is not null or p.ronda >= jsonb_array_length(p.rondas) then raise exception 'La partida ya terminó.'; end if;
  if p.servida_at is null then
    update partidas set servida_at = clock_timestamp() where id = p.id;
  end if;
  r := (p.rondas->p.ronda) - 'respuesta' - 'respuestaImagen';
  return jsonb_build_object('indice', p.ronda, 'total', jsonb_array_length(p.rondas), 'puntos', p.puntos) || r;
end;
$$;
revoke all on function public.partida_ronda(uuid) from public, anon;
grant execute on function public.partida_ronda(uuid) to authenticated;

-- Corrige la respuesta de la ronda en juego. p_respuesta: país (texto),
-- ingrediente (texto) o, en Armá el plato, la lista de ingredientes elegidos.
create or replace function public.partida_responder(p_id uuid, p_indice int, p_respuesta jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  p partidas;
  rd jsonb;
  reg jsonb;
  ms bigint;
  bien boolean := false;
  ganados int := 0;
  aciertos_ronda int := 0;
  errores int := 0;
  necesarios int;
  restante numeric;
  elegidos text[];
  terminada boolean;
begin
  select * into p from partidas where id = p_id and user_id = auth.uid() for update;
  if not found then raise exception 'Partida no encontrada.'; end if;
  if p.terminada_at is not null then raise exception 'La partida ya terminó.'; end if;
  if p_indice <> p.ronda or p.servida_at is null then raise exception 'Esa ronda no está en juego.'; end if;
  rd := p.rondas->p.ronda;
  reg := juego_reglas(p.juego, p.modo);
  ms := (extract(epoch from clock_timestamp() - p.servida_at) * 1000)::bigint;

  if p.juego = 'pais' then
    -- 0,6 s de margen por la demora de la conexión; pasado el tiempo (+3 s) no cuenta.
    restante := greatest(0, (reg->>'segundos')::numeric - greatest(0, ms - 600) / 1000.0);
    bien := jsonb_typeof(p_respuesta) = 'string' and p_respuesta #>> '{}' = rd->>'respuesta'
            and ms <= ((reg->>'segundos')::int + 3) * 1000;
    if bien then
      ganados := round((reg->>'puntos')::numeric / 2 + (reg->>'puntos')::numeric / 2 * (restante / (reg->>'segundos')::numeric));
    end if;
  elsif p.juego = 'falta' then
    bien := jsonb_typeof(p_respuesta) = 'string' and p_respuesta #>> '{}' = rd->>'respuesta';
    if bien then ganados := (reg->>'puntos')::int; end if;
  else
    necesarios := jsonb_array_length(rd->'respuesta');
    if jsonb_typeof(p_respuesta) = 'array' then
      -- Sólo cuentan ingredientes que estaban en la alacena, sin repetir y hasta los necesarios.
      elegidos := array(select distinct x from jsonb_array_elements_text(p_respuesta) x
                        where x in (select a->>'n' from jsonb_array_elements(rd->'alacena') a));
      elegidos := elegidos[1:necesarios];
    else
      elegidos := '{}';
    end if;
    select count(*) into aciertos_ronda from unnest(elegidos) x where x in (select jsonb_array_elements_text(rd->'respuesta'));
    errores := coalesce(array_length(elegidos, 1), 0) - aciertos_ronda;
    ganados := greatest(0, aciertos_ronda * (reg->>'acierto')::int - errores * (reg->>'error')::int);
    bien := aciertos_ronda = necesarios;
  end if;

  terminada := p.ronda + 1 >= jsonb_array_length(p.rondas);
  update partidas set
    ronda = ronda + 1,
    servida_at = null,
    puntos = puntos + ganados,
    aciertos = aciertos + case when bien then 1 else 0 end,
    ms_total = ms_total + ms,
    respuestas = respuestas || jsonb_build_array(jsonb_build_object('ms', ms, 'puntos', ganados, 'bien', bien)),
    terminada_at = case when terminada then clock_timestamp() end
  where id = p.id
  returning * into p;

  if terminada then
    -- Para las medallas y el historial, igual que antes.
    insert into actividad (user_id, tipo, detalle, puntos, dia)
    values (p.user_id, 'juego-' || p.juego, p.modo, least(p.puntos, 1000), p.dia);
  end if;

  return jsonb_build_object('bien', bien, 'ganados', ganados, 'puntos', p.puntos, 'aciertos', p.aciertos,
    'terminada', terminada, 'oficial', p.oficial, 'respuesta', rd->'respuesta', 'respuestaImagen', rd->'respuestaImagen',
    'aciertosRonda', aciertos_ronda, 'erroresRonda', errores);
end;
$$;
revoke all on function public.partida_responder(uuid, int, jsonb) from public, anon;
grant execute on function public.partida_responder(uuid, int, jsonb) to authenticated;

-- ---------- ranking del torneo ----------
-- Suma de las partidas oficiales del período. Desempate: menos tiempo total.
-- Devuelve el top 10 y, si la persona está más abajo, su puesto.
create or replace function public.torneo_ranking(p_numero int default null)
returns table (puesto bigint, user_id uuid, nombre text, puntos bigint, partidas bigint, segundos bigint, habilitado boolean, soy_yo boolean)
language sql stable security definer set search_path = public as $$
  with per as (
    select * from torneo_periodo(case when p_numero is null then null
      else (select inicio + (p_numero - 1) * dias from torneo_config where id = 1) end)),
  cfg as (select antiguedad_dias from torneo_config where id = 1),
  t as (
    select pa.user_id, sum(pa.puntos)::bigint as puntos, count(*) as partidas, (sum(pa.ms_total) / 1000)::bigint as segundos
    from partidas pa, per
    where pa.oficial and pa.dia between per.inicio and per.fin
    group by pa.user_id),
  tabla as (
    select rank() over (order by t.puntos desc, t.segundos asc) as puesto, t.user_id,
      coalesce(nullif(trim(u.raw_user_meta_data ->> 'nombre'), ''), 'Cocinero/a') as nombre,
      t.puntos, t.partidas, t.segundos,
      (exists (select 1 from torneo_inscripciones i where i.user_id = t.user_id)
        and u.created_at <= ((select fin from per) - (select antiguedad_dias from cfg))::timestamp + interval '1 day') as habilitado,
      t.user_id = auth.uid() as soy_yo
    from t join auth.users u on u.id = t.user_id),
  yo as (select min(puesto) as puesto from tabla where soy_yo)
  select tabla.* from tabla, yo
  where tabla.puesto <= 10 or tabla.soy_yo
  order by tabla.puesto, tabla.nombre
  limit 11;
$$;
grant execute on function public.torneo_ranking(int) to anon, authenticated;

-- Estado del torneo para la persona: período, si está inscripta y cuáles
-- partidas oficiales de hoy ya jugó.
create or replace function public.torneo_estado()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'numero', p.numero, 'inicio', p.inicio, 'fin', p.fin, 'hoy', dia_argentina(),
    'premioJuegos', c.premio_juegos, 'premioReceta', c.premio_receta, 'antiguedadDias', c.antiguedad_dias,
    'inscripto', exists (select 1 from torneo_inscripciones i where i.user_id = auth.uid()),
    'cuentaDesde', (select created_at from auth.users where id = auth.uid()),
    'oficialesHoy', coalesce((select jsonb_object_agg(juego, jsonb_build_object('puntos', puntos, 'terminada', terminada_at is not null))
      from partidas where user_id = auth.uid() and oficial and dia = dia_argentina()), '{}'::jsonb))
  from torneo_periodo() p, torneo_config c where c.id = 1;
$$;
grant execute on function public.torneo_estado() to anon, authenticated;

-- ---------- ganadores (públicos) ----------
create table if not exists public.ganadores (
  id          bigint generated always as identity primary key,
  tipo        text not null check (tipo in ('juegos', 'receta')),
  periodo     text not null,               -- "2026-10-05" (juegos) o "2026-10" (receta del mes)
  user_id     uuid references auth.users (id) on delete set null,
  nombre      text not null,               -- cómo se muestra
  receta_id   text,                        -- u-<uuid> para la receta del mes
  receta_nombre text,
  monto       int,
  pagado      boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (tipo, periodo)
);
alter table public.ganadores enable row level security;
drop policy if exists "Ver ganadores" on public.ganadores;
create policy "Ver ganadores" on public.ganadores for select to anon, authenticated using (true);
drop policy if exists "Administrar ganadores" on public.ganadores;
create policy "Administrar ganadores" on public.ganadores for all to authenticated
  using (exists (select 1 from public.administradores a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.administradores a where a.user_id = auth.uid()));

-- ---------- panel de administración ----------
-- Top 20 del período con datos para revisar antes de pagar: email, antigüedad,
-- tiempos sospechosos (respuestas en menos de 0,7 s) y cuentas que jugaron
-- desde el mismo dispositivo.
create or replace function public.torneo_admin(p_numero int default null)
returns table (puesto bigint, user_id uuid, nombre text, email text, puntos bigint, partidas bigint, segundos bigint,
               habilitado boolean, cuenta_desde timestamptz, respuestas_rapidas bigint, ms_minimo bigint, cuentas_mismo_dispositivo bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from administradores a where a.user_id = auth.uid()) then
    raise exception 'Sólo para administradores.';
  end if;
  return query
  with per as (
    select * from torneo_periodo(case when p_numero is null then null
      else (select inicio + (p_numero - 1) * dias from torneo_config where id = 1) end)),
  cfg as (select antiguedad_dias from torneo_config where id = 1),
  ofi as (select pa.* from partidas pa, per where pa.oficial and pa.dia between per.inicio and per.fin),
  t as (select o.user_id, sum(o.puntos)::bigint pts, count(*) n, (sum(o.ms_total) / 1000)::bigint seg from ofi o group by o.user_id),
  resp as (select o.user_id, (r->>'ms')::bigint ms from ofi o, jsonb_array_elements(o.respuestas) r),
  disp as (select distinct pa.user_id, pa.dispositivo from partidas pa, per
           where pa.dispositivo is not null and pa.dia between per.inicio - 30 and per.fin)
  select rank() over (order by t.pts desc, t.seg asc), t.user_id,
    coalesce(nullif(trim(u.raw_user_meta_data ->> 'nombre'), ''), 'Cocinero/a')::text, u.email::text,
    t.pts, t.n, t.seg,
    (exists (select 1 from torneo_inscripciones i where i.user_id = t.user_id)
      and u.created_at <= ((select fin from per) - (select antiguedad_dias from cfg))::timestamp + interval '1 day'),
    u.created_at,
    (select count(*) from resp where resp.user_id = t.user_id and resp.ms < 700),
    (select min(resp.ms) from resp where resp.user_id = t.user_id),
    (select count(distinct d2.user_id) from disp d1 join disp d2 on d1.dispositivo = d2.dispositivo and d2.user_id <> d1.user_id
     where d1.user_id = t.user_id)
  from t join auth.users u on u.id = t.user_id
  order by 1
  limit 20;
end;
$$;
revoke all on function public.torneo_admin(int) from public, anon;
grant execute on function public.torneo_admin(int) to authenticated;

-- Recetas de la comunidad publicadas en un mes (para elegir la receta del mes).
create or replace function public.receta_mes_candidatas(p_mes text)
returns table (id uuid, nombre text, autor text, user_id uuid, me_gusta bigint, creada timestamptz, imagen text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from administradores a where a.user_id = auth.uid()) then
    raise exception 'Sólo para administradores.';
  end if;
  return query
  select r.id, r.nombre, r.autor_nombre, r.user_id,
    (select count(*) from me_gusta m where m.receta_id = 'u-' || r.id::text), r.created_at, r.imagen_url
  from recetas r
  where r.publica and to_char(r.created_at at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM') = p_mes
    and not exists (select 1 from administradores a where a.user_id = r.user_id)
  order by 5 desc, r.created_at;
end;
$$;
revoke all on function public.receta_mes_candidatas(text) from public, anon;
grant execute on function public.receta_mes_candidatas(text) to authenticated;
