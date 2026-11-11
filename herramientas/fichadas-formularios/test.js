// Prueba con las fichadas reales de octubre/noviembre 2026 y los resultados acordados a mano.
const H = require('./logic.js');
const assert = require('assert');

const fichadas = `14-10-2026	06:48	Entrada
14-10-2026	17:06	Salida
15-10-2026	08:01	Entrada
15-10-2026	17:00	Salida
16-10-2026	08:03	Entrada
16-10-2026	16:02	Salida
19-10-2026	08:07	Entrada
19-10-2026	16:09	Salida
20-10-2026	07:52	Entrada
20-10-2026	16:01	Salida
22-10-2026	08:10	Entrada
22-10-2026	16:01	Salida
23-10-2026	07:58	Entrada
23-10-2026	16:03	Salida
24-10-2026	07:45	Entrada
24-10-2026	13:00	Salida
26-10-2026	08:02	Entrada
26-10-2026	17:03	Salida
27-10-2026	07:22	Entrada
27-10-2026	16:38	Salida
28-10-2026	07:43	Entrada
28-10-2026	18:00	Salida
29-10-2026	08:02	Entrada
29-10-2026	17:01	Salida
30-10-2026	07:56	Entrada
30-10-2026	17:06	Salida
31-10-2026	11:11	Entrada
02-11-2026	07:49	Entrada
02-11-2026	17:01	Salida
03-11-2026	07:24	Entrada
03-11-2026	16:30	Salida
04-11-2026	07:53	Entrada
04-11-2026	17:01	Salida
06-11-2026	07:56	Entrada`;

const config = {
  legajo: '21408', autoriza: 'Patricia Cirino', entrada: '08:00',
  sabados: H.leerFechas('24/10/2026\n21/11/2026\n12/12/2026'),
  feriados: H.leerFechas('12/10/2026, 23/11/2026, 7/12/2026'),
  salidaViernes: true, hoy: '2026-11-06',
};

const r = H.procesar(config, fichadas, '14/10 07:00 a 08:00');
const cambios = r.formularios.filter((f) => f.tipo === 'cambio').map((f) => `${f.desde}|${f.hasta}|${f.horario}`);
console.log(cambios);
assert.deepStrictEqual(cambios, [
  '2026-10-14|2026-10-16|08:00 a 17:00',
  '2026-10-17|2026-10-17|FRANCO',
  '2026-10-26|2026-10-26|08:00 a 17:00',
  '2026-10-27|2026-10-27|07:30 a 16:30',
  '2026-10-28|2026-10-30|08:00 a 17:00',
  '2026-10-31|2026-10-31|FRANCO',
  '2026-11-02|2026-11-02|08:00 a 17:00',
  '2026-11-03|2026-11-03|07:30 a 16:30',
  '2026-11-04|2026-11-04|08:00 a 17:00',
  '2026-11-06|2026-11-06|08:00 a 17:00',
  '2026-11-07|2026-11-07|FRANCO',
]);

const otros = r.formularios.filter((f) => f.tipo !== 'cambio').map((f) => `${f.tipo}|${f.fecha}|${f.detalle}`);
console.log(otros);
assert.deepStrictEqual(otros, [
  'extra|2026-10-14|Horas extra de 07:00 a 08:00 (1:00 h)',
  'compenso|2026-10-16|Ausencia de 16:00 a 17:00 (1:00 h)',
  'extra|2026-10-28|Horas extra de 17:00 a 18:00 (1:00 h)',
]);

const sin = r.dias.filter((d) => d.tipo === 'sinFichada').map((d) => d.fecha);
assert.deepStrictEqual(sin, ['2026-10-21', '2026-11-05']);

const hist = Object.fromEntries(r.dias.map((d) => [d.fecha, d]));
const s = H.resumen(hist, '2026-11-06');
console.log(s.periodo.nombre, s.tarde, s.totalAdeudado, s.totalAFavor);
assert.strictEqual(s.tarde, 24);
assert.strictEqual(s.totalAdeudado, 60);
assert.strictEqual(s.totalAFavor, 120);

// Link de compenso con observación por defecto
const comp = r.formularios.find((f) => f.tipo === 'compenso');
assert.ok(comp.link.includes('entry.662001101=Horas%20adeudadas%3A%2016%2F10%2F26%20de%2016%3A00%20a%2017%3A00%20(1%3A00%20h)'));
assert.ok(comp.link.includes('entry.1528594203=21408'));
// Horas extra en decimal
const ex = r.formularios.find((f) => f.id === 'extra:2026-10-28:1020');
assert.ok(ex.link.includes('entry.251974133=17.0') && ex.link.includes('entry.1689353134=18.0'));

// Otra persona: entrada 07:00, llega 07:40 (40 min tarde) y se va 15:00
const r2 = H.procesar({ ...config, entrada: '07:00', sabados: [], feriados: [] }, '09-11-2026 07:40 Entrada\n09-11-2026 15:00 Salida', '');
const d2 = r2.dias.find((d) => d.fecha === '2026-11-09');
console.log(d2.horario, d2.ausencia, d2.minutosTarde);
assert.strictEqual(d2.horario, '08:00 a 17:00');
assert.deepStrictEqual(d2.ausencia, { inicio: 900, fin: 1020 });
console.log('OK');
