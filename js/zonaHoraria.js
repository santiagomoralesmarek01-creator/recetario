// Fechas en la hora de Argentina para el calendario de redes. Lo usan el panel
// /admin/redes y scripts/redes-calendario.mjs (sin DOM: corre también en Node).
export const ZONA = 'America/Argentina/Buenos_Aires';

// Minutos de diferencia con UTC de una zona en un momento dado (−180 en Argentina).
function desfase(zona, ms) {
  const nombre = new Intl.DateTimeFormat('en-US', { timeZone: zona, timeZoneName: 'longOffset' })
    .formatToParts(ms).find((p) => p.type === 'timeZoneName').value;
  const m = nombre.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0)) : 0;
}

// "2026-10-07" + "10:00" en la zona → "2026-10-07T10:00:00-03:00".
export function isoEnZona(fecha, hora, zona = ZONA) {
  const [a, m, d] = fecha.split('-').map(Number);
  const [hh, mm] = hora.split(':').map(Number);
  const local = Date.UTC(a, m - 1, d, hh, mm);
  const min = desfase(zona, local - desfase(zona, local) * 60_000);
  const signo = min < 0 ? '-' : '+';
  const abs = Math.abs(min);
  const dos = (n) => String(n).padStart(2, '0');
  return `${fecha}T${dos(hh)}:${dos(mm)}:00${signo}${dos(Math.floor(abs / 60))}:${dos(abs % 60)}`;
}

// Fecha y hora de un ISO en la zona, para mostrar o para un <input type="datetime-local">.
export function partesEnZona(iso, zona = ZONA) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
}
