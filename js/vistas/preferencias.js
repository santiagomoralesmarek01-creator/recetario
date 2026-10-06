// /preferencias: trato (neutro, vos o tú) y país. Sirve con o sin cuenta.
import { el, mostrar, aviso } from '../dom.js';
import { usuario } from '../auth.js';
import { t, TRATOS } from '../textos.js';
import { NOMBRES_PAISES, LATINOAMERICA } from '../paises.js';
import { preferencias, guardarPreferencias } from '../preferencias.js';

const EJEMPLOS = {
  neutro: '¿Qué hay a mano hoy?',
  vos: '¿Qué tenés a mano hoy?',
  tu: '¿Qué tienes a mano hoy?',
};

export function vistaPreferencias() {
  document.title = 'Preferencias · A Mano';
  const actual = preferencias();

  const opcionesTrato = Object.entries(TRATOS).map(([clave, nombre]) => el('label', { class: `opcion-trato${actual.trato === clave ? ' elegida' : ''}` },
    el('input', { type: 'radio', name: 'trato', value: clave, checked: actual.trato === clave }),
    el('span', {}, el('strong', {}, nombre), el('small', {}, EJEMPLOS[clave]))));

  // Primero Latinoamérica y España; el resto después.
  const cercanos = NOMBRES_PAISES.filter((p) => LATINOAMERICA.has(p) || p === 'España');
  const otros = NOMBRES_PAISES.filter((p) => !cercanos.includes(p));
  const selectorPais = el('select', { name: 'pais' },
    el('option', { value: '' }, actual.paisDetectado ? `Automático (${actual.paisDetectado})` : 'Sin elegir'),
    el('optgroup', { label: 'Latinoamérica y España' }, cercanos.map((p) => el('option', { value: p, selected: p === actual.pais }, p))),
    el('optgroup', { label: 'Otros países' }, otros.map((p) => el('option', { value: p, selected: p === actual.pais }, p))));

  const form = el('form', {
    class: 'preferencias',
    onchange: (e) => {
      if (e.target.name === 'trato') form.querySelectorAll('.opcion-trato').forEach((o) => o.classList.toggle('elegida', o.contains(e.target)));
    },
    onsubmit: async (e) => {
      e.preventDefault();
      const datos = new FormData(form);
      const enCuenta = await guardarPreferencias({ trato: datos.get('trato'), pais: datos.get('pais') || '' });
      aviso(enCuenta ? 'Preferencias guardadas.' : 'Guardadas en este dispositivo (no se pudieron guardar en la cuenta).');
    },
  },
  el('fieldset', {},
    el('legend', {}, 'Trato'),
    el('p', { class: 'meta' }, 'Cómo se dirige A Mano a quien la usa. Las recetas no cambian.'),
    el('div', { class: 'opciones-trato' }, opcionesTrato)),
  el('fieldset', {},
    el('legend', {}, 'País'),
    el('p', { class: 'meta' }, 'Manitas usa los nombres de ingredientes de ese país y el ranking de los juegos tiene una pestaña por país.'),
    selectorPais),
  el('p', { class: 'meta' }, usuario() ? 'Se guardan en la cuenta: siguen en cualquier dispositivo.' : 'Se guardan en este dispositivo. Con una cuenta, siguen en cualquier otro.'),
  el('div', { class: 'acciones' }, el('button', { type: 'submit', class: 'boton' }, 'Guardar')));

  mostrar(
    el('a', { class: 'volver', href: '/' }, `← ${t('nav.inicio')}`),
    el('h1', {}, 'Preferencias'),
    form);
}
