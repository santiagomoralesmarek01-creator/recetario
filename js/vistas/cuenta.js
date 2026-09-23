import { el, mostrar, cargando, aviso, vigencia } from '../dom.js';
import { entrar, registrarse, recuperarClave, usuario, nombreVisible } from '../auth.js';
import { hayBackend } from '../supabase.js';
import * as misRecetas from '../misRecetas.js';
import { grillaRecetas } from './componentes.js';

export function sinBackend() {
  mostrar(el('div', { class: 'estado' },
    el('h1', {}, 'Cuentas no disponibles todavía'),
    el('p', {}, 'Falta configurar Supabase en js/config.js (ver README).'),
    el('a', { href: '#/' }, 'Volver al inicio')));
}

function campo(etiqueta, props) {
  return el('label', { class: 'campo' }, el('span', {}, etiqueta), el('input', props));
}

export function vistaEntrar(modo = 'entrar') {
  if (!hayBackend) return sinBackend();
  if (usuario()) { location.hash = '#/mis-recetas'; return; }

  const titulos = { entrar: 'Entrar', registro: 'Crear cuenta', recuperar: 'Recuperar contraseña' };
  const error = el('p', { class: 'error', role: 'alert' });

  const campos = {
    nombre: campo('Tu nombre', { name: 'nombre', required: true, maxlength: '40', autocomplete: 'name' }),
    email: campo('Email', { name: 'email', type: 'email', required: true, autocomplete: 'email' }),
    clave: campo('Contraseña', {
      name: 'clave', type: 'password', required: true, minlength: '6',
      autocomplete: modo === 'registro' ? 'new-password' : 'current-password',
    }),
  };

  const boton = el('button', { type: 'submit' }, titulos[modo]);

  const form = el('form', {
    class: 'formulario-cuenta',
    onsubmit: async (e) => {
      e.preventDefault();
      error.textContent = '';
      boton.disabled = true;
      const datos = new FormData(form);
      const email = datos.get('email').trim();
      try {
        if (modo === 'entrar') {
          await entrar(email, datos.get('clave'));
          aviso(`¡Hola, ${nombreVisible()}!`);
          location.hash = '#/mis-recetas';
        } else if (modo === 'registro') {
          const activa = await registrarse(datos.get('nombre').trim(), email, datos.get('clave'));
          if (activa) {
            aviso('¡Cuenta creada!');
            location.hash = '#/mis-recetas';
          } else {
            form.replaceChildren(el('p', { class: 'exito' },
              `Te enviamos un email a ${email}. Confirmá tu cuenta y después entrá.`));
          }
        } else {
          await recuperarClave(email);
          form.replaceChildren(el('p', { class: 'exito' },
            `Si existe una cuenta con ${email}, te llegará un enlace para cambiar la contraseña.`));
        }
      } catch (err) {
        error.textContent = err.message;
      } finally {
        boton.disabled = false;
      }
    },
  },
    modo === 'registro' && campos.nombre,
    campos.email,
    modo !== 'recuperar' && campos.clave,
    error,
    boton);

  const pestanas = el('nav', { class: 'pestanas' },
    ['entrar', 'registro'].map((m) =>
      el('a', { href: m === 'entrar' ? '#/entrar' : '#/registro', class: m === modo ? 'activa' : '' }, titulos[m])));

  mostrar(el('div', { class: 'tarjeta-cuenta' },
    modo !== 'recuperar' ? pestanas : el('h1', {}, titulos[modo]),
    form,
    modo === 'entrar' && el('p', { class: 'meta' }, el('a', { href: '#/recuperar' }, '¿Olvidaste tu contraseña?')),
    modo === 'recuperar' && el('p', { class: 'meta' }, el('a', { href: '#/entrar' }, '← Volver'))));
  form.querySelector('input')?.focus();
}

// Pantalla que abre Supabase cuando se usa el enlace de "recuperar contraseña".
export function vistaNuevaClave(cambiarClave) {
  const error = el('p', { class: 'error', role: 'alert' });
  const form = el('form', {
    class: 'formulario-cuenta',
    onsubmit: async (e) => {
      e.preventDefault();
      try {
        await cambiarClave(new FormData(form).get('clave'));
        aviso('Contraseña actualizada');
        location.hash = '#/mis-recetas';
      } catch (err) {
        error.textContent = err.message;
      }
    },
  },
    campo('Nueva contraseña', { name: 'clave', type: 'password', required: true, minlength: '6', autocomplete: 'new-password' }),
    error,
    el('button', { type: 'submit' }, 'Guardar'));
  mostrar(el('div', { class: 'tarjeta-cuenta' }, el('h1', {}, 'Elegí una nueva contraseña'), form));
}

export async function vistaMisRecetas() {
  if (!hayBackend) return sinBackend();
  const u = usuario();
  if (!u) { location.hash = '#/entrar'; return; }
  const vigente = vigencia();
  cargando();
  const recetas = await misRecetas.listarMias(u.id);
  if (!vigente()) return;
  mostrar(
    el('div', { class: 'seccion-titulo' },
      el('h1', {}, `Mis recetas`),
      el('a', { class: 'boton', href: '#/nueva' }, '+ Nueva receta')),
    el('p', { class: 'meta' }, `Hola, ${nombreVisible(u)}. Tenés ${recetas.length} receta${recetas.length === 1 ? '' : 's'} guardada${recetas.length === 1 ? '' : 's'}.`),
    recetas.length
      ? grillaRecetas(recetas)
      : el('div', { class: 'estado' },
        el('p', {}, 'Todavía no cargaste ninguna receta.'),
        el('a', { class: 'boton', href: '#/nueva' }, 'Crear la primera'))
  );
}
