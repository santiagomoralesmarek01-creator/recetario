// Textos de la interfaz en tres tratos: neutro (por defecto), vos y tú.
// Neutro evita verbos que marcan región: usa infinitivos o primera persona
// plural ("Buscar una receta", "Cocinemos"). Guía de voz: docs/marca-a-mano.md.
// Las recetas no pasan por acá: sólo la interfaz.
//
// Uso: t('inicio.cta') o, con datos, t('juego.perfecto', { n: 40 }).
// Una clave con un solo texto vale para los tres tratos.

const CLAVE_TRATO = 'amano:trato';
export const TRATOS = { neutro: 'Neutro', vos: 'Vos', tu: 'Tú' };

const TEXTOS = {
  // Navegación y cabecera
  'nav.inicio': 'Inicio',
  'nav.que-hay': '¿Qué hay a mano?',
  'nav.paises': 'Países',
  'nav.juegos': 'Juegos',
  'nav.comunidad': 'Comunidad',
  'cabecera.buscar': 'Buscar receta o ingrediente',
  'cabecera.crear': 'Crear receta',
  'cabecera.entrar': 'Entrar',
  'cabecera.nueva': 'Nueva',
  'pie.promesa': 'Con lo que hay, alcanza.',

  // Inicio
  'buscar.titulo': { neutro: '¿Qué hay a mano hoy?', vos: '¿Qué tenés a mano hoy?', tu: '¿Qué tienes a mano hoy?' },
  'inicio.bajada': {
    neutro: 'Recetas que se adaptan a lo que hay en la cocina, al país y al nivel de cada uno. Con lo que hay, alcanza.',
    vos: 'Recetas que se adaptan a lo que tenés en la cocina, a tu país y a tu nivel. Con lo que hay, alcanza.',
    tu: 'Recetas que se adaptan a lo que tienes en la cocina, a tu país y a tu nivel. Con lo que hay, alcanza.',
  },
  'inicio.cta': 'Ver qué puedo cocinar',
  'inicio.o-buscar': { neutro: 'o buscar una receta:', vos: 'o buscá una receta:', tu: 'o busca una receta:' },
  'inicio.buscar-ejemplo': {
    neutro: 'Buscar “empanadas”, “pollo” o “flan”…',
    vos: 'Probá con “empanadas”, “pollo” o “flan”…',
    tu: 'Prueba con “empanadas”, “pollo” o “flan”…',
  },
  'inicio.azar': { neutro: 'Una al azar', vos: 'Sorprendeme', tu: 'Sorpréndeme' },
  'invitacion.titulo': { neutro: 'Guardar recetas propias', vos: 'Guardá tus propias recetas', tu: 'Guarda tus propias recetas' },
  'invitacion.texto': {
    neutro: 'Con una cuenta gratis se pueden guardar recetas propias y compartirlas.',
    vos: 'Creá una cuenta gratis para guardar tus recetas y compartirlas.',
    tu: 'Crea una cuenta gratis para guardar tus recetas y compartirlas.',
  },
  'invitacion.titulo-usuario': '¿Qué cocinamos hoy?',
  'invitacion.texto-usuario': {
    neutro: 'Sumar recetas con fotos y compartirlas con la comunidad.',
    vos: 'Cargá tus recetas con fotos y compartilas con la comunidad.',
    tu: 'Carga tus recetas con fotos y compártelas con la comunidad.',
  },
  'invitacion.cta-usuario': 'Sumar mi receta',
  'invitacion.cta': 'Crear cuenta',

  // ¿Qué hay a mano?
  'despensa.bajada': {
    neutro: 'Elegir los ingredientes que hay en casa y ver las recetas que los usan, primero las que piden menos cosas extra.',
    vos: 'Elegí los ingredientes que tenés y te muestro las recetas que los usan, primero las que te piden menos cosas extra.',
    tu: 'Elige los ingredientes que tienes y te muestro las recetas que los usan, primero las que te piden menos cosas extra.',
  },
  'despensa.ingrediente': { neutro: 'Agregar un ingrediente: huevo, papa, pollo…', vos: 'Escribí un ingrediente: huevo, papa, pollo…', tu: 'Escribe un ingrediente: huevo, papa, pollo…' },
  'despensa.basicos': { neutro: 'Contar con sal, pimienta, agua y aceite', vos: 'Doy por hecho que tengo sal, pimienta, agua y aceite', tu: 'Doy por hecho que tengo sal, pimienta, agua y aceite' },
  'despensa.todo': { neutro: 'Está todo', vos: 'Tenés todo', tu: 'Tienes todo' },
  'despensa.con-lo-que-hay': { neutro: 'con lo que hay', vos: 'con lo que tenés', tu: 'con lo que tienes' },

  // Receta y modo cocina
  'receta.tildar': { neutro: 'Tildar a medida que se usan.', vos: 'Tildalos a medida que los vas usando.', tu: 'Márcalos a medida que los vas usando.' },
  'receta.seguir': 'Seguir al costado',
  'receta.siguiendo': 'Siguiendo',
  'receta.seguir-ayuda': { neutro: 'Mostrarla en el panel lateral al navegar', vos: 'Mostrarla en el panel lateral mientras navegás', tu: 'Mostrarla en el panel lateral mientras navegas' },
  'receta.pantalla': 'No apagar pantalla',
  'receta.pantalla-ayuda': { neutro: 'Evita que la pantalla se apague mientras se cocina', vos: 'Evita que la pantalla se apague mientras cocinás', tu: 'Evita que la pantalla se apague mientras cocinas' },
  'receta.reiniciar': 'Reiniciar',
  'receta.temporizador': 'Temporizador',
  'receta.listo': 'Listo. Buen provecho.',
  'receta.completada': 'Receta completada. Suma para las medallas.',
  'reemplazo.si-no-hay': { neutro: 'Si no hay: ', vos: 'Si no conseguís: ', tu: 'Si no consigues: ' },
  'reemplazo.dificil': 'Difícil de conseguir',
  'reemplazo.cta': { neutro: 'Buscar un reemplazo', vos: 'Buscá un reemplazo', tu: 'Busca un reemplazo' },
  'reemplazo.aviso-uno': 'Un ingrediente puede ser difícil de conseguir en Latinoamérica: al lado va un reemplazo.',
  'reemplazo.aviso-varios': '{n} ingredientes pueden ser difíciles de conseguir en Latinoamérica: al lado de cada uno va un reemplazo.',
  'reemplazo.todo-facil': 'Todos los ingredientes se consiguen fácil en cualquier supermercado.',
  'cocina.reposar': { neutro: 'Dejar reposar 5 minutos.', vos: 'Dejá reposar 5 minutos.', tu: 'Deja reposar 5 minutos.' },

  // Listados
  'tarjeta.especiales': 'ingredientes especiales',
  'filtro.conseguir': 'Solo ingredientes fáciles de conseguir',
  'filtro.leyenda': '¿Qué significa cada nivel?',

  // Juegos
  'juegos.titulo': { neutro: '¿Cuánto sabemos de comida?', vos: '¿Cuánto sabés de comida?', tu: '¿Cuánto sabes de comida?' },
  'juegos.bajada': {
    neutro: 'Platos, países e ingredientes para adivinar con las recetas de A Mano, con prioridad para la cocina latinoamericana. Cada acierto suma para el ranking y las medallas; en difícil, vale más.',
    vos: 'Adiviná platos, países e ingredientes con las recetas de A Mano, con prioridad para la cocina latinoamericana. Sumá puntos, subí en el ranking y ganá medallas: en difícil, cada acierto vale más.',
    tu: 'Adivina platos, países e ingredientes con las recetas de A Mano, con prioridad para la cocina latinoamericana. Suma puntos, sube en el ranking y gana medallas: en difícil, cada acierto vale más.',
  },
  'juegos.elegir-dificultad': { neutro: 'Dificultad a elección: ', vos: 'Elegís la dificultad: ', tu: 'Eliges la dificultad: ' },
  'juegos.jugar-hoy': 'Jugar el Plato del día',
  'juegos.racha': '{n} {dias} de racha',
  'juegos.sin-partidas': { neutro: 'Sin partidas todavía', vos: 'Todavía no jugaste', tu: 'Todavía no has jugado' },
  'juegos.record': 'Récord: {n} puntos',
  'juego.empezar': 'Empezar',
  'juego.correcto': 'Correcto.',
  'juego.exacto': 'Exacto.',
  'juego.perfecto': 'Plato perfecto: +{n}',
  'juego.ganaste': { neutro: 'Adivinado.', vos: 'Lo adivinaste.', tu: 'Lo adivinaste.' },
  'juego.casi': 'Casi. Mañana hay otro plato.',
  'juego.nuevo-record': 'Nuevo récord personal',
  'juego.otra-vez': 'Jugar otra vez',
  'juego.cambiar-dificultad': 'Cambiar dificultad',
  'juego.compartir': 'Compartir',
  'juego.otros': 'Otros juegos',
  'juego.entrar': { neutro: 'Entrar', vos: 'Entrá', tu: 'Entra' },
  'juego.entrar-texto': ' para sumar puntos al ranking semanal y ganar medallas.',
  'juego.copiado': { neutro: 'Resultado copiado: listo para pegar.', vos: 'Resultado copiado: pegalo donde quieras.', tu: 'Resultado copiado: pégalo donde quieras.' },

  // Medallas y cuenta
  'medalla.nueva': 'Nueva medalla: {nombre}',
  'medalla.nuevas': '{n} medallas nuevas',
  'cuenta.favoritas-vacio': {
    neutro: 'Las recetas marcadas con el corazón aparecen acá.',
    vos: 'Tocá el corazón en las recetas que te gusten y las vas a encontrar acá.',
    tu: 'Toca el corazón en las recetas que te gusten y las encontrarás aquí.',
  },
  'receta.publicada': 'Tu receta ya está en A Mano. Gracias por sumarla.',
  'receta.guardada': 'Cambios guardados.',
};

export function trato() {
  try {
    const v = localStorage.getItem(CLAVE_TRATO);
    return v in TRATOS ? v : 'neutro';
  } catch {
    return 'neutro';
  }
}

export function t(clave, datos = {}) {
  const entrada = TEXTOS[clave];
  let texto = entrada == null ? clave : typeof entrada === 'string' ? entrada : entrada[trato()] ?? entrada.neutro;
  for (const [k, v] of Object.entries(datos)) texto = texto.replaceAll(`{${k}}`, String(v));
  return texto;
}

// Textos fijos del HTML (data-t="clave"; data-t-attr="placeholder" para atributos).
export function aplicarTextos(raiz = document) {
  for (const nodo of raiz.querySelectorAll('[data-t]')) {
    const attr = nodo.dataset.tAttr;
    if (attr) nodo.setAttribute(attr, t(nodo.dataset.t));
    else nodo.textContent = t(nodo.dataset.t);
  }
}
