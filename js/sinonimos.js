// Sinónimos regionales de ingredientes: escribir "elote" también encuentra
// "choclo", y "frijoles" encuentra "porotos". Cada grupo son formas de decir
// lo mismo en distintos países (sin tildes y en minúscula).
// Se dejan afuera las palabras ambiguas: "plátano" (banana o plátano macho),
// "pimentón" (morrón o especia), "torta" (pastel o sándwich).

const GRUPOS = [
  ['palta', 'aguacate'],
  ['paltas', 'aguacates'],
  ['choclo', 'elote', 'mazorca', 'jojoto'],
  ['choclos', 'elotes', 'mazorcas', 'jojotos'],
  ['poroto', 'frijol', 'caraota', 'habichuela', 'alubia', 'judia'],
  ['porotos', 'frijoles', 'caraotas', 'habichuelas', 'alubias', 'judias'],
  ['chaucha', 'ejote', 'vainita', 'judia verde', 'poroto verde'],
  ['chauchas', 'ejotes', 'vainitas', 'judias verdes', 'porotos verdes'],
  ['arveja', 'chicharo', 'guisante'],
  ['arvejas', 'chicharos', 'guisantes'],
  ['frutilla', 'fresa'],
  ['frutillas', 'fresas'],
  ['durazno', 'melocoton'],
  ['duraznos', 'melocotones'],
  ['anana', 'pina'],
  ['zapallo', 'calabaza', 'auyama', 'ahuyama', 'ayote'],
  ['zapallito', 'zucchini', 'calabacin', 'calabacita', 'zapallo italiano'],
  ['zapallitos', 'calabacines', 'calabacitas'],
  ['batata', 'camote', 'boniato'],
  ['batatas', 'camotes', 'boniatos'],
  ['mani', 'cacahuate', 'cacahuete'],
  ['aji', 'chile'],
  ['ajies', 'chiles'],
  ['morron', 'pimiento', 'pimiento morron'],
  ['morrones', 'pimientos'],
  ['manteca', 'mantequilla'],
  ['crema de leche', 'nata', 'crema para batir'],
  ['banana', 'cambur', 'guineo'],
  ['bananas', 'cambures', 'guineos'],
  ['repollo', 'col'],
  ['remolacha', 'betabel', 'betarraga'],
  ['papa', 'patata'],
  ['papas', 'patatas'],
  ['panceta', 'tocino', 'tocineta', 'beicon'],
  ['carne picada', 'carne molida'],
  ['pomelo', 'toronja'],
  ['damasco', 'albaricoque', 'chabacano'],
  ['cebolla de verdeo', 'cebollin', 'cebolla larga', 'cebolleta', 'cebollino'],
  ['tomate', 'jitomate'],
  ['tomates', 'jitomates'],
  ['aceitunas', 'olivas'],
  ['pochoclo', 'palomitas de maiz', 'pororo', 'canguil', 'cancha', 'crispetas'],
  ['jugo', 'zumo'],
  ['azucar impalpable', 'azucar glas', 'azucar glass', 'azucar en polvo'],
  ['polvo de hornear', 'polvo para hornear', 'levadura quimica'],
  ['fecula de maiz', 'maicena', 'almidon de maiz'],
  ['pan rallado', 'pan molido'],
  ['mandioca', 'yuca'],
  ['sandia', 'patilla'],
  ['papaya', 'lechosa', 'fruta bomba'],
  ['maracuya', 'parchita', 'fruta de la pasion'],
  ['cilantro', 'culantro'],
];

export const sinTildes = (texto) => String(texto).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PATRONES = GRUPOS.map((grupo) => grupo.map((termino) => [termino, new RegExp(`(^|[^a-zñ])${escapar(termino)}(?=$|[^a-zñ])`)]));

// Formas equivalentes de una palabra o frase exacta ("elote" → ["choclo", "mazorca"…]).
export function equivalentes(palabra) {
  const n = sinTildes(palabra);
  const grupo = GRUPOS.find((g) => g.includes(n));
  return grupo ? grupo.filter((x) => x !== n) : [];
}

// Grupos cuyo algún término empieza con lo escrito (para autocompletar: "elo" → choclo…).
export function equivalentesDePrefijo(texto, minimo = 3) {
  const n = sinTildes(texto);
  if (n.length < minimo) return [];
  const encontrados = new Set();
  for (const grupo of GRUPOS) {
    if (grupo.some((x) => x.startsWith(n))) for (const x of grupo) if (!x.startsWith(n)) encontrados.add(x);
  }
  return [...encontrados];
}

// Variantes de una búsqueda cambiando cada término regional por sus
// equivalentes: "tacos de frijoles" → ["tacos de porotos", "tacos de caraotas", …].
// La primera es siempre la original. `cambios` dice qué palabras se sumaron.
export function expandirBusqueda(texto, maximo = 8) {
  const original = sinTildes(texto);
  const variantes = [original];
  const cambios = [];
  for (const grupo of PATRONES) {
    const hallado = grupo.find(([, patron]) => patron.test(original));
    if (!hallado) continue;
    const [termino, patron] = hallado;
    for (const [otro] of grupo) {
      if (otro === termino) continue;
      cambios.push(otro);
      if (variantes.length < maximo) variantes.push(original.replace(patron, `$1${otro}`));
    }
  }
  return { variantes, cambios };
}
