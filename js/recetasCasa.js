// Recetas propias del sitio, en español, guardadas en data/recetas-casa.json.
// Para sumar recetas al repertorio alcanza con agregarlas a ese archivo.
import { urlIngrediente, IMG_INGREDIENTE_GENERICO } from './imagenes.js';
import { ingredienteEnIngles } from './traducciones.js';

// Para ingredientes escritos en español: usa la clave "imagen" si viene,
// si no intenta adivinarla con el diccionario.
export function normalizarIngredientesPropios(lista) {
  return lista
    .filter((i) => i && i.nombre && i.nombre.trim())
    .map((i) => {
      const clave = i.imagen || ingredienteEnIngles(i.nombre);
      return {
        nombre: i.nombre.trim(),
        medida: (i.medida || '').trim(),
        imagen: clave ? urlIngrediente(clave) : IMG_INGREDIENTE_GENERICO,
      };
    });
}

function normalizar(r) {
  return {
    id: `c-${r.slug}`,
    origenDatos: 'casa',
    nombre: r.nombre,
    categoria: r.categoria || '',
    origen: r.origen || '',
    descripcion: r.descripcion || '',
    porciones: r.porciones,
    minutos: r.minutos,
    imagen: r.imagen || '',
    etiquetas: r.etiquetas || [],
    ingredientes: normalizarIngredientesPropios(r.ingredientes || []),
    pasos: r.pasos || [],
  };
}

let promesa = null;

export function todas() {
  promesa ??= fetch('data/recetas-casa.json')
    .then((r) => {
      if (!r.ok) throw new Error('No se pudieron cargar las recetas de la casa');
      return r.json();
    })
    .then((lista) => lista.map(normalizar))
    .catch((err) => {
      promesa = null;
      console.error(err);
      return [];
    });
  return promesa;
}

export async function obtener(slug) {
  return (await todas()).find((r) => r.id === `c-${slug}`) || null;
}

const sinTildes = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export async function buscar(texto) {
  const q = sinTildes(texto.trim());
  if (!q) return [];
  return (await todas()).filter((r) =>
    sinTildes(r.nombre).includes(q) ||
    r.etiquetas.some((e) => sinTildes(e).includes(q)) ||
    r.ingredientes.some((i) => sinTildes(i.nombre).includes(q)));
}

export async function deCategoria(categoria) {
  return (await todas()).filter((r) => r.categoria === categoria);
}
