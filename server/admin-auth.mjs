import { randomBytes, createHash, createHmac, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
export const ADMIN_COOKIE = '__Host-digivated-admin';
export const SESSION_SECONDS = 8 * 60 * 60;
export class AdminError extends Error { constructor(status, message) { super(message); this.status = status; } }
export const digest = value => createHash('sha256').update(value).digest('hex');
export async function passwordHash(password, salt = randomBytes(16).toString('hex')) {
  if (typeof password !== 'string' || password.length < 16 || password.length > 200) throw new Error('Use a password between 16 and 200 characters.');
  const key = await derive(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt:${salt}:${key.toString('hex')}`;
}
export function adminConfig(env = process.env) {
  const hash = env.DIGIVATED_ADMIN_PASSWORD_HASH;
  const secret = env.DIGIVATED_ADMIN_SESSION_SECRET;
  let origin;
  try { origin = new URL(env.DIGIVATED_ADMIN_ORIGIN || env.SUBMISSIONS_ORIGIN || 'https://digivated.vercel.app'); } catch { /* fail closed below */ }
  const testLocal = env.NODE_ENV === 'test' && env.VERCEL !== '1' && origin?.hostname === '127.0.0.1';
  if (!/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(hash || '') || !/^[a-f0-9]{64}$/.test(secret || '') || !origin || (origin.protocol !== 'https:' && !testLocal) || origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) {
    throw new AdminError(503, 'Owner access needs setup. Configure the admin password, session secret, and submission storage in Vercel.');
  }
  return { hash, secret, origin: origin.origin, fingerprint: createHmac('sha256', secret).update(hash).digest('hex') };
}
export async function verifyPassword(password, cfg) {
  if (typeof password !== 'string' || password.length > 200) return false;
  const [, salt, expected] = cfg.hash.split(':');
  const key = await derive(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return timingSafeEqual(key, Buffer.from(expected, 'hex'));
}
export const cookie = (token = '', clear = false) => `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${clear ? 0 : SESSION_SECONDS}`;
export function tokenFrom(req) {
  const match = String(req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${ADMIN_COOKIE}=`));
  const token = match?.slice(ADMIN_COOKIE.length + 1);
  return /^[a-f0-9]{64}$/.test(token || '') ? token : '';
}
export async function createSession(redis, cfg) {
  const token = randomBytes(32).toString('hex');
  const csrf = randomBytes(32).toString('hex');
  await redis(['SET', `digivated:admin:session:${digest(token)}`, JSON.stringify({ csrf, fingerprint: cfg.fingerprint }), 'EX', SESSION_SECONDS]);
  return { token, csrf };
}
export async function requireSession(req, redis, cfg) {
  const token = tokenFrom(req);
  if (!token) throw new AdminError(401, 'Sign in to manage Digivated.');
  const raw = await redis(['GET', `digivated:admin:session:${digest(token)}`]);
  let session;
  try { session = JSON.parse(raw); } catch { /* invalid session */ }
  if (!session || session.fingerprint !== cfg.fingerprint || !/^[a-f0-9]{64}$/.test(session.csrf || '')) throw new AdminError(401, 'Your session has expired. Sign in again.');
  return session;
}
export async function jsonBody(req, max = 720000) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new AdminError(415, 'Use the dashboard form.');
  if (Number(req.headers['content-length'] || 0) > max) throw new AdminError(413, 'This request is too large.');
  let body = req.body;
  if (body === undefined) {
    const chunks = []; let size = 0;
    for await (const chunk of req) { size += Buffer.byteLength(chunk); if (size > max) throw new AdminError(413, 'This request is too large.'); chunks.push(Buffer.from(chunk)); }
    body = Buffer.concat(chunks).toString('utf8');
  }
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (typeof body === 'string') { if (Buffer.byteLength(body) > max) throw new AdminError(413, 'This request is too large.'); try { body = JSON.parse(body); } catch { throw new AdminError(400, 'Invalid request.'); } }
  if (!body || typeof body !== 'object' || Array.isArray(body) || Buffer.byteLength(JSON.stringify(body)) > max) throw new AdminError(400, 'Invalid request.');
  return body;
}
