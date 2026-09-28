// Carga de fotos de recetas para administradores: una ventana para subir la
// foto (desde la receta o desde la lista) y la página de recetas sin foto.
import { el, mostrar, cargando, vigencia, aviso } from '../dom.js';
import { usuario, pedirLogin } from '../auth.js';
import * as repo from '../repositorio.js';
import { soyAdmin, guardarFoto } from '../fotos.js';
import { portada } from './componentes.js';
import { traducirCategoria } from '../traducciones.js';
import { icono } from '../iconos.js';
import { rutaReceta } from '../rutas.js';

// Ventana para elegir la foto, ver cómo queda y guardarla.
export function dialogoFoto(receta, alGuardar) {
  let archivo = null;
  const vista = el('div', { class: 'foto-dialogo-vista' }, portada(receta, { clase: 'foto-dialogo-img' }));
  const entrada = el('input', {
    type: 'file', accept: 'image/*', class: 'foto-dialogo-archivo',
    onchange: () => {
      archivo = entrada.files[0] || null;
      if (!archivo) return;
      const img = el('img', { class: 'foto-dialogo-img', alt: '' });
      img.src = URL.createObjectURL(archivo);
      vista.replaceChildren(img);
      guardar.disabled = false;
    },
  });
  const credito = el('input', {
    type: 'text', maxlength: 200, value: receta.creditoFoto || '',
    placeholder: 'Ej.: Foto propia · o · Foto de Ana Pérez en Unsplash',
  });
  const error = el('p', { class: 'error', role: 'alert' });
  const guardar = el('button', { type: 'submit', class: 'boton', disabled: true }, 'Guardar foto');
  const cerrar = () => fondo.remove();

  const fondo = el('div', { class: 'alarma-fondo', onclick: (e) => { if (e.target === fondo) cerrar(); } },
    el('form', {
      class: 'alarma foto-dialogo', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Foto de ${receta.nombre}`,
      onkeydown: (e) => { if (e.key === 'Escape') cerrar(); },
      onsubmit: async (e) => {
        e.preventDefault();
        if (!archivo) return;
        guardar.disabled = true;
        guardar.textContent = 'Subiendo…';
        error.textContent = '';
        try {
          const url = await guardarFoto(receta.id, archivo, credito.value);
          receta.imagen = url;
          receta.creditoFoto = credito.value.trim();
          receta.fuenteFoto = '';
          cerrar();
          aviso('Foto guardada.');
          alGuardar?.(url);
        } catch (err) {
          error.textContent = `No se pudo guardar: ${err.message}`;
          guardar.disabled = false;
          guardar.textContent = 'Guardar foto';
        }
      },
    },
    el('h2', {}, 'Foto de la receta'),
    el('p', { class: 'meta' }, receta.nombre),
    vista,
    el('label', { class: 'boton-secundario foto-dialogo-elegir' }, entrada, receta.imagen ? 'Elegir otra foto' : 'Elegir foto'),
    el('label', { class: 'foto-dialogo-credito' }, el('span', {}, 'Crédito (quién sacó la foto o de dónde es)'), credito),
    el('p', { class: 'meta foto-dialogo-ayuda' }, 'Usá fotos propias o de bancos gratuitos (Unsplash, Pexels, Pixabay). No uses fotos de otros sitios de recetas: tienen dueño. La foto se achica sola antes de subirla.'),
    error,
    el('div', { class: 'acciones' },
      el('button', { type: 'button', class: 'boton-secundario', onclick: cerrar }, 'Cancelar'),
      guardar)));
  document.body.append(fondo);
  entrada.focus();
}

// /fotos: recetas sin foto (primero las latinoamericanas de la casa) para ir completándolas.
export async function vistaFotos() {
  document.title = 'Fotos de recetas · A Mano';
  if (!usuario()) { pedirLogin('/fotos'); return; }
  const vigente = vigencia();
  cargando();
  const [admin, todas] = await Promise.all([soyAdmin(), repo.todasLasRecetas()]);
  if (!vigente()) return;
  if (!admin) {
    mostrar(el('div', { class: 'estado' },
      el('h1', {}, 'Fotos de recetas'),
      el('p', {}, 'Esta sección es sólo para administradores. Para habilitar tu cuenta, seguí los pasos del README ("Cargar fotos de recetas").')));
    return;
  }
  let soloSinFoto = true;
  const lista = el('ul', { class: 'fotos-lista' });
  const contador = el('p', { class: 'meta' });
  const casillaTodas = el('input', { type: 'checkbox', onchange: () => { soloSinFoto = !casillaTodas.checked; pintar(); } });

  function fila(r) {
    const img = el('div', { class: 'fotos-lista-img' }, portada(r, { miniatura: true }));
    const estado = el('small', {}, r.imagen ? 'Tiene foto' : 'Sin foto');
    return el('li', {},
      img,
      el('span', { class: 'fotos-lista-texto' },
        el('a', { href: rutaReceta(r.id, r.nombre) }, r.nombre),
        el('small', {}, [r.categoria && traducirCategoria(r.categoria), r.origen].filter(Boolean).join(' · ')),
        estado),
      el('button', {
        type: 'button', class: 'boton-secundario',
        onclick: () => dialogoFoto(r, () => {
          img.replaceChildren(portada(r, { miniatura: true }));
          estado.textContent = 'Tiene foto';
          if (soloSinFoto) pintarContador();
        }),
      }, icono('foto'), r.imagen ? 'Cambiar' : 'Subir'));
  }

  const sinFoto = () => todas.filter((r) => !r.imagen);
  function pintarContador() {
    contador.textContent = `${sinFoto().length} recetas todavía no tienen foto.`;
  }
  function pintar() {
    const recetas = soloSinFoto ? sinFoto() : todas.filter((r) => r.origenDatos === 'casa');
    lista.replaceChildren(...recetas.map(fila));
    pintarContador();
  }

  mostrar(
    el('h1', {}, 'Fotos de recetas'),
    el('p', { class: 'seccion-bajada' }, 'Subí la foto de cada plato desde acá (también desde el celular: podés sacarla en el momento). Aparece enseguida en toda la página.'),
    contador,
    el('label', { class: 'filtro-conseguir' }, casillaTodas, ' Mostrar todas las recetas de la casa (para cambiar alguna foto)'),
    lista);
  pintar();
}
