// /privacidad y /terminos. Borrador escrito a partir de lo que la web hace de
// verdad (datos que guarda, servicios que usa). Conviene que lo revise una
// persona que sepa de temas legales. Si algo cambia en la web, actualizar acá
// y la fecha.
import { el, mostrar } from '../dom.js';
import { CONTACTO } from '../config.js';

const ACTUALIZADO = '28 de septiembre de 2026';

// Bloques: 'texto' | ['lista', ...items] | ['h2', 'título']
function pagina(titulo, bloques) {
  return el('article', { class: 'legal' },
    el('a', { class: 'volver', href: '/' }, '← Inicio'),
    el('h1', {}, titulo),
    el('p', { class: 'meta' }, `Última actualización: ${ACTUALIZADO}.`),
    bloques.map((b) => {
      if (Array.isArray(b) && b[0] === 'h2') return el('h2', {}, b[1]);
      if (Array.isArray(b) && b[0] === 'lista') return el('ul', {}, b.slice(1).map((i) => el('li', {}, i)));
      return el('p', {}, b);
    }));
}

const contacto = () => (CONTACTO
  ? el('a', { href: `mailto:${CONTACTO}` }, CONTACTO)
  : 'el email de contacto que se publicará en esta página');

export function vistaPrivacidad() {
  document.title = 'Política de privacidad · A Mano';
  mostrar(pagina('Política de privacidad', [
    'A Mano (amanorecetas.com.ar) es una web de recetas latinoamericanas. Esta política explica qué datos se guardan, para qué, dónde y qué derechos tiene cada persona sobre ellos. Se rige por la Ley 25.326 de Protección de Datos Personales de la República Argentina.',

    ['h2', 'Sin cuenta'],
    'Para ver y cocinar recetas no hace falta registrarse. En ese caso A Mano no pide ningún dato personal. Algunas preferencias se guardan sólo en el propio navegador (almacenamiento local), no en nuestros servidores:',
    ['lista',
      'modo claro u oscuro, trato (neutro, vos o tú) y país elegido;',
      'ingredientes cargados en "¿Qué hay a mano?", el avance del modo cocina y los temporizadores;',
      'resultados y récords de los juegos, y la charla con Manitas mientras la pestaña está abierta.'],
    'Se pueden borrar en cualquier momento desde la configuración del navegador ("borrar datos de sitios"). A Mano no usa cookies de publicidad ni de seguimiento.',

    ['h2', 'Con cuenta'],
    'Al crear una cuenta se guardan:',
    ['lista',
      'email y contraseña (la contraseña se guarda cifrada; nadie de A Mano puede verla) y el nombre que se elija mostrar;',
      'las recetas que se suben, con sus fotos, y si son públicas o privadas;',
      'los "me gusta", las recetas completadas en el modo cocina y los puntos de los juegos (para las medallas y el ranking semanal);',
      'las preferencias de trato y país;',
      'cuántos mensajes se le mandaron a Manitas en el día (sólo la cantidad, para el límite diario).'],
    'Es público: el nombre visible, las recetas marcadas como públicas y el lugar en el ranking de los juegos (nombre, país y puntos). El email nunca se muestra.',

    ['h2', 'Manitas, el asistente con inteligencia artificial'],
    'Manitas usa servicios gratuitos de inteligencia artificial de terceros: Groq y Google Gemini. Cuando se le escribe, se envían a esos servicios el texto de la charla, la receta que se está mirando (si hay una), el país y el trato elegidos. No se envía el email ni el nombre. En sus planes gratuitos, estos proveedores pueden usar las conversaciones para mejorar sus productos, por eso conviene no escribirle datos personales a Manitas. Las respuestas las genera una IA y pueden tener errores.',

    ['h2', 'Dónde se guardan y quién más interviene'],
    ['lista',
      'Supabase: base de datos, cuentas y fotos subidas.',
      'Vercel: aloja la web.',
      'Groq y Google (Gemini): respuestas de Manitas.',
      'Google Fonts: tipografías de la web.',
      'TheMealDB, Wikimedia Commons y flagcdn.com: fotos de recetas, ingredientes y banderas.',
      'Si está activada, una analítica sin cookies (Plausible o Cloudflare Web Analytics) que cuenta visitas y usos generales (por ejemplo, cuántas veces se usó "¿Qué hay a mano?"), sin identificar a nadie.'],
    'Estos servicios pueden estar fuera de la Argentina, por lo que los datos pueden alojarse en otros países. A Mano no vende ni alquila datos personales y no los usa para publicidad.',

    ['h2', 'Para qué se usan'],
    'Sólo para que la web funcione: iniciar sesión, guardar y mostrar recetas, calcular medallas y rankings, recordar preferencias, responder con Manitas y entender qué partes de la web se usan para mejorarlas.',

    ['h2', 'Cuánto tiempo se guardan'],
    'Mientras la cuenta exista. Las recetas propias se pueden borrar en cualquier momento desde la web. Para borrar la cuenta completa con todos sus datos, hay que pedirlo por email (ver abajo) y se hace dentro de los 10 días hábiles.',

    ['h2', 'Derechos'],
    ['Cada persona puede pedir acceso a sus datos, corregirlos, actualizarlos o borrarlos, escribiendo a ', contacto(), '. '],
    'El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto conforme lo establecido en el artículo 14, inciso 3 de la Ley N° 25.326. La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.',

    ['h2', 'Menores de edad'],
    'Para crear una cuenta hay que tener al menos 13 años. Entre los 13 y los 18 años, con el acuerdo de una madre, padre o persona adulta responsable.',

    ['h2', 'Cambios'],
    'Si esta política cambia, se actualiza en esta página con la fecha nueva. Si el cambio es importante, se avisa en la web.',

    ['h2', 'Contacto'],
    ['Consultas sobre privacidad: ', contacto(), '.'],
  ]));
}

export function vistaTerminos() {
  document.title = 'Términos y condiciones · A Mano';
  mostrar(pagina('Términos y condiciones', [
    'Estos términos regulan el uso de A Mano (amanorecetas.com.ar). Usar la web implica aceptarlos. Crear una cuenta también implica aceptar la Política de privacidad.',

    ['h2', 'Qué es A Mano'],
    'Una web gratuita de recetas, con herramientas para cocinar (modo cocina, temporizadores, "¿Qué hay a mano?"), un asistente con inteligencia artificial (Manitas), juegos y una comunidad donde se pueden compartir recetas.',

    ['h2', 'Recetas e información de cocina'],
    'Las recetas, los tiempos, las dificultades y los reemplazos son orientativos. Cada persona es responsable de cocinar de forma segura: controlar la cocción de carnes, huevos y pescados, el manejo del fuego, el aceite caliente y los cuchillos, y revisar los ingredientes si tiene alergias, intolerancias o indicaciones médicas o nutricionales. A Mano no da consejos médicos ni nutricionales.',

    ['h2', 'Manitas'],
    'Las respuestas de Manitas las genera una inteligencia artificial y pueden ser incorrectas o incompletas. No reemplazan el criterio propio ni la consulta con profesionales. Hay un límite de mensajes por día y el servicio puede no estar disponible en algunos momentos.',

    ['h2', 'Cuentas'],
    'Cada persona es responsable de los datos que carga y de cuidar su contraseña. A Mano puede suspender o borrar cuentas que incumplan estos términos.',

    ['h2', 'Contenido que suben las personas usuarias'],
    'Quien sube una receta o una foto declara que es propia o que tiene permiso para publicarla. Sigue siendo de quien la subió, y le da a A Mano permiso gratuito para mostrarla en la web (y, si es pública, para que otras personas la vean, la cocinen y la compartan con un enlace) mientras no la borre.',
    'No se permite subir contenido que:',
    ['lista',
      'copie recetas, textos o fotos de otros sitios o libros sin permiso;',
      'sea ofensivo, discriminatorio, violento o sexual;',
      'tenga datos personales de otras personas;',
      'promocione productos o servicios sin relación con la cocina, o sea spam.'],
    ['A Mano puede quitar contenido que no cumpla estas reglas. Para avisar de un contenido que infringe derechos, escribir a ', contacto(), '.'],

    ['h2', 'Contenido de terceros'],
    'Parte de las recetas del mundo y de las imágenes de ingredientes vienen de TheMealDB, y algunas fotos de Wikimedia Commons, con su licencia y crédito en cada receta. Los enlaces a otros sitios se ofrecen como referencia; A Mano no controla su contenido.',

    ['h2', 'Marca y diseño'],
    'El nombre A Mano, el logo, el diseño y los textos propios de la web pertenecen a A Mano. No se pueden usar para otros sitios o productos sin permiso.',

    ['h2', 'Juegos, medallas y ranking'],
    'Los juegos, las medallas y el ranking son un entretenimiento sin premios en dinero ni en especie. A Mano puede corregir puntajes que surjan de errores o de trampas.',

    ['h2', 'Disponibilidad y responsabilidad'],
    'A Mano se ofrece gratis y "tal como está". Se busca que funcione bien, pero puede tener errores o dejar de estar disponible por momentos. En la medida en que lo permita la ley, A Mano no responde por daños que surjan del uso de la web, de las recetas o de las respuestas de Manitas.',

    ['h2', 'Cambios'],
    'Estos términos pueden cambiar. La versión vigente es la publicada en esta página, con su fecha.',

    ['h2', 'Ley aplicable'],
    'Se rigen por las leyes de la República Argentina. Nada de lo que dicen limita los derechos que las leyes de protección al consumidor reconocen.',

    ['h2', 'Contacto'],
    ['Consultas, reclamos o pedidos de baja de contenido: ', contacto(), '.'],
  ]));
}
