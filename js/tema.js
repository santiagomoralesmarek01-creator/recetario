// Modo claro / oscuro. Por defecto sigue al sistema; si la persona elige
// uno con el botón, se recuerda (el script del <head> lo aplica al cargar).
const CLAVE = 'recetario:tema';
const raiz = document.documentElement;
const sistemaOscuro = window.matchMedia('(prefers-color-scheme: dark)');

const esOscuro = () => (raiz.dataset.tema ? raiz.dataset.tema === 'oscuro' : sistemaOscuro.matches);

export function iniciarTema() {
  const boton = document.getElementById('boton-tema');
  const colorBarra = document.querySelector('meta[name="theme-color"]');
  function reflejar() {
    const oscuro = esOscuro();
    const texto = oscuro ? 'Activar modo claro' : 'Activar modo oscuro';
    boton.setAttribute('aria-pressed', String(oscuro));
    boton.setAttribute('aria-label', texto);
    boton.title = texto;
    colorBarra?.setAttribute('content', oscuro ? '#171412' : '#c8553d');
  }
  boton.addEventListener('click', () => {
    const tema = esOscuro() ? 'claro' : 'oscuro';
    raiz.dataset.tema = tema;
    try { localStorage.setItem(CLAVE, tema); } catch { /* sin almacenamiento */ }
    reflejar();
  });
  sistemaOscuro.addEventListener('change', reflejar);
  reflejar();
}
