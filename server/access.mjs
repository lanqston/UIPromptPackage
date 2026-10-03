import { EncryptJWT, jwtDecrypt } from 'jose';
import { createDecipheriv } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export const PRODUCT_ID = 'ELdVVW1-tlMwQyuADA6C0A==';
export const COOKIE = '__Host-uip-session';
export const MAX_AGE = 30 * 24 * 60 * 60;
export class AccessError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export const unavailable = () => new AccessError(503, 'temporarily_unavailable', 'We can’t check access right now. Please try again shortly. Your purchase is safe.');
export const invalid = () => new AccessError(401, 'invalid_access', 'We couldn’t verify active access. Copy your license key from your Gumroad receipt and try again.');
export function config(env = process.env) {
  if (env.ACCESS_ENABLED !== 'true') throw unavailable();
  let origin;
  try { origin = new URL(env.APP_ORIGIN); } catch { throw unavailable(); }
  if (origin.protocol !== 'https:' || origin.origin !== env.APP_ORIGIN ||
      !/^[a-f0-9]{64}$/i.test(env.SESSION_SECRET || '') ||
      !/^[a-f0-9]{64}$/i.test(env.EDITION_KEY || '') ||
      env.GUMROAD_PRODUCT_ID !== PRODUCT_ID) throw unavailable();
  return { origin: origin.origin, productId: PRODUCT_ID,
    sessionKey: Buffer.from(env.SESSION_SECRET, 'hex'), editionKey: Buffer.from(env.EDITION_KEY, 'hex'),
    allowTest: env.VERCEL_ENV === 'preview' && env.ALLOW_TEST_PURCHASES === 'true' };
}
export function normalizeLicense(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{8}){3}$/i.test(value.trim())) throw invalid();
  return value.trim().toUpperCase();
}
// Live verification is the source of truth, not a local grant or a notification.
export async function verifyLicense(license, cfg, fetcher = fetch) {
  let response;
  try {
    response = await fetcher('https://api.gumroad.com/v2/licenses/verify', {
      method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ product_id: cfg.productId, license_key: normalizeLicense(license), increment_uses_count: 'false' })
    });
  } catch { throw unavailable(); }
  if (response.status === 404) throw invalid();
  if (!response.ok) throw unavailable();
  let data;
  try { data = await response.json(); } catch { throw unavailable(); }
  const p = data?.purchase;
  if (data?.success !== true || !p || p.product_id !== cfg.productId ||
      typeof p.sale_id !== 'string' || !p.sale_id ||
      p.refunded !== false || p.chargebacked !== false ||
      typeof p.disputed !== 'boolean' || (p.disputed && p.dispute_won !== true) ||
      p.subscription_id || p.recurrence ||
      p.subscription_ended_at || p.subscription_cancelled_at || p.subscription_failed_at ||
      (p.test !== undefined && p.test !== false && !(cfg.allowTest && p.test === true))) throw invalid();
  return { saleId: p.sale_id }; // Do not retain email, payment details or the entire payload.
}
export async function sealSession(license, saleId, cfg) {
  return new EncryptJWT({ license: normalizeLicense(license), saleId, productId: cfg.productId })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' }).setIssuedAt()
    .setIssuer(cfg.origin).setAudience('uip-full-edition').setExpirationTime(`${MAX_AGE}s`).encrypt(cfg.sessionKey);
}
export async function openSession(cookie, cfg) {
  const matches = String(cookie || '').split(';').map(s => s.trim()).filter(s => s.startsWith(`${COOKIE}=`));
  if (matches.length !== 1) throw invalid();
  const token = matches[0].slice(COOKIE.length + 1);
  if (token.length > 2048) throw invalid();
  try {
    const { payload } = await jwtDecrypt(token, cfg.sessionKey, {
      issuer: cfg.origin, audience: 'uip-full-edition', keyManagementAlgorithms: ['dir'], contentEncryptionAlgorithms: ['A256GCM'],
      maxTokenAge: `${MAX_AGE}s`, requiredClaims: ['exp','iat','saleId','license','productId']
    });
    if (payload.productId !== cfg.productId || typeof payload.saleId !== 'string') throw invalid();
    return { license: normalizeLicense(payload.license), saleId: payload.saleId };
  } catch { throw invalid(); }
}
export function sessionCookie(token, clear = false) {
  return `${COOKIE}=${clear ? '' : token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${clear ? 0 : MAX_AGE}`;
}
export async function readEdition(cfg) {
  const bundle = JSON.parse(await readFile(new URL('./edition.enc.json', import.meta.url), 'utf8'));
  const encrypted = Buffer.from(bundle.data, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', cfg.editionKey, Buffer.from(bundle.iv, 'base64'));
  decipher.setAuthTag(encrypted.subarray(-16));
  const edition = JSON.parse(Buffer.concat([decipher.update(encrypted.subarray(0,-16)), decipher.final()]).toString('utf8'));
  if (edition.version !== 1 || edition.prompts.length !== 75 || edition.workflows.length !== 8 || edition.checklists.length !== 8) throw unavailable();
  return edition;
}
