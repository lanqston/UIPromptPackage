import { checkRateLimit } from '@vercel/firewall';
import { AccessError, config, invalid, unavailable, verifyLicense, isOwnerKey, sealSession, sealOwnerSession, openSession, sessionCookie, readEdition } from './access.mjs';

export async function rateLimit(req, cfg, kind) {
  // Never trust a client Host for SDK outbound requests, or forward cookies/licenses to it.
  if (process.env.VERCEL !== '1' || process.env.NODE_ENV !== 'production') throw unavailable();
  const ip = req.headers['x-real-ip']; // Vercel supplies/overwrites this at its trusted edge.
  if (typeof ip !== 'string' || !ip || ip.length > 64) throw unavailable();
  // Hobby supports one SDK rule. Separate server-selected endpoint/environment
  // buckets preserve activation protection without charging browsing to its quota.
  if (!['activate', 'edition'].includes(kind)) throw unavailable();
  const result = await checkRateLimit('uip-activate', {
    headers: { host: new URL(cfg.origin).host, 'x-real-ip': ip },
    rateLimitKey: JSON.stringify([cfg.origin, kind, ip])
  });
  if (result.error === 'not-found') throw unavailable();
  if (result.rateLimited || result.error === 'blocked') throw new AccessError(429, 'rate_limited', 'Too many attempts. Wait a minute, then try again.');
}
async function jsonBody(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new AccessError(415, 'json_required', 'Please use the access form.');
  if (Number(req.headers['content-length'] || 0) > 1024) throw new AccessError(413, 'too_large', 'The request is too large.');
  let body = req.body;
  if (body === undefined) {
    const chunks = []; let size = 0;
    for await (const chunk of req) { size += Buffer.byteLength(chunk); if (size > 1024) throw new AccessError(413, 'too_large', 'The request is too large.'); chunks.push(Buffer.from(chunk)); }
    body = Buffer.concat(chunks).toString('utf8');
  }
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (typeof body === 'string') { if (Buffer.byteLength(body) > 1024) throw new AccessError(413, 'too_large', 'The request is too large.'); try { body = JSON.parse(body); } catch { throw new AccessError(400, 'invalid_input', 'Please use the access form.'); } }
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || typeof body.license !== 'string' || body.license.length > 100) throw invalid();
  return body;
}
export function makeHandler(action, deps = {}) {
  const verify = deps.verify || verifyLicense;
  const limit = deps.limit || rateLimit;
  const load = deps.load || readEdition;
  const audit = deps.audit || (event => console.info(JSON.stringify(event)));
  return async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('CDN-Cache-Control', 'no-store');
    res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Vary', 'Cookie');
    const send = (status, data) => { res.statusCode = status; res.end(JSON.stringify(data)); };
    let phase = 'request';
    try {
      if (!['activate', 'edition', 'logout'].includes(action)) throw new AccessError(404, 'not_found', 'Not found.');
      const method = action === 'edition' ? 'GET' : 'POST';
      if (req.method !== method) { res.setHeader('Allow', method); throw new AccessError(405, 'method_not_allowed', 'Please use the access page.'); }
      // Keys and activation tokens must never be accepted from URLs.
      if (String(req.url).includes('?')) throw new AccessError(400, 'invalid_input', 'Please use the access form.');
      phase = 'configuration';
      const cfg = config(deps.env || process.env);
      if (req.headers['sec-fetch-site'] === 'cross-site' ||
          (method === 'POST' && req.headers.origin !== cfg.origin)) throw new AccessError(403, 'wrong_origin', 'Open the access page on this website and try again.');
      if (action === 'logout') { res.setHeader('Set-Cookie', sessionCookie('', true)); send(200, { ok: true }); return; }
      phase = 'rate_limit';
      await limit(req, cfg, action === 'activate' ? 'activate' : 'edition');
      if (action === 'activate') {
        const { license } = await jsonBody(req);
        if (isOwnerKey(license)) {
          phase = 'edition_read';
          await load(cfg);
          phase = 'session';
          const token = await sealOwnerSession(cfg);
          res.setHeader('Set-Cookie', sessionCookie(token));
          audit({ event: 'access_activation', outcome: 'owner' });
          send(200, { ok: true }); return;
        }
        phase = 'purchase_verification';
        const purchase = await verify(license, cfg);
        phase = 'edition_read';
        await load(cfg); // Do not issue a success/session for an unreadable edition.
        phase = 'session';
        const token = await sealSession(license, purchase.saleId, cfg);
        res.setHeader('Set-Cookie', sessionCookie(token));
        audit({ event: 'access_activation', outcome: 'verified' });
        send(200, { ok: true }); return;
      }
      phase = 'session';
      const session = await openSession(req.headers.cookie, cfg);
      if (session.owner !== true) {
        phase = 'purchase_verification';
        const purchase = await verify(session.license, cfg);
        if (purchase.saleId !== session.saleId) throw invalid();
      }
      phase = 'edition_read';
      send(200, await load(cfg));
    } catch (error) {
      const safe = error instanceof AccessError ? error : unavailable();
      if (safe.status === 401 && action === 'edition') res.setHeader('Set-Cookie', sessionCookie('', true));
      if (safe.status === 429 || safe.status === 503) res.setHeader('Retry-After', '60');
      // No raw errors, request bodies, license keys, cookies, emails, or upstream payloads.
      if (safe.status !== 401) audit({ event: 'access_request', action, phase, status: safe.status, code: safe.code });
      send(safe.status, { error: safe.message, code: safe.code });
    }
  };
}
