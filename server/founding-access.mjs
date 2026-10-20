import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { EncryptJWT, jwtDecrypt } from 'jose';
import { AccessError, PRODUCT_ID as PACKET_PRODUCT_ID, verifyLicense } from './access.mjs';
import { redisClient } from './submissions.mjs';

export const FOUNDING_COOKIE = '__Host-founding-session';
export const FOUNDING_MAX_AGE = 30 * 24 * 60 * 60;
const AUDIENCE = 'founding-collection';
const SALE_ID = /^[A-Za-z0-9+=/_-]{8,200}$/;
export const COMING_SOON = 'Full carousel access is coming soon.';
export const UNAVAILABLE = 'We can’t check founding access right now. Please try again shortly.';
export const INVALID_PURCHASE = 'We couldn’t verify that purchase. Use the license key or email from your Gumroad receipt.';
export const FOUNDING_HREF = '/founding-members';

export class FoundingError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const comingSoon = () => new FoundingError(403, COMING_SOON);
const unavailable = () => new FoundingError(503, UNAVAILABLE);
const invalid = () => new FoundingError(401, INVALID_PURCHASE);

export function foundingConfig(env = process.env) {
  const enabled = env.FOUNDING_ACCESS_ENABLED === 'true';
  if (!enabled) return { enabled: false, state: 'prelaunch' };
  let origin;
  try { origin = new URL(env.APP_ORIGIN); } catch { return { enabled: false, state: 'unavailable' }; }
  const productId = env.FOUNDING_GUMROAD_PRODUCT_ID || '';
  const token = env.FOUNDING_GUMROAD_ACCESS_TOKEN || '';
  const secret = env.FOUNDING_SESSION_SECRET || '';
  const productOk = productId !== PACKET_PRODUCT_ID && /^[A-Za-z0-9+=/_-]{8,120}$/.test(productId);
  if (origin.protocol !== 'https:' || origin.origin !== env.APP_ORIGIN || !productOk ||
      !/^[a-f0-9]{64}$/i.test(secret) || token.length < 20 || token.length > 400) {
    return { enabled: false, state: 'unavailable' };
  }
  return {
    enabled: true,
    state: 'open',
    origin: origin.origin,
    productId,
    gumroadToken: token,
    sessionKey: Buffer.from(secret, 'hex'),
    allowTest: env.VERCEL_ENV === 'preview' && env.FOUNDING_ALLOW_TEST_PURCHASES === 'true',
  };
}

export function normalizeEmail(value) {
  if (typeof value !== 'string') throw invalid();
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw invalid();
  return email;
}

async function gumroadJson(url, fetcher) {
  let response;
  try {
    response = await fetcher(url, {
      method: 'GET', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/json' },
    });
  } catch { throw unavailable(); }
  if (response.status === 404) throw invalid();
  if (!response.ok) throw unavailable();
  try { return await response.json(); } catch { throw unavailable(); }
}

function candidateSale(sale, cfg, email) {
  if (!sale || typeof sale !== 'object') return false;
  if (typeof sale.id !== 'string' || !SALE_ID.test(sale.id) || sale.id.includes('..')) return false;
  if (sale.product_id !== cfg.productId) return false;
  const buyer = String(sale.purchase_email || sale.email || '').trim().toLowerCase();
  if (buyer !== email) return false;
  if (sale.partially_refunded !== false || sale.chargedback !== false || sale.access_revoked !== false) return false;
  if (sale.refunded !== undefined && sale.refunded !== false) return false;
  if (sale.license_disabled === true) return false;
  if (typeof sale.disputed !== 'boolean' || (sale.disputed && sale.dispute_won !== true)) return false;
  if (sale.subscription_id || sale.is_recurring_billing === true || sale.recurring_charge === true || sale.cancelled === true || sale.ended === true) return false;
  if (sale.paid !== true && !(cfg.allowTest && sale.test === true)) return false;
  if (sale.test !== undefined && sale.test !== false && !(cfg.allowTest && sale.test === true)) return false;
  return true;
}

async function confirmSale(id, cfg, email, fetcher) {
  const url = new URL(`https://api.gumroad.com/v2/sales/${encodeURIComponent(id)}`);
  url.searchParams.set('access_token', cfg.gumroadToken);
  const data = await gumroadJson(url, fetcher);
  const sale = data?.sale;
  if (data?.success !== true || !candidateSale(sale, cfg, email) || sale.refunded !== false || sale.id !== id) return '';
  return sale.id;
}

export async function verifyFoundingEmail(email, cfg, fetcher = fetch) {
  const normalized = normalizeEmail(email);
  let pageKey = '';
  for (let page = 0; page < 3; page++) {
    const url = new URL('https://api.gumroad.com/v2/sales');
    url.searchParams.set('access_token', cfg.gumroadToken);
    url.searchParams.set('email', normalized);
    url.searchParams.set('product_id', cfg.productId);
    if (pageKey) url.searchParams.set('page_key', pageKey);
    const data = await gumroadJson(url, fetcher);
    if (data?.success !== true || !Array.isArray(data.sales)) throw unavailable();
    for (const sale of data.sales) {
      if (!candidateSale(sale, cfg, normalized)) continue;
      const saleId = await confirmSale(sale.id, cfg, normalized, fetcher);
      if (saleId) return { saleId };
    }
    if (typeof data.next_page_key !== 'string' || !/^[0-9-]{8,80}$/.test(data.next_page_key)) break;
    pageKey = data.next_page_key;
  }
  throw invalid();
}

export async function verifyFoundingLicense(license, cfg, fetcher = fetch) {
  try {
    return await verifyLicense(license, { productId: cfg.productId, allowTest: cfg.allowTest }, fetcher);
  } catch (error) {
    if (error instanceof AccessError) throw new FoundingError(error.status === 401 ? 401 : 503, error.status === 401 ? INVALID_PURCHASE : UNAVAILABLE);
    throw unavailable();
  }
}

export async function sealFoundingSession(session, cfg) {
  const claims = { saleId: session.saleId, productId: cfg.productId, method: session.method };
  if (session.method === 'license') claims.license = session.license;
  else if (session.method === 'email') claims.email = session.email;
  else throw invalid();
  return new EncryptJWT(claims)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' }).setIssuedAt()
    .setIssuer(cfg.origin).setAudience(AUDIENCE).setExpirationTime(`${FOUNDING_MAX_AGE}s`).encrypt(cfg.sessionKey);
}

export async function openFoundingSession(cookie, cfg) {
  const matches = String(cookie || '').split(';').map(part => part.trim()).filter(part => part.startsWith(`${FOUNDING_COOKIE}=`));
  if (matches.length !== 1) throw invalid();
  const token = matches[0].slice(FOUNDING_COOKIE.length + 1);
  if (!token || token.length > 4096) throw invalid();
  try {
    const { payload } = await jwtDecrypt(token, cfg.sessionKey, {
      issuer: cfg.origin, audience: AUDIENCE, keyManagementAlgorithms: ['dir'], contentEncryptionAlgorithms: ['A256GCM'],
      maxTokenAge: `${FOUNDING_MAX_AGE}s`, requiredClaims: ['exp', 'iat', 'productId', 'saleId', 'method'],
    });
    if (payload.productId !== cfg.productId || typeof payload.saleId !== 'string' || !SALE_ID.test(payload.saleId)) throw invalid();
    if (payload.method === 'license') return { method: 'license', license: payload.license, saleId: payload.saleId };
    if (payload.method === 'email') return { method: 'email', email: normalizeEmail(payload.email), saleId: payload.saleId };
    throw invalid();
  } catch (error) {
    if (error instanceof FoundingError) throw error;
    throw invalid();
  }
}

export function foundingCookie(token, clear = false) {
  return `${FOUNDING_COOKIE}=${clear ? '' : token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${clear ? 0 : FOUNDING_MAX_AGE}`;
}

export async function readMember(req, cfg, fetcher = fetch) {
  if (!cfg.enabled) return null;
  let session;
  try { session = await openFoundingSession(req.headers.cookie, cfg); }
  catch (error) { if (error instanceof FoundingError && error.status === 401) return null; throw error; }
  try {
    const purchase = session.method === 'license'
      ? await verifyFoundingLicense(session.license, cfg, fetcher)
      : session.method === 'email'
        ? await verifyFoundingEmail(session.email, cfg, fetcher)
        : null;
    if (!purchase || purchase.saleId !== session.saleId) return null;
    return session;
  } catch (error) {
    if (error instanceof FoundingError && error.status === 401) return null;
    throw error;
  }
}

async function hitLimit(redis, key) {
  const count = Number(await redis(['INCR', key]));
  if (count === 1) await redis(['EXPIRE', key, 60]);
  if (!Number.isInteger(count) || count > 10) throw new FoundingError(429, 'Too many attempts. Wait a minute, then try again.');
}

function jsonHeaders(res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Vary', 'Cookie');
}

async function readAccessBody(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new FoundingError(415, 'Please use the member sign-in form.');
  if (Number(req.headers['content-length'] || 0) > 2048) throw new FoundingError(413, 'The request is too large.');
  let body = req.body;
  if (body === undefined) {
    const chunks = []; let size = 0;
    for await (const chunk of req) {
      size += Buffer.byteLength(chunk);
      if (size > 2048) throw new FoundingError(413, 'The request is too large.');
      chunks.push(Buffer.from(chunk));
    }
    body = Buffer.concat(chunks).toString('utf8');
  }
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (typeof body === 'string') {
    if (Buffer.byteLength(body) > 2048) throw new FoundingError(413, 'The request is too large.');
    try { body = JSON.parse(body); } catch { throw new FoundingError(400, 'Please use the member sign-in form.'); }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid();
  const keys = Object.keys(body);
  if (keys.length !== 1 || !['license', 'email'].includes(keys[0])) throw invalid();
  if (keys[0] === 'license' && (typeof body.license !== 'string' || body.license.length > 100)) throw invalid();
  if (keys[0] === 'email' && (typeof body.email !== 'string' || body.email.length > 254)) throw invalid();
  return body;
}

export function makeFoundingAccessHandler(deps = {}) {
  const fetcher = deps.fetcher || fetch;
  const audit = deps.audit || (event => console.info(JSON.stringify(event)));
  return async (req, res) => {
    jsonHeaders(res);
    const send = (status, data) => { res.statusCode = status; res.end(JSON.stringify(data)); };
    try {
      if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); throw new FoundingError(405, 'Please use the member sign-in form.'); }
      if (String(req.url).includes('?')) throw new FoundingError(400, 'Please use the member sign-in form.');
      const env = deps.env || process.env;
      const cfg = foundingConfig(env);
      if (cfg.state === 'prelaunch') {
        audit({ event: 'founding_access', outcome: 'prelaunch' });
        return send(403, { error: COMING_SOON, href: FOUNDING_HREF, memberAccess: 'prelaunch' });
      }
      if (!cfg.enabled) {
        audit({ event: 'founding_access', outcome: 'unavailable' });
        return send(503, { error: UNAVAILABLE, href: FOUNDING_HREF, memberAccess: 'unavailable' });
      }
      if (req.headers['sec-fetch-site'] === 'cross-site' || req.headers.origin !== cfg.origin) throw new FoundingError(403, 'Open this carousel on Digivated and try again.');
      if (deps.limit) await deps.limit(req);
      else {
        let redis = deps.redis || null;
        if (!redis && env.SUBMISSIONS_REDIS_REST_URL && env.SUBMISSIONS_REDIS_REST_TOKEN) {
          try { redis = redisClient(env, deps.redisFetcher || fetch); } catch { redis = null; }
        }
        const ip = req.headers['x-real-ip'];
        if (!redis || typeof ip !== 'string' || !ip || ip.length > 64) throw unavailable();
        const hash = createHmac('sha256', cfg.sessionKey).update(ip).digest('hex');
        await hitLimit(redis, `digivated:founding:activate:${hash}`);
      }
      const body = await readAccessBody(req);
      const session = Object.hasOwn(body, 'license')
        ? { method: 'license', license: body.license, ...(await verifyFoundingLicense(body.license, cfg, fetcher)) }
        : { method: 'email', email: normalizeEmail(body.email), ...(await verifyFoundingEmail(body.email, cfg, fetcher)) };
      const token = await sealFoundingSession(session, cfg);
      res.setHeader('Set-Cookie', foundingCookie(token));
      audit({ event: 'founding_access', outcome: 'verified', method: session.method });
      send(200, { ok: true });
    } catch (error) {
      const status = error instanceof FoundingError ? error.status : 503;
      const message = error instanceof FoundingError ? error.message : UNAVAILABLE;
      if (!(error instanceof FoundingError)) audit({ event: 'founding_access', outcome: 'error' });
      send(status, { error: message, href: FOUNDING_HREF });
    }
  };
}

export function makeFoundingLogoutHandler(deps = {}) {
  return async (req, res) => {
    jsonHeaders(res);
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); res.statusCode = 405; res.end(JSON.stringify({ error: 'Please use the sign-out button.' })); return; }
    const env = deps.env || process.env;
    const cfg = foundingConfig(env);
    if (cfg.enabled && (req.headers['sec-fetch-site'] === 'cross-site' || req.headers.origin !== cfg.origin)) {
      res.statusCode = 403; res.end(JSON.stringify({ error: 'Open this carousel on Digivated and try again.' })); return;
    }
    res.setHeader('Set-Cookie', foundingCookie('', true));
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true }));
  };
}

export function publishAuthorized(authorization, env = process.env) {
  const expected = typeof env.CAROUSEL_PUBLISH_SECRET === 'string' ? env.CAROUSEL_PUBLISH_SECRET : '';
  const provided = typeof authorization === 'string' && authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : '';
  const configured = /^[a-f0-9]{64}$/i.test(expected);
  const same = timingSafeEqual(createHash('sha256').update(expected).digest(), createHash('sha256').update(provided).digest());
  return configured && same;
}
