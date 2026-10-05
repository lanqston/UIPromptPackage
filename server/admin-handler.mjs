import { createHmac } from 'node:crypto';
import { redisClient } from './submissions.mjs';
import { AdminError, adminConfig, verifyPassword, createSession, requireSession, jsonBody, cookie, tokenFrom, digest } from './admin-auth.mjs';
import { listRecords, saveRecord, storageKey, validId } from './admin-store.mjs';
const LIMIT = `local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],900) end; return n`;
export function makeAdminHandler(deps = {}) {
  return async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Vary', 'Cookie');
    const send = (status, body) => { res.statusCode = status; res.end(JSON.stringify(body)); };
    try {
      if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); throw new AdminError(405, 'Use the dashboard.'); }
      const env = deps.env || process.env;
      const cfg = adminConfig(env);
      if (req.headers['sec-fetch-site'] === 'cross-site' || (req.method === 'POST' && req.headers.origin !== cfg.origin)) throw new AdminError(403, 'Open the dashboard on its configured website.');
      const redis = deps.redis || redisClient(env);
      if (req.method === 'POST') {
        if (String(req.url).includes('?')) throw new AdminError(400, 'Use the dashboard form.');
        const body = await jsonBody(req);
        if (body.action === 'login') {
          const ip = req.headers['x-real-ip'];
          if (!deps.redis && (env.VERCEL !== '1' || typeof ip !== 'string' || !ip)) throw new AdminError(503, 'Owner sign-in is temporarily unavailable.');
          const bucket = createHmac('sha256', cfg.secret).update(String(ip || 'fixture')).digest('hex');
          const attempts = await redis(['EVAL', LIMIT, 1, `digivated:admin:login:${bucket}`]);
          if (attempts > 5) { res.setHeader('Retry-After', '900'); throw new AdminError(429, 'Too many sign-in attempts. Try again in 15 minutes.'); }
          if (!await verifyPassword(body.password, cfg)) throw new AdminError(401, 'The password is incorrect.');
          // A successful sign-in replaces this browser's previous session.
          const old = tokenFrom(req); if (old) await redis(['DEL', `digivated:admin:session:${digest(old)}`]);
          const session = await createSession(redis, cfg);
          res.setHeader('Set-Cookie', cookie(session.token));
          return send(200, { ok: true, csrf: session.csrf });
        }
        const session = await requireSession(req, redis, cfg);
        if (req.headers['x-admin-csrf'] !== session.csrf) throw new AdminError(403, 'Refresh the dashboard before saving.');
        if (body.action === 'logout') {
          await redis(['DEL', `digivated:admin:session:${digest(tokenFrom(req))}`]);
          res.setHeader('Set-Cookie', cookie('', true)); return send(200, { ok: true });
        }
        if (body.action !== 'save' || !['submission', 'resource', 'product'].includes(body.kind) || !body.record || typeof body.record !== 'object') throw new AdminError(400, 'Invalid dashboard action.');
        const record = await saveRecord(redis, body.kind, body.record);
        return send(200, { ok: true, record });
      }
      const session = await requireSession(req, redis, cfg);
      const url = new URL(req.url, cfg.origin);
      const action = url.searchParams.get('action') || 'session';
      if (action === 'session') return send(200, { authenticated: true, csrf: session.csrf });
      const kind = url.searchParams.get('kind');
      if (!['submission', 'resource', 'product'].includes(kind)) throw new AdminError(400, 'Invalid content type.');
      if (action === 'list') {
        const offset = Number(url.searchParams.get('offset') || 0);
        if (!Number.isInteger(offset) || offset < 0 || offset > 100000) throw new AdminError(400, 'Invalid page.');
        return send(200, await listRecords(redis, kind, offset));
      }
      if (action === 'detail') {
        const id = url.searchParams.get('id');
        if (!validId(id)) throw new AdminError(400, 'Invalid identifier.');
        const raw = await redis(['GET', storageKey(kind, id)]);
        if (!raw) throw new AdminError(404, 'This item could not be found.');
        return send(200, { record: JSON.parse(raw) });
      }
      throw new AdminError(400, 'Invalid dashboard action.');
    } catch (error) {
      // Never log private requests, passwords, cookies, Redis responses, or notes.
      send(error instanceof AdminError ? error.status : 503, { error: error instanceof AdminError ? error.message : 'Storage is unavailable. Check the submission storage settings or try again shortly.' });
    }
  };
}
