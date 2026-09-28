// Prueba del prompt de Manitas con 20 preguntas reales (docs/marca-a-mano.md).
// Usa el mismo texto de sistema que la web (api/_manitas.js) y la API de Groq.
//
//   GROQ_API_KEY=... node scripts/probar-manitas.mjs [neutro|vos|tu] [País]
//
// Imprime cada respuesta y marca lo que se sale de la guía de voz: largo,
// muletillas, más de una pregunta, tarjetas de reemplazo y trato.
import { instrucciones } from '../api/_manitas.js';

const trato = process.argv[2] || 'neutro';
const pais = process.argv[3] || 'México';
const modelo = process.env.GROQ_MODELO || 'llama-3.3-70b-versatile';
if (!process.env.GROQ_API_KEY) {
  console.error('Falta GROQ_API_KEY.');
  process.exit(1);
}

const RECETA = `Receta: Enchiladas de pollo al horno
Porciones: 4
Tiempo: 40 minutos
Ingredientes:
- 1 frasco de 400 g Salsa para enchiladas
- 3 tazas Queso Monterey Jack rallado
- 6 Tortillas de maíz
- 2 Pechugas de pollo
Pasos:
1. Cocinar las pechugas en la salsa, tapado, unos 20 minutos.
2. Desmenuzar el pollo.
3. Precalentar el horno a 190 °C.
4. Armar capas de tortilla, pollo y queso.
5. Hornear 20 minutos.`;

const PREGUNTAS = [
  ['No tengo queso Monterey Jack', RECETA],
  ['Somos 2', RECETA],
  ['Sin horno', RECETA],
  ['Algo más liviano', RECETA],
  ['No tengo tortillas de maíz', RECETA],
  ['¿Puedo dejarlo armado para mañana?', RECETA],
  ['¿Con qué se reemplaza la manteca en una torta?'],
  ['¿Cuántos gramos es una taza de harina?'],
  ['Hay pollo, papas y cebolla: ¿qué se puede hacer?'],
  ['¿Cómo hacer que no se pegue el arroz?'],
  ['Se me cortó la mayonesa casera, ¿la puedo salvar?'],
  ['¿Cuánto tiempo dura un guiso en la heladera?'],
  ['¿Puedo congelar empanadas crudas?'],
  ['El aceite de la sartén empezó a humear mucho, ¿qué hago?'],
  ['¿Es seguro comer el pollo un poco rosado?'],
  ['No tengo crema de leche para una salsa'],
  ['¿Cómo se dice palta en México?'],
  ['Quiero algo dulce sin horno para 6'],
  ['¿Qué vino va con un asado?'],
  ['¿Quién ganó el último mundial?'],
];

const MULETILLAS = /^(¡?claro|¡?con gusto|¡?excelente|¡?qué buena|¡?por supuesto|¡?hola)/i;
const VOSEO = /\b(tenés|podés|querés|usá|agregá|poné|hacé|sabés|mirá|probá|fijate)\b/i;
const TUTEO = /\b(tienes|puedes|quieres|usa|agrega|pon|haz|sabes|mira|prueba|fíjate)\b/i;

function revisar(texto) {
  const avisos = [];
  const lineas = texto.split('\n').filter((l) => l.trim());
  if (lineas.length > 6 || texto.length > 700) avisos.push(`largo (${lineas.length} líneas, ${texto.length} caracteres)`);
  if (MULETILLAS.test(texto.trim())) avisos.push('empieza con muletilla');
  if ((texto.match(/\?/g) || []).length > 1) avisos.push('más de una pregunta');
  if (trato !== 'vos' && VOSEO.test(texto)) avisos.push('usa voseo');
  if (trato !== 'tu' && TUTEO.test(texto)) avisos.push('usa tuteo');
  const tarjetas = texto.match(/\[\[\s*reemplazo:/gi)?.length || 0;
  if (tarjetas > 2) avisos.push(`${tarjetas} tarjetas de reemplazo`);
  return avisos;
}

async function preguntar(pregunta, receta) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelo,
      temperature: 0.6,
      max_tokens: 700,
      messages: [
        { role: 'system', content: instrucciones({ receta, pais, trato }) },
        { role: 'user', content: pregunta },
      ],
    }),
  });
  if (!r.ok) throw new Error(`Groq ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).choices?.[0]?.message?.content?.trim() || '';
}

let salida = `# Prueba de Manitas\n\nTrato: **${trato}** · País: **${pais}** · Modelo: ${modelo}\n\n`;
let conAvisos = 0;
for (const [i, [pregunta, receta]] of PREGUNTAS.entries()) {
  let texto;
  try {
    texto = await preguntar(pregunta, receta);
  } catch (err) {
    texto = `(error: ${err.message})`;
  }
  const avisos = revisar(texto);
  if (avisos.length) conAvisos++;
  salida += `## ${i + 1}. ${pregunta}${receta ? ' (en la receta)' : ''}\n\n${texto.split('\n').map((l) => `> ${l}`).join('\n')}\n\n${avisos.length ? `⚠️ ${avisos.join(' · ')}` : '✅ Dentro de la guía'}\n\n`;
  await new Promise((ok) => setTimeout(ok, 1500)); // respetar el límite gratuito
}
salida += `---\n\n${PREGUNTAS.length - conAvisos} de ${PREGUNTAS.length} respuestas dentro de la guía.\n`;
console.log(salida);
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import('node:fs');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, salida);
}
