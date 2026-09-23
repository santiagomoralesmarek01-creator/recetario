// Mini-helper para crear elementos sin frameworks.
export function el(tag, props = {}, ...hijos) {
  const nodo = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') nodo.className = v;
    else if (k.startsWith('on')) nodo.addEventListener(k.slice(2), v);
    else if (k in nodo && typeof v !== 'string') nodo[k] = v;
    else nodo.setAttribute(k, v === true ? '' : v);
  }
  for (const h of hijos.flat()) {
    if (h == null || h === false || h === '') continue;
    nodo.append(h instanceof Node ? h : document.createTextNode(h));
  }
  return nodo;
}

// Cada navegación tiene un número. Una vista que tarda en cargar comprueba
// con vigencia() que el usuario no se haya ido a otra página mientras tanto.
let navegacion = 0;
export function nuevaNavegacion() { navegacion++; }
export function vigencia() {
  const mia = navegacion;
  return () => mia === navegacion;
}

const contenido = () => document.getElementById('contenido');

export function mostrar(...nodos) {
  contenido().replaceChildren(...nodos.flat().filter(Boolean));
  window.scrollTo({ top: 0 });
}

export function cargando(texto = 'Cargando…') {
  mostrar(el('p', { class: 'estado' }, texto));
}

export function aviso(texto, tipo = 'ok') {
  const nodo = el('div', { class: `aviso aviso-${tipo}`, role: 'status' }, texto);
  document.body.append(nodo);
  setTimeout(() => nodo.remove(), 3500);
}
