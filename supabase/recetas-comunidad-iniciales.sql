-- Recetas iniciales de la comunidad, publicadas por la cuenta oficial
-- "Equipo A Mano" (intersanti6@gmail.com). Se puede ejecutar más de una vez: no duplica.
-- La cuenta tiene que estar creada desde la web antes de ejecutar esto.

do $$
begin
  if not exists (select 1 from auth.users where email = 'intersanti6@gmail.com') then
    raise exception 'No existe una cuenta con el email intersanti6@gmail.com. Creala desde la web y volvé a ejecutar.';
  end if;
end $$;

-- Nombre visible de la cuenta y tilde de cuenta oficial.
update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('nombre', 'Equipo A Mano')
where email = 'intersanti6@gmail.com';
insert into public.cuentas_verificadas (user_id)
select id from auth.users where email = 'intersanti6@gmail.com'
on conflict do nothing;

insert into public.recetas (user_id, nombre, descripcion, categoria, origen, porciones, minutos, ingredientes, pasos, publica, autor_nombre)
select u.id, 'Salsa criolla', 'La compañera fresca del asado y el choripán: cebolla, tomate y morrón picados chiquitos con vinagre y aceite.', 'Side', 'Argentina', 6, 15,
  '[{"nombre": "Cebolla", "medida": "1 grande"}, {"nombre": "Tomate", "medida": "2 firmes"}, {"nombre": "Morrón rojo", "medida": "1/2"}, {"nombre": "Morrón verde", "medida": "1/2"}, {"nombre": "Vinagre de vino", "medida": "3 cdas"}, {"nombre": "Aceite", "medida": "5 cdas"}, {"nombre": "Orégano", "medida": "1 cdta"}, {"nombre": "Sal", "medida": "a gusto"}, {"nombre": "Pimienta", "medida": "a gusto"}]'::jsonb,
  '["Picar la cebolla, los morrones y el tomate sin semillas en cubos bien chicos, del mismo tamaño.", "Poner todo en un frasco o bol y condimentar con sal, pimienta y orégano.", "Agregar el vinagre y el aceite, mezclar y dejar reposar al menos 30 minutos en la heladera antes de servir.", "Se conserva 2 días en la heladera, en frasco cerrado."]'::jsonb,
  true, 'Equipo A Mano'
from auth.users u
where u.email = 'intersanti6@gmail.com'
  and not exists (select 1 from public.recetas x where x.user_id = u.id and x.nombre = 'Salsa criolla');

insert into public.recetas (user_id, nombre, descripcion, categoria, origen, porciones, minutos, ingredientes, pasos, publica, autor_nombre)
select u.id, 'Locro argentino', 'Guiso espeso de maíz blanco, porotos, zapallo y carnes, el plato de las fiestas patrias. Se prepara el día anterior.', 'Beef', 'Argentina', 8, 240,
  '[{"nombre": "Maíz blanco partido", "medida": "500 g"}, {"nombre": "Porotos blancos", "medida": "250 g"}, {"nombre": "Zapallo anco", "medida": "1 kg"}, {"nombre": "Falda de vaca", "medida": "500 g"}, {"nombre": "Panceta", "medida": "200 g"}, {"nombre": "Chorizo colorado", "medida": "2"}, {"nombre": "Cebolla", "medida": "2"}, {"nombre": "Cebolla de verdeo", "medida": "2 atados"}, {"nombre": "Pimentón dulce", "medida": "2 cdas"}, {"nombre": "Comino", "medida": "1 cdta"}, {"nombre": "Aceite", "medida": "4 cdas"}, {"nombre": "Ají molido", "medida": "1 cdta"}, {"nombre": "Sal", "medida": "a gusto"}]'::jsonb,
  '["La noche anterior, dejar el maíz y los porotos en remojo en agua fría, por separado.", "Colar, poner el maíz y los porotos en una olla grande con 4 litros de agua y hervir a fuego bajo 1 hora, revolviendo cada tanto.", "Sumar la falda y la panceta en cubos y el zapallo pelado en trozos. Cocinar 1 hora y media más, revolviendo seguido para que no se pegue: el zapallo se deshace y espesa.", "Agregar el chorizo colorado en rodajas y cocinar 30 minutos más. Ajustar la sal.", "Para la salsa (quiquirimichi): calentar el aceite, rehogar la cebolla de verdeo picada 5 minutos y apagar el fuego antes de sumar el pimentón, el comino y el ají molido, para que no se quemen.", "Servir el locro bien caliente con una cucharada de salsa por encima."]'::jsonb,
  true, 'Equipo A Mano'
from auth.users u
where u.email = 'intersanti6@gmail.com'
  and not exists (select 1 from public.recetas x where x.user_id = u.id and x.nombre = 'Locro argentino');

insert into public.recetas (user_id, nombre, descripcion, categoria, origen, porciones, minutos, ingredientes, pasos, publica, autor_nombre)
select u.id, 'Choripán con chimichurri', 'El clásico de la cancha y del asado: chorizo a la parrilla o a la plancha en pan crocante.', 'Pork', 'Argentina', 4, 30,
  '[{"nombre": "Chorizo parrillero", "medida": "4"}, {"nombre": "Pan francés o baguetín", "medida": "4"}, {"nombre": "Chimichurri", "medida": "8 cdas"}, {"nombre": "Salsa criolla", "medida": "opcional"}]'::jsonb,
  '["Cocinar los chorizos a la parrilla o en una plancha a fuego medio, dándolos vuelta cada tanto, unos 20 minutos.", "Para saber si están listos, cortar uno al medio: no tiene que quedar rosado adentro.", "Abrir los chorizos en mariposa y dorarlos 1 minuto más del lado del corte.", "Tostar apenas los panes abiertos, poner el chorizo y servir con chimichurri y, si hay, salsa criolla."]'::jsonb,
  true, 'Equipo A Mano'
from auth.users u
where u.email = 'intersanti6@gmail.com'
  and not exists (select 1 from public.recetas x where x.user_id = u.id and x.nombre = 'Choripán con chimichurri');

insert into public.recetas (user_id, nombre, descripcion, categoria, origen, porciones, minutos, ingredientes, pasos, publica, autor_nombre)
select u.id, 'Budín de pan', 'El postre de aprovechamiento por excelencia: pan del día anterior, leche y huevos, con caramelo.', 'Dessert', 'Uruguay', 8, 90,
  '[{"nombre": "Pan del día anterior", "medida": "300 g"}, {"nombre": "Leche", "medida": "1 litro"}, {"nombre": "Huevos", "medida": "4"}, {"nombre": "Azúcar", "medida": "200 g"}, {"nombre": "Esencia de vainilla", "medida": "1 cdta"}, {"nombre": "Ralladura de limón", "medida": "de 1 limón"}, {"nombre": "Pasas de uva", "medida": "50 g, opcional"}, {"nombre": "Azúcar para el caramelo", "medida": "150 g"}]'::jsonb,
  '["Remojar el pan en trozos con la leche tibia 20 minutos y pisarlo o procesarlo hasta que quede una pasta.", "Hacer el caramelo: cocinar los 150 g de azúcar en una sartén sin revolver hasta que esté dorado. Cuidado: quema mucho. Volcarlo en una budinera y girarla para cubrir los costados.", "Batir los huevos con el azúcar, la vainilla y la ralladura, y mezclar con el pan. Sumar las pasas.", "Volcar en la budinera y cocinar a baño María en el horno a 180 °C, 1 hora, hasta que un palillo salga seco.", "Dejar enfriar y llevar a la heladera al menos 4 horas antes de desmoldar."]'::jsonb,
  true, 'Equipo A Mano'
from auth.users u
where u.email = 'intersanti6@gmail.com'
  and not exists (select 1 from public.recetas x where x.user_id = u.id and x.nombre = 'Budín de pan');

insert into public.recetas (user_id, nombre, descripcion, categoria, origen, porciones, minutos, ingredientes, pasos, publica, autor_nombre)
select u.id, 'Sopaipillas pasadas', 'Sopaipillas de zapallo bañadas en chancaca con canela y clavo: lo que se come en Chile los días de lluvia.', 'Dessert', 'Chile', 6, 60,
  '[{"nombre": "Zapallo cocido y pisado", "medida": "1 taza"}, {"nombre": "Harina", "medida": "3 tazas"}, {"nombre": "Manteca derretida", "medida": "3 cdas"}, {"nombre": "Polvo de hornear", "medida": "1 cdta"}, {"nombre": "Sal", "medida": "1 pizca"}, {"nombre": "Chancaca o azúcar negra", "medida": "250 g"}, {"nombre": "Agua", "medida": "2 tazas"}, {"nombre": "Canela en rama", "medida": "1"}, {"nombre": "Clavo de olor", "medida": "3"}, {"nombre": "Aceite para freír", "medida": "cantidad necesaria"}]'::jsonb,
  '["Mezclar el zapallo, la manteca, la harina, el polvo de hornear y la sal hasta formar una masa blanda. Dejarla descansar tapada 15 minutos.", "Estirar de medio centímetro, cortar círculos y pincharlos con un tenedor.", "Freírlas en aceite caliente, de a pocas, hasta que se inflen y doren de los dos lados. Escurrir sobre papel.", "Hervir el agua con la chancaca, la canela y el clavo hasta que espese un poco, unos 10 minutos.", "Pasar las sopaipillas por el almíbar caliente 1 o 2 minutos y servir enseguida con un poco del almíbar."]'::jsonb,
  true, 'Equipo A Mano'
from auth.users u
where u.email = 'intersanti6@gmail.com'
  and not exists (select 1 from public.recetas x where x.user_id = u.id and x.nombre = 'Sopaipillas pasadas');

insert into public.recetas (user_id, nombre, descripcion, categoria, origen, porciones, minutos, ingredientes, pasos, publica, autor_nombre)
select u.id, 'Pastel de choclo', 'Pino de carne con pollo, huevo y aceitunas, tapado con pastelera de choclo dorada con azúcar.', 'Beef', 'Chile', 6, 90,
  '[{"nombre": "Choclo desgranado", "medida": "1 kg (unos 8 choclos)"}, {"nombre": "Albahaca", "medida": "1 puñado"}, {"nombre": "Leche", "medida": "1/2 taza"}, {"nombre": "Manteca", "medida": "2 cdas"}, {"nombre": "Carne picada", "medida": "500 g"}, {"nombre": "Cebolla", "medida": "2"}, {"nombre": "Comino", "medida": "1 cdta"}, {"nombre": "Pimentón dulce", "medida": "1 cdta"}, {"nombre": "Pollo cocido desmenuzado", "medida": "1 pechuga"}, {"nombre": "Huevos duros", "medida": "2"}, {"nombre": "Aceitunas negras", "medida": "12"}, {"nombre": "Pasas de uva", "medida": "opcional"}, {"nombre": "Azúcar", "medida": "2 cdas"}, {"nombre": "Sal", "medida": "a gusto"}]'::jsonb,
  '["Pino: rehogar la cebolla picada en aceite, sumar la carne, el comino y el pimentón y cocinar hasta que no quede rosada. Salar.", "Pastelera: procesar el choclo con la albahaca y la leche. Cocinar en una olla con la manteca, revolviendo, unos 10 minutos hasta que espese. Salar.", "En una fuente para horno, poner el pino, el pollo, los huevos en rodajas, las aceitunas y las pasas.", "Cubrir con la pastelera, espolvorear con el azúcar y hornear a 200 °C unos 30 minutos, hasta que la superficie esté dorada."]'::jsonb,
  true, 'Equipo A Mano'
from auth.users u
where u.email = 'intersanti6@gmail.com'
  and not exists (select 1 from public.recetas x where x.user_id = u.id and x.nombre = 'Pastel de choclo');

insert into public.recetas (user_id, nombre, descripcion, categoria, origen, porciones, minutos, ingredientes, pasos, publica, autor_nombre)
select u.id, 'Arroz chaufa', 'Arroz salteado al estilo chifa, la cocina chino-peruana: pollo, huevo, cebolla china y sillao.', 'Chicken', 'Perú', 4, 30,
  '[{"nombre": "Arroz cocido del día anterior", "medida": "4 tazas"}, {"nombre": "Pechuga de pollo", "medida": "1"}, {"nombre": "Huevos", "medida": "3"}, {"nombre": "Cebolla de verdeo", "medida": "1 atado"}, {"nombre": "Morrón rojo", "medida": "1/2"}, {"nombre": "Ajo", "medida": "2 dientes"}, {"nombre": "Jengibre rallado", "medida": "1 cdta"}, {"nombre": "Salsa de soja", "medida": "4 cdas"}, {"nombre": "Aceite de sésamo", "medida": "1 cdta, opcional"}, {"nombre": "Aceite", "medida": "3 cdas"}]'::jsonb,
  '["Cortar el pollo en cubos chicos, salarlo y dorarlo en una sartén grande o wok bien caliente con 1 cucharada de aceite. Reservar.", "Batir los huevos, hacer una tortilla fina, cortarla en tiras y reservar.", "En la misma sartén con el resto del aceite, saltear el ajo, el jengibre, el morrón y la parte blanca del verdeo 2 minutos.", "Sumar el arroz frío y saltear a fuego fuerte, moviendo todo el tiempo, 5 minutos.", "Agregar el pollo, el huevo, la salsa de soja y la parte verde del verdeo. Mezclar, sumar el aceite de sésamo y servir."]'::jsonb,
  true, 'Equipo A Mano'
from auth.users u
where u.email = 'intersanti6@gmail.com'
  and not exists (select 1 from public.recetas x where x.user_id = u.id and x.nombre = 'Arroz chaufa');

insert into public.recetas (user_id, nombre, descripcion, categoria, origen, porciones, minutos, ingredientes, pasos, publica, autor_nombre)
select u.id, 'Tacos al pastor de sartén', 'La versión casera del taco al pastor, sin trompo: cerdo adobado con chile y achiote, piña y cilantro.', 'Pork', 'México', 4, 40,
  '[{"nombre": "Bondiola o carré de cerdo", "medida": "700 g"}, {"nombre": "Chile guajillo seco", "medida": "3"}, {"nombre": "Achiote en pasta", "medida": "2 cdas"}, {"nombre": "Jugo de naranja", "medida": "1/2 taza"}, {"nombre": "Vinagre", "medida": "2 cdas"}, {"nombre": "Ajo", "medida": "3 dientes"}, {"nombre": "Comino", "medida": "1/2 cdta"}, {"nombre": "Orégano", "medida": "1 cdta"}, {"nombre": "Ananá", "medida": "4 rodajas"}, {"nombre": "Tortillas de maíz", "medida": "12"}, {"nombre": "Cebolla blanca", "medida": "1"}, {"nombre": "Cilantro", "medida": "1 puñado"}, {"nombre": "Lima", "medida": "2"}, {"nombre": "Sal", "medida": "a gusto"}]'::jsonb,
  '["Hidratar los chiles sin semillas en agua caliente 10 minutos. Licuarlos con el achiote, el jugo de naranja, el vinagre, el ajo, el comino, el orégano y sal.", "Cortar el cerdo en láminas finas, cubrirlas con el adobo y dejar en la heladera al menos 1 hora (mejor toda la noche).", "Cocinar el cerdo en una sartén bien caliente, de a poco para que se dore y no se hierva, hasta que no quede rosado. Picarlo.", "Dorar el ananá en la misma sartén y cortarlo en cubitos.", "Calentar las tortillas y armar los tacos con la carne, el ananá, cebolla y cilantro picados y unas gotas de lima."]'::jsonb,
  true, 'Equipo A Mano'
from auth.users u
where u.email = 'intersanti6@gmail.com'
  and not exists (select 1 from public.recetas x where x.user_id = u.id and x.nombre = 'Tacos al pastor de sartén');

insert into public.recetas (user_id, nombre, descripcion, categoria, origen, porciones, minutos, ingredientes, pasos, publica, autor_nombre)
select u.id, 'Enfrijoladas', 'Tortillas bañadas en crema de frijoles, dobladas y rellenas de queso: comida casera, rápida y económica.', 'Vegetarian', 'México', 4, 30,
  '[{"nombre": "Frijoles negros cocidos", "medida": "3 tazas con su caldo"}, {"nombre": "Tortillas de maíz", "medida": "12"}, {"nombre": "Chile chipotle", "medida": "1, opcional"}, {"nombre": "Ajo", "medida": "1 diente"}, {"nombre": "Cebolla", "medida": "1/2"}, {"nombre": "Queso fresco", "medida": "200 g"}, {"nombre": "Crema", "medida": "1/2 taza"}, {"nombre": "Aceite", "medida": "cantidad necesaria"}, {"nombre": "Sal", "medida": "a gusto"}]'::jsonb,
  '["Licuar los frijoles con su caldo, el ajo, un trozo de cebolla y el chipotle hasta que quede una crema. Calentarla en una sartén 5 minutos y salar: tiene que quedar como una salsa espesa.", "Pasar las tortillas por una sartén con muy poco aceite, solo para ablandarlas.", "Sumergir cada tortilla en la crema de frijoles, rellenar con queso desmenuzado y doblar al medio.", "Servir con más salsa por encima, crema, queso y aros de cebolla."]'::jsonb,
  true, 'Equipo A Mano'
from auth.users u
where u.email = 'intersanti6@gmail.com'
  and not exists (select 1 from public.recetas x where x.user_id = u.id and x.nombre = 'Enfrijoladas');

insert into public.recetas (user_id, nombre, descripcion, categoria, origen, porciones, minutos, ingredientes, pasos, publica, autor_nombre)
select u.id, 'Patacones', 'Plátano verde frito dos veces y aplastado: crocante por fuera y tierno por dentro. También se les dice tostones.', 'Side', 'Colombia', 4, 25,
  '[{"nombre": "Plátano verde (macho)", "medida": "2"}, {"nombre": "Aceite para freír", "medida": "cantidad necesaria"}, {"nombre": "Sal", "medida": "a gusto"}, {"nombre": "Ajo", "medida": "1 diente, opcional"}]'::jsonb,
  '["Pelar los plátanos (cortar las puntas y hacer un corte a lo largo de la cáscara) y cortarlos en rodajas de 3 cm.", "Freírlas en aceite a fuego medio unos 5 minutos, hasta que estén tiernas pero sin dorar. Escurrir.", "Aplastar cada rodaja con el fondo de un vaso o entre dos platos hasta dejarla de 1 cm.", "Si se quiere, pasarlas por agua con sal y ajo machacado y secarlas bien: el aceite salpica con la humedad.", "Freír otra vez en aceite bien caliente hasta que estén doradas y crocantes. Salar y servir enseguida."]'::jsonb,
  true, 'Equipo A Mano'
from auth.users u
where u.email = 'intersanti6@gmail.com'
  and not exists (select 1 from public.recetas x where x.user_id = u.id and x.nombre = 'Patacones');

insert into public.recetas (user_id, nombre, descripcion, categoria, origen, porciones, minutos, ingredientes, pasos, publica, autor_nombre)
select u.id, 'Arepas reina pepiada', 'Arepas rellenas de ensalada de pollo con palta y mayonesa, un clásico de las areperas venezolanas.', 'Chicken', 'Venezuela', 6, 45,
  '[{"nombre": "Harina de maíz precocida", "medida": "2 tazas"}, {"nombre": "Agua tibia", "medida": "2 1/2 tazas"}, {"nombre": "Sal", "medida": "1 cdta"}, {"nombre": "Pechuga de pollo cocida", "medida": "2"}, {"nombre": "Palta madura", "medida": "2"}, {"nombre": "Mayonesa", "medida": "3 cdas"}, {"nombre": "Cebolla morada", "medida": "1/4"}, {"nombre": "Cilantro", "medida": "1 puñado"}, {"nombre": "Jugo de limón", "medida": "1 cda"}, {"nombre": "Pimienta", "medida": "a gusto"}]'::jsonb,
  '["Mezclar el agua con la sal y agregar la harina de a poco, amasando hasta que no se pegue en las manos. Dejar reposar 5 minutos.", "Formar 6 bollos, aplastarlos en discos de 1,5 cm y cocinarlos en una plancha o sartén a fuego medio, 8 minutos de cada lado, hasta que suenen huecos al golpearlos.", "Pisar la palta con el limón y mezclar con el pollo desmenuzado, la mayonesa, la cebolla y el cilantro picados. Salar y pimentar.", "Abrir las arepas calientes con un cuchillo y rellenarlas bien."]'::jsonb,
  true, 'Equipo A Mano'
from auth.users u
where u.email = 'intersanti6@gmail.com'
  and not exists (select 1 from public.recetas x where x.user_id = u.id and x.nombre = 'Arepas reina pepiada');

insert into public.recetas (user_id, nombre, descripcion, categoria, origen, porciones, minutos, ingredientes, pasos, publica, autor_nombre)
select u.id, 'Ropa vieja', 'Carne deshilachada en salsa de tomate con morrones: el plato nacional de Cuba, con arroz blanco y plátano.', 'Beef', 'Cuba', 6, 150,
  '[{"nombre": "Falda o matambre", "medida": "1 kg"}, {"nombre": "Hoja de laurel", "medida": "2"}, {"nombre": "Cebolla", "medida": "2"}, {"nombre": "Morrón rojo", "medida": "1"}, {"nombre": "Morrón verde", "medida": "1"}, {"nombre": "Ajo", "medida": "4 dientes"}, {"nombre": "Tomate triturado", "medida": "400 g"}, {"nombre": "Comino", "medida": "1 cdta"}, {"nombre": "Orégano", "medida": "1 cdta"}, {"nombre": "Vino blanco", "medida": "1/2 taza"}, {"nombre": "Aceitunas verdes", "medida": "opcional"}, {"nombre": "Aceite", "medida": "3 cdas"}, {"nombre": "Sal", "medida": "a gusto"}]'::jsonb,
  '["Hervir la carne con agua, el laurel, media cebolla y sal, a fuego bajo, 1 hora y media o hasta que se deshaga con un tenedor. Reservar 1 taza del caldo.", "Dejar entibiar y deshilachar la carne con dos tenedores.", "En una olla, rehogar en aceite la cebolla, los morrones en tiras y el ajo, 8 minutos.", "Sumar el comino, el orégano, el vino y el tomate, y cocinar 10 minutos.", "Agregar la carne y el caldo reservado, y cocinar 15 minutos más, hasta que la salsa espese. Sumar las aceitunas y servir con arroz."]'::jsonb,
  true, 'Equipo A Mano'
from auth.users u
where u.email = 'intersanti6@gmail.com'
  and not exists (select 1 from public.recetas x where x.user_id = u.id and x.nombre = 'Ropa vieja');

insert into public.recetas (user_id, nombre, descripcion, categoria, origen, porciones, minutos, ingredientes, pasos, publica, autor_nombre)
select u.id, 'Gallo pinto', 'Arroz y frijoles salteados con cebolla, morrón y cilantro: el desayuno de todos los días en Costa Rica y Nicaragua.', 'Vegetarian', 'Costa Rica', 4, 25,
  '[{"nombre": "Arroz cocido del día anterior", "medida": "3 tazas"}, {"nombre": "Frijoles negros cocidos", "medida": "2 tazas con un poco de caldo"}, {"nombre": "Cebolla", "medida": "1"}, {"nombre": "Morrón rojo", "medida": "1/2"}, {"nombre": "Ajo", "medida": "2 dientes"}, {"nombre": "Salsa inglesa", "medida": "2 cdas"}, {"nombre": "Cilantro", "medida": "1 puñado"}, {"nombre": "Aceite", "medida": "2 cdas"}, {"nombre": "Sal", "medida": "a gusto"}]'::jsonb,
  '["Rehogar en aceite la cebolla, el morrón y el ajo picados, 5 minutos.", "Sumar los frijoles con media taza de su caldo y la salsa inglesa, y cocinar 5 minutos.", "Agregar el arroz y mezclar con cuidado hasta que tome el color de los frijoles y se seque un poco.", "Sumar el cilantro picado, ajustar la sal y servir con huevo frito, queso o plátano maduro."]'::jsonb,
  true, 'Equipo A Mano'
from auth.users u
where u.email = 'intersanti6@gmail.com'
  and not exists (select 1 from public.recetas x where x.user_id = u.id and x.nombre = 'Gallo pinto');

insert into public.recetas (user_id, nombre, descripcion, categoria, origen, porciones, minutos, ingredientes, pasos, publica, autor_nombre)
select u.id, 'Pão de queijo', 'Pancitos de queso de Minas Gerais, hechos con almidón de mandioca: crocantes afuera y elásticos adentro, sin gluten.', 'Side', 'Brasil', 6, 45,
  '[{"nombre": "Almidón de mandioca (fécula)", "medida": "500 g"}, {"nombre": "Leche", "medida": "1 taza"}, {"nombre": "Aceite", "medida": "1/2 taza"}, {"nombre": "Agua", "medida": "1/2 taza"}, {"nombre": "Huevos", "medida": "2"}, {"nombre": "Queso rallado duro (tipo parmesano o reggianito)", "medida": "200 g"}, {"nombre": "Sal", "medida": "1 cdta"}]'::jsonb,
  '["Hervir la leche con el agua, el aceite y la sal. Volcar de golpe sobre el almidón y mezclar con cuchara: queda grumoso. Dejar entibiar.", "Sumar los huevos de a uno, amasando, y después el queso, hasta tener una masa pegajosa y lisa.", "Con las manos aceitadas, formar bolitas de 3 cm y ponerlas separadas en una placa.", "Hornear a 200 °C unos 25 minutos, hasta que estén infladas y apenas doradas. Comerlos tibios."]'::jsonb,
  true, 'Equipo A Mano'
from auth.users u
where u.email = 'intersanti6@gmail.com'
  and not exists (select 1 from public.recetas x where x.user_id = u.id and x.nombre = 'Pão de queijo');

insert into public.recetas (user_id, nombre, descripcion, categoria, origen, porciones, minutos, ingredientes, pasos, publica, autor_nombre)
select u.id, 'Brigadeiros', 'Bocaditos de leche condensada y cacao cubiertos de granas: no falta en ningún cumpleaños brasileño.', 'Dessert', 'Brasil', 20, 40,
  '[{"nombre": "Leche condensada", "medida": "1 lata (395 g)"}, {"nombre": "Cacao amargo", "medida": "2 cdas"}, {"nombre": "Manteca", "medida": "1 cda"}, {"nombre": "Granas de chocolate", "medida": "cantidad necesaria"}]'::jsonb,
  '["Poner la leche condensada, el cacao y la manteca en una olla y cocinar a fuego bajo, revolviendo sin parar.", "A los 10 o 15 minutos la mezcla espesa y se despega del fondo: al inclinar la olla, se mueve toda junta. Ahí está lista.", "Pasarla a un plato enmantecado y dejar enfriar por completo.", "Con las manos enmantecadas, formar bolitas y pasarlas por las granas. Servir en pirotines."]'::jsonb,
  true, 'Equipo A Mano'
from auth.users u
where u.email = 'intersanti6@gmail.com'
  and not exists (select 1 from public.recetas x where x.user_id = u.id and x.nombre = 'Brigadeiros');
