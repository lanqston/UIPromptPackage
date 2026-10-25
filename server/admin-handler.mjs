import { ownerCarouselList, ownerCarouselPreview } from './owner-carousels.mjs';
import { renderLaunch, launchPublic } from './launch-pages.mjs';
import { createHmac } from 'node:crypto';
import { redisClient } from './submissions.mjs';
import { AdminError, adminConfig, verifyPassword, createSession, requireSession, jsonBody, cookie, tokenFrom, digest } from './admin-auth.mjs';
import { isDigivatedPick, listRecords, saveRecord, storageKey, validId } from './admin-store.mjs';
import { listPendingComments, moderateComment } from './card-interactions.mjs';
import { listAccounts, setAccountBan } from './admin-accounts.mjs';
import { sendProjectUpdate } from './account-mail.mjs';
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
        const body = await jsonBody(req, 2900000);
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
        if (body.action === 'moderate-comment') {
          const result=await moderateComment(redis,body.id,body.status);
          if(result===-3)throw new AdminError(400,'This feedback is private. The author did not give permission for a public quote.');
          if(result!==1)throw new AdminError(result===-2?400:404,result===-2?'This item is no longer published.':'This comment is no longer pending. Refresh the list.');
          return send(200,{ok:true});
        }
        if (body.action === 'account-status') return send(200, await setAccountBan(env, body.id, body.operation, deps.accountClient));
        if (body.action !== 'save' || !['submission', 'resource', 'product'].includes(body.kind) || !body.record || typeof body.record !== 'object') throw new AdminError(400, 'Invalid dashboard action.');
        const previous = body.kind === 'submission' ? await redis(['GET',storageKey('submission',body.record.id)]) : null;
        const record = await saveRecord(redis, body.kind, body.record);
        let notification = 'skipped';
        if (body.kind === 'submission') {
          try { notification = await (deps.notifyProjectUpdate || sendProjectUpdate)(previous ? JSON.parse(previous) : null,record,env,deps.fetcher||fetch,deps.accountClient); }
          catch { notification = 'failed'; }
        }
        return send(200, { ok: true, record, notification });
      }
      const session = await requireSession(req, redis, cfg);
      const url = new URL(req.url, cfg.origin);
      const action = url.searchParams.get('action') || 'session';
      if (action === 'session') return send(200, { authenticated: true, csrf: session.csrf });
      if (action === 'comments') {
        const offset=Number(url.searchParams.get('offset')||0);
        if(!Number.isInteger(offset)||offset<0||offset>100000)throw new AdminError(400,'Invalid page.');
        return send(200,await listPendingComments(redis,offset));
      }
      if (action === 'accounts') return send(200, await listAccounts(env, Number(url.searchParams.get('page') || 1), deps.accountClient));
      if(action==='carousels'){
        const offset=Number(url.searchParams.get('offset')||0);
        if(!Number.isInteger(offset)||offset<0||offset>100000)throw new AdminError(400,'Invalid page.');
        return send(200,await ownerCarouselList(redis,offset));
      }
      if(action==='preview'&&url.searchParams.get('kind')==='carousel'){
        const html=await ownerCarouselPreview(redis,url.searchParams.get('id'));
        res.setHeader('Content-Type','text/html; charset=utf-8');
        res.setHeader('X-Robots-Tag','noindex, nofollow');
        res.setHeader('Content-Security-Policy',"default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
        res.statusCode=200;return res.end(html);
      }
      const kind = url.searchParams.get('kind');
      if (!['submission', 'resource', 'product'].includes(kind)) throw new AdminError(400, 'Invalid content type.');
      if (action === 'list') {
        const offset = Number(url.searchParams.get('offset') || 0);
        if (!Number.isInteger(offset) || offset < 0 || offset > 100000) throw new AdminError(400, 'Invalid page.');
        return send(200, await listRecords(redis, kind, offset));
      }
      if (action === 'detail' || (action === 'preview' && kind === 'submission')) {
        const id = url.searchParams.get('id');
        if (!validId(id)) throw new AdminError(400, 'Invalid identifier.');
        const raw = await redis(['GET', storageKey(kind, id)]);
        if (!raw) throw new AdminError(404, 'This item could not be found.');
        if (action === 'preview') { res.setHeader('Content-Type','text/html; charset=utf-8'); res.setHeader('X-Robots-Tag','noindex, nofollow'); res.statusCode=200; return res.end(await renderLaunch(launchPublic(JSON.parse(raw),true),{draft:true})); }
        const record = JSON.parse(raw);
        return send(200, { record: kind === 'submission' ? {...record,pick:isDigivatedPick(record)} : record });
      }
      throw new AdminError(400, 'Invalid dashboard action.');
    } catch (error) {
      // Never log private requests, passwords, cookies, Redis responses, or notes.
      send(error instanceof AdminError ? error.status : 503, { error: error instanceof AdminError ? error.message : 'Storage is unavailable. Check the submission storage settings or try again shortly.' });
    }
  };
}
