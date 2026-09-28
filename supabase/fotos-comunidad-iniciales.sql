-- Fotos de Wikimedia Commons para las recetas iniciales de la comunidad
-- (cuenta intersanti6@gmail.com). Ejecutar después de recetas-comunidad-iniciales.sql.
-- Se puede ejecutar más de una vez: actualiza la foto si ya estaba.

insert into public.fotos_recetas (receta_id, url, credito)
select 'u-' || r.id, 'https://commons.wikimedia.org/wiki/Special:FilePath/Locro_argentino.jpg?width=800', 'Wikimedia Commons (ver autor y licencia) https://commons.wikimedia.org/wiki/File:Locro_argentino.jpg'
from public.recetas r join auth.users u on u.id = r.user_id
where u.email = 'intersanti6@gmail.com' and r.nombre = 'Locro argentino'
on conflict (receta_id) do update set url = excluded.url, credito = excluded.credito, updated_at = now();

insert into public.fotos_recetas (receta_id, url, credito)
select 'u-' || r.id, 'https://commons.wikimedia.org/wiki/Special:FilePath/Choripan_mariposa.jpg?width=800', 'Wikimedia Commons (ver autor y licencia) https://commons.wikimedia.org/wiki/File:Choripan_mariposa.jpg'
from public.recetas r join auth.users u on u.id = r.user_id
where u.email = 'intersanti6@gmail.com' and r.nombre = 'Choripán con chimichurri'
on conflict (receta_id) do update set url = excluded.url, credito = excluded.credito, updated_at = now();

insert into public.fotos_recetas (receta_id, url, credito)
select 'u-' || r.id, 'https://commons.wikimedia.org/wiki/Special:FilePath/Bud%C3%ADn_de_pan.jpg?width=800', 'Wikimedia Commons (ver autor y licencia) https://commons.wikimedia.org/wiki/File:Bud%C3%ADn_de_pan.jpg'
from public.recetas r join auth.users u on u.id = r.user_id
where u.email = 'intersanti6@gmail.com' and r.nombre = 'Budín de pan'
on conflict (receta_id) do update set url = excluded.url, credito = excluded.credito, updated_at = now();

insert into public.fotos_recetas (receta_id, url, credito)
select 'u-' || r.id, 'https://commons.wikimedia.org/wiki/Special:FilePath/Sopaipillas_chilenas.jpg?width=800', 'Wikimedia Commons (ver autor y licencia) https://commons.wikimedia.org/wiki/File:Sopaipillas_chilenas.jpg'
from public.recetas r join auth.users u on u.id = r.user_id
where u.email = 'intersanti6@gmail.com' and r.nombre = 'Sopaipillas pasadas'
on conflict (receta_id) do update set url = excluded.url, credito = excluded.credito, updated_at = now();

insert into public.fotos_recetas (receta_id, url, credito)
select 'u-' || r.id, 'https://commons.wikimedia.org/wiki/Special:FilePath/Pastel_de_choclo_01.JPG?width=800', 'Wikimedia Commons (ver autor y licencia) https://commons.wikimedia.org/wiki/File:Pastel_de_choclo_01.JPG'
from public.recetas r join auth.users u on u.id = r.user_id
where u.email = 'intersanti6@gmail.com' and r.nombre = 'Pastel de choclo'
on conflict (receta_id) do update set url = excluded.url, credito = excluded.credito, updated_at = now();

insert into public.fotos_recetas (receta_id, url, credito)
select 'u-' || r.id, 'https://commons.wikimedia.org/wiki/Special:FilePath/Arroz_chaufa.JPG?width=800', 'Wikimedia Commons (ver autor y licencia) https://commons.wikimedia.org/wiki/File:Arroz_chaufa.JPG'
from public.recetas r join auth.users u on u.id = r.user_id
where u.email = 'intersanti6@gmail.com' and r.nombre = 'Arroz chaufa'
on conflict (receta_id) do update set url = excluded.url, credito = excluded.credito, updated_at = now();

insert into public.fotos_recetas (receta_id, url, credito)
select 'u-' || r.id, 'https://commons.wikimedia.org/wiki/Special:FilePath/01_Tacos_al_Pastor.jpg?width=800', 'Wikimedia Commons (ver autor y licencia) https://commons.wikimedia.org/wiki/File:01_Tacos_al_Pastor.jpg'
from public.recetas r join auth.users u on u.id = r.user_id
where u.email = 'intersanti6@gmail.com' and r.nombre = 'Tacos al pastor de sartén'
on conflict (receta_id) do update set url = excluded.url, credito = excluded.credito, updated_at = now();

insert into public.fotos_recetas (receta_id, url, credito)
select 'u-' || r.id, 'https://commons.wikimedia.org/wiki/Special:FilePath/Patacones.JPG?width=800', 'Wikimedia Commons (ver autor y licencia) https://commons.wikimedia.org/wiki/File:Patacones.JPG'
from public.recetas r join auth.users u on u.id = r.user_id
where u.email = 'intersanti6@gmail.com' and r.nombre = 'Patacones'
on conflict (receta_id) do update set url = excluded.url, credito = excluded.credito, updated_at = now();

insert into public.fotos_recetas (receta_id, url, credito)
select 'u-' || r.id, 'https://commons.wikimedia.org/wiki/Special:FilePath/Arepa-reina-pepiada-arepasdelgringo.jpg?width=800', 'Wikimedia Commons (ver autor y licencia) https://commons.wikimedia.org/wiki/File:Arepa-reina-pepiada-arepasdelgringo.jpg'
from public.recetas r join auth.users u on u.id = r.user_id
where u.email = 'intersanti6@gmail.com' and r.nombre = 'Arepas reina pepiada'
on conflict (receta_id) do update set url = excluded.url, credito = excluded.credito, updated_at = now();

insert into public.fotos_recetas (receta_id, url, credito)
select 'u-' || r.id, 'https://commons.wikimedia.org/wiki/Special:FilePath/MayasNOLARopaVieja.jpg?width=800', 'Wikimedia Commons (ver autor y licencia) https://commons.wikimedia.org/wiki/File:MayasNOLARopaVieja.jpg'
from public.recetas r join auth.users u on u.id = r.user_id
where u.email = 'intersanti6@gmail.com' and r.nombre = 'Ropa vieja'
on conflict (receta_id) do update set url = excluded.url, credito = excluded.credito, updated_at = now();

insert into public.fotos_recetas (receta_id, url, credito)
select 'u-' || r.id, 'https://commons.wikimedia.org/wiki/Special:FilePath/Costa_Rican_Gallo_Pinto.jpg?width=800', 'Wikimedia Commons (ver autor y licencia) https://commons.wikimedia.org/wiki/File:Costa_Rican_Gallo_Pinto.jpg'
from public.recetas r join auth.users u on u.id = r.user_id
where u.email = 'intersanti6@gmail.com' and r.nombre = 'Gallo pinto'
on conflict (receta_id) do update set url = excluded.url, credito = excluded.credito, updated_at = now();

insert into public.fotos_recetas (receta_id, url, credito)
select 'u-' || r.id, 'https://commons.wikimedia.org/wiki/Special:FilePath/P%C3%A3o_de_queijo.jpg?width=800', 'Wikimedia Commons (ver autor y licencia) https://commons.wikimedia.org/wiki/File:P%C3%A3o_de_queijo.jpg'
from public.recetas r join auth.users u on u.id = r.user_id
where u.email = 'intersanti6@gmail.com' and r.nombre = 'Pão de queijo'
on conflict (receta_id) do update set url = excluded.url, credito = excluded.credito, updated_at = now();

insert into public.fotos_recetas (receta_id, url, credito)
select 'u-' || r.id, 'https://commons.wikimedia.org/wiki/Special:FilePath/Brigadeiro.jpg?width=800', 'Wikimedia Commons (ver autor y licencia) https://commons.wikimedia.org/wiki/File:Brigadeiro.jpg'
from public.recetas r join auth.users u on u.id = r.user_id
where u.email = 'intersanti6@gmail.com' and r.nombre = 'Brigadeiros'
on conflict (receta_id) do update set url = excluded.url, credito = excluded.credito, updated_at = now();
