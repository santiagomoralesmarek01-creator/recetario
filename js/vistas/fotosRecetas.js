// Carga de fotos de recetas para administradores: una ventana para subir la
// foto (desde la receta o desde la lista) y la página de recetas sin foto.
import { el, mostrar, cargando, vigencia, aviso } from '../dom.js';
import { usuario, pedirLogin } from '../auth.js';
import * as repo from '../repositorio.js';
import { soyAdmin, guardarFoto, guardarFotoUrl } from '../fotos.js';
import { buscarFotosLibres, creditoDe } from '../fotosLibres.js';
import { portada } from './componentes.js';
import { traducirCategoria } from '../traducciones.js';
import { icono } from '../iconos.js';
import { rutaReceta } from '../rutas.js';

// Ventana para elegir la foto, ver cómo queda y guardarla.
export function dialogoFoto(receta, alGuardar) {
  let archivo = null;
  let libre = null; // foto elegida del buscador
  const vista = el('div', { class: 'foto-dialogo-vista' }, portada(receta, { clase: 'foto-dialogo-img' }));
  const entrada = el('input', {
    type: 'file', accept: 'image/*', class: 'foto-dialogo-archivo',
    onchange: () => {
      archivo = entrada.files[0] || null;
      if (!archivo) return;
      libre = null;
      marcarElegida(null);
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
  // Buscador de fotos libres (Wikimedia Commons y Openverse): se elige con un clic.
  const consulta = el('input', { type: 'search', value: receta.nombre, 'aria-label': 'Buscar fotos libres' });
  const resultados = el('div', { class: 'fotos-libres-grilla' });
  const estadoBusqueda = el('p', { class: 'meta', 'aria-live': 'polite' });
  function marcarElegida(boton) {
    for (const b of resultados.querySelectorAll('.fotos-libres-opcion')) b.setAttribute('aria-pressed', String(b === boton));
  }
  async function buscar() {
    const q = consulta.value.trim();
    if (!q) return;
    estadoBusqueda.textContent = 'Buscando…';
    resultados.replaceChildren();
    try {
      const fotos = await buscarFotosLibres(q);
      estadoBusqueda.textContent = fotos.length ? `${fotos.length} fotos. Tocá la que más te guste.` : 'No encontré fotos. Probá con otras palabras (también en inglés).';
      resultados.replaceChildren(...fotos.map((f) => {
        const boton = el('button', {
          type: 'button', class: 'fotos-libres-opcion', 'aria-pressed': 'false', title: creditoDe(f),
          onclick: () => {
            libre = f;
            archivo = null;
            entrada.value = '';
            marcarElegida(boton);
            vista.replaceChildren(el('img', { class: 'foto-dialogo-img', alt: '', src: f.miniatura }));
            credito.value = creditoDe(f);
            guardar.disabled = false;
          },
        },
        el('img', { src: f.miniatura, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }),
        el('small', {}, [f.licencia, f.fuente].filter(Boolean).join(' · ')));
        return boton;
      }));
    } catch (err) {
      estadoBusqueda.textContent = err.message;
    }
  }
  const buscador = el('div', { class: 'fotos-libres' },
    el('p', { class: 'fotos-libres-titulo' }, 'O buscá una foto libre'),
    el('div', { class: 'fotos-libres-barra' },
      consulta,
      el('button', { type: 'button', class: 'boton-secundario', onclick: buscar }, 'Buscar')),
    estadoBusqueda,
    resultados);
  consulta.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); buscar(); } });

  const error = el('p', { class: 'error', role: 'alert' });
  const guardar = el('button', { type: 'submit', class: 'boton', disabled: true }, 'Guardar foto');
  const cerrar = () => fondo.remove();

  const fondo = el('div', { class: 'alarma-fondo', onclick: (e) => { if (e.target === fondo) cerrar(); } },
    el('form', {
      class: 'alarma foto-dialogo', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Foto de ${receta.nombre}`,
      onkeydown: (e) => { if (e.key === 'Escape') cerrar(); },
      onsubmit: async (e) => {
        e.preventDefault();
        if (!archivo && !libre) return;
        guardar.disabled = true;
        guardar.textContent = 'Subiendo…';
        error.textContent = '';
        try {
          const url = libre
            ? await guardarFotoUrl(receta.id, libre.url, credito.value)
            : await guardarFoto(receta.id, archivo, credito.value);
          // Igual que aplicarFotos: un enlace al final del crédito se muestra como link.
          const [, texto, enlace] = credito.value.trim().match(/^(.*?)\s*(https:\/\/\S+)$/) || [null, credito.value.trim(), ''];
          receta.imagen = url;
          receta.creditoFoto = texto || (enlace ? 'Fuente' : '');
          receta.fuenteFoto = enlace;
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
    buscador,
    el('label', { class: 'foto-dialogo-credito' }, el('span', {}, 'Crédito (quién sacó la foto o de dónde es)'), credito),
    el('p', { class: 'meta foto-dialogo-ayuda' }, 'Las fotos del buscador tienen licencia libre y el crédito se completa solo: no lo borres. También podés subir fotos propias. No uses fotos de otros sitios de recetas: tienen dueño.'),
    error,
    el('div', { class: 'acciones' },
      el('button', { type: 'button', class: 'boton-secundario', onclick: cerrar }, 'Cancelar'),
      guardar)));
  document.body.append(fondo);
  consulta.focus();
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
