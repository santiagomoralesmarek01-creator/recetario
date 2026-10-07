// Publicación automática en Instagram (ver docs/redes-instagram.md).
//
//   POST /api/redes?accion=publicar   cada 10 min, desde pg_cron de Supabase
//   GET  /api/redes?accion=diario     una vez por día, desde Vercel Cron (vercel.json)
//   POST /api/redes?accion=probar&id=N  modo de prueba: arma el contenedor sin publicar
//   GET  /api/redes?accion=estado     token y cupo de publicaciones
//
// publicar y diario piden "Authorization: Bearer <CRON_SECRET>" (Vercel Cron lo
// manda solo). probar y estado también aceptan la sesión de un administrador.
import { timingSafeEqual } from 'node:crypto';
import { publicarPendientes, tareaDiaria, probar, resumen, esAdmin } from './_redes.js';

function responder(res, estado, cuerpo) {
  res.status(estado).setHeader('Cache-Control', 'no-store').json(cuerpo);
}

function conSecreto(req) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || secreto.length < 16) return false;
  const esperado = Buffer.from(`Bearer ${secreto}`);
  const recibido = Buffer.from(String(req.headers.authorization || ''));
  return esperado.length === recibido.length && timingSafeEqual(esperado, recibido);
}

export default async function handler(req, res) {
  const accion = String(req.query.accion || '');
  const secreto = conSecreto(req);
  const admin = !secreto && ['probar', 'estado'].includes(accion)
    && await esAdmin(String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')).catch(() => false);
  if (!secreto && !admin) return responder(res, 401, { error: 'No autorizado.' });

  try {
    switch (accion) {
      case 'publicar':
        if (req.method !== 'POST' && req.method !== 'GET') break;
        return responder(res, 200, await publicarPendientes());
      case 'diario':
        return responder(res, 200, await tareaDiaria());
      case 'probar':
        if (req.method !== 'POST') return responder(res, 405, { error: 'Usá POST.' });
        if (!/^\d+$/.test(String(req.query.id || ''))) return responder(res, 400, { error: 'Falta el id.' });
        return responder(res, 200, await probar(req.query.id));
      case 'estado':
        return responder(res, 200, await resumen());
      default:
        break;
    }
    return responder(res, 400, { error: 'Acción desconocida.' });
  } catch (err) {
    console.error(err);
    return responder(res, 500, { error: err.message });
  }
}
