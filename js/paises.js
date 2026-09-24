// Datos de cada país: código ISO (para la bandera) y continente.
// Las banderas son imágenes (flagcdn.com) porque Windows no muestra los emojis de banderas.
import { el } from './dom.js';

const PAISES = {
  // América
  'Argentina': ['ar', 'América'], 'Uruguay': ['uy', 'América'], 'Chile': ['cl', 'América'],
  'Paraguay': ['py', 'América'], 'Brasil': ['br', 'América'], 'Colombia': ['co', 'América'],
  'Venezuela': ['ve', 'América'], 'Costa Rica': ['cr', 'América'], 'Cuba': ['cu', 'América'],
  'México': ['mx', 'América'], 'Estados Unidos': ['us', 'América'], 'Canadá': ['ca', 'América'],
  'Jamaica': ['jm', 'América'], 'Dominica': ['dm', 'América'], 'Barbados': ['bb', 'América'],
  'Islas Caimán': ['ky', 'América'], 'Aruba': ['aw', 'América'], 'Antigua y Barbuda': ['ag', 'América'],
  'Bahamas': ['bs', 'América'], 'Perú': ['pe', 'América'], 'Bolivia': ['bo', 'América'],
  // Europa
  'España': ['es', 'Europa'], 'Italia': ['it', 'Europa'], 'Francia': ['fr', 'Europa'],
  'Reino Unido': ['gb', 'Europa'], 'Irlanda': ['ie', 'Europa'], 'Portugal': ['pt', 'Europa'],
  'Países Bajos': ['nl', 'Europa'], 'Bélgica': ['be', 'Europa'], 'Noruega': ['no', 'Europa'],
  'Dinamarca': ['dk', 'Europa'], 'Polonia': ['pl', 'Europa'], 'Grecia': ['gr', 'Europa'],
  'Croacia': ['hr', 'Europa'], 'Albania': ['al', 'Europa'], 'Bulgaria': ['bg', 'Europa'],
  'Rusia': ['ru', 'Europa'], 'Ucrania': ['ua', 'Europa'], 'Estonia': ['ee', 'Europa'],
  'Eslovaquia': ['sk', 'Europa'], 'Austria': ['at', 'Europa'], 'Andorra': ['ad', 'Europa'],
  'Alemania': ['de', 'Europa'],
  // Asia
  'China': ['cn', 'Asia'], 'Japón': ['jp', 'Asia'], 'India': ['in', 'Asia'], 'Tailandia': ['th', 'Asia'],
  'Vietnam': ['vn', 'Asia'], 'Camboya': ['kh', 'Asia'], 'Laos': ['la', 'Asia'], 'Malasia': ['my', 'Asia'],
  'Filipinas': ['ph', 'Asia'], 'Bangladés': ['bd', 'Asia'], 'Afganistán': ['af', 'Asia'],
  'Turquía': ['tr', 'Asia'], 'Siria': ['sy', 'Asia'], 'Arabia Saudita': ['sa', 'Asia'],
  'Armenia': ['am', 'Asia'], 'Azerbaiyán': ['az', 'Asia'],
  // África
  'Marruecos': ['ma', 'África'], 'Argelia': ['dz', 'África'], 'Túnez': ['tn', 'África'],
  'Egipto': ['eg', 'África'], 'Kenia': ['ke', 'África'], 'Botsuana': ['bw', 'África'], 'Angola': ['ao', 'África'],
  // Oceanía
  'Australia': ['au', 'Oceanía'],
};

export const NOMBRES_PAISES = Object.keys(PAISES).sort((a, b) => a.localeCompare(b, 'es'));

export const CONTINENTES = ['América', 'Europa', 'Asia', 'África', 'Oceanía', 'Otros'];

export const continenteDe = (pais) => PAISES[pais]?.[1] || 'Otros';

export function bandera(pais, clase = 'bandera') {
  const codigo = PAISES[pais]?.[0];
  if (!codigo) return el('span', { class: `${clase} bandera-texto`, 'aria-hidden': 'true' }, '🌎');
  const img = el('img', {
    class: clase,
    src: `https://flagcdn.com/w40/${codigo}.png`,
    srcset: `https://flagcdn.com/w80/${codigo}.png 2x`,
    alt: '',
    width: '28',
    height: '21',
    loading: 'lazy',
  });
  img.addEventListener('error', () => img.replaceWith(el('span', { class: `${clase} bandera-texto` }, codigo.toUpperCase())));
  return img;
}

export const rutaPais = (pais) => `#/pais/${encodeURIComponent(pais)}`;

export function chipPais({ nombre, cantidad }) {
  return el('a', { class: 'chip-pais', href: rutaPais(nombre) },
    bandera(nombre),
    el('span', { class: 'chip-pais-nombre' }, nombre),
    cantidad != null && el('span', { class: 'chip-pais-cantidad' }, cantidad));
}
