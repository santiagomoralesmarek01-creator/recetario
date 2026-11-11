// Arma dist/index.html: un solo archivo con el CSS y el JS adentro, listo para publicar.
// Uso: node build.js
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const leer = (f) => fs.readFileSync(path.join(dir, f), 'utf8').trim();
const html = leer('index.html')
  .replace('<link rel="stylesheet" href="estilos.css">', () => `<style>\n${leer('estilos.css')}\n</style>`)
  .replace('<script src="logic.js"></script>', () => `<script>\n${leer('logic.js')}\n</script>`)
  .replace('<script src="app.js"></script>', () => `<script>\n${leer('app.js')}\n</script>`);
fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });
fs.writeFileSync(path.join(dir, 'dist', 'index.html'), html + '\n');
console.log('dist/index.html listo');
