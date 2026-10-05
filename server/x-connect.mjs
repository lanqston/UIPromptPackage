import { randomBytes, createHash, createCipheriv, createDecipheriv } from 'node:crypto';
import { AdminError, adminConfig, requireSession, jsonBody, tokenFrom, digest } from './admin-auth.mjs';
import { redisClient } from './submissions.mjs';

const COOKIE = '__Host-digivated-x-flow';
const CONNECTION = 'digivated:private:x:connection';
const TTL = 600;
const SCOPES = 'tweet.read users.read tweet.write offline.access';
const sha = text => createHash('sha256').update(text).digest('base64url');
const flowCookie = (value = '', age = TTL) => `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;

export function seal(value, hexKey) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(hexKey, 'hex'), iv);
  cipher.setAAD(Buffer.from(CONNECTION));
  const bytes = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return JSON.stringify({ version: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: bytes.toString('base64') });
}

export function unseal(raw, hexKey) {
  const value = JSON.parse(raw);
  if (value.version !== 1) throw new Error('Unsupported connection');
  const cipher = createDecipheriv('aes-256-gcm', Buffer.from(hexKey, 'hex'), Buffer.from(value.iv, 'base64'));
  cipher.setAAD(Buffer.from(CONNECTION));
  cipher.setAuthTag(Buffer.from(value.tag, 'base64'));
  return JSON.parse(Buffer.concat([cipher.update(Buffer.from(value.data, 'base64')), cipher.final()]).toString('utf8'));
}

function config(env) {
  const owner = adminConfig(env);
  if (!env.X_CLIENT_ID || !env.X_CLIENT_SECRET || !/^[a-f0-9]{64}$/.test(env.X_TOKEN_ENCRYPTION_KEY || '')) {
    throw new AdminError(503, 'X connection needs setup in Vercel.');
  }
  return { ...owner, client: env.X_CLIENT_ID, clientSecret: env.X_CLIENT_SECRET,
    encryption: env.X_TOKEN_ENCRYPTION_KEY, callback: `${owner.origin}/api/x-connect?action=callback` };
}

async function xJson(fetcher, url, options) {
  const response = await fetcher(url, { ...options, signal: AbortSignal.timeout(5000), redirect: 'error' });
  if (!response.ok) throw new AdminError(502, 'X authorization failed. Start a new connection attempt.');
  return response.json();
}

export function makeXConnectHandler(deps = {}) {
  return async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Vary', 'Cookie');
    const send = (status, data) => { res.statusCode = status; res.end(JSON.stringify(data)); };
    try {
      const env = deps.env || process.env;
      const cfg = config(env);
      const redis = deps.redis || redisClient(env);
      const fetcher = deps.fetch || fetch;
      const url = new URL(req.url, cfg.origin);
      if (url.searchParams.getAll('action').length > 1) throw new AdminError(400, 'Invalid action.');
      const action = url.searchParams.get('action');
      if (req.method === 'GET' && action === 'callback') {
        // The Strict owner cookie is absent on X's redirect. A temporary Lax cookie
        // binds the callback to the initiating browser; the saved owner session is
        // revalidated in Redis before exchanging the one-use authorization code.
        const state = url.searchParams.get('state');
        const binding = String(req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
        if (!/^[a-f0-9]{64}$/.test(state || '') || !/^[a-f0-9]{64}$/.test(binding || '') || url.searchParams.getAll('state').length !== 1) throw new AdminError(400, 'Connection expired. Start again from the owner page.');
        const key = `digivated:private:x:flow:${digest(state)}`;
        const raw = await redis(['GET', key]);
        const flow = raw ? JSON.parse(raw) : null;
        if (!flow || flow.binding !== digest(binding) || flow.fingerprint !== cfg.fingerprint) throw new AdminError(400, 'Connection expired. Start again from the owner page.');
        const sessionRaw = await redis(['GET', flow.sessionKey]);
        const session = sessionRaw ? JSON.parse(sessionRaw) : null;
        if (session?.fingerprint !== cfg.fingerprint) throw new AdminError(401, 'Sign in again before connecting X.');
        if (await redis(['GETDEL', key]) !== raw) throw new AdminError(400, 'This connection attempt was already used.');
        res.setHeader('Set-Cookie', flowCookie('', 0));
        if (url.searchParams.has('error')) throw new AdminError(400, 'X connection was cancelled.');
        const code = url.searchParams.get('code');
        if (!code || code.length > 2048 || url.searchParams.getAll('code').length !== 1) throw new AdminError(400, 'Missing authorization code.');
        const basic = Buffer.from(`${encodeURIComponent(cfg.client)}:${encodeURIComponent(cfg.clientSecret)}`).toString('base64');
        const tokens = await xJson(fetcher, 'https://api.x.com/2/oauth2/token', {
          method: 'POST', headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: cfg.callback, code_verifier: flow.verifier }).toString(),
        });
        const scopes = new Set(String(tokens.scope || '').split(' '));
        if (typeof tokens.access_token !== 'string' || !tokens.access_token || typeof tokens.refresh_token !== 'string' || !tokens.refresh_token || !Number.isFinite(tokens.expires_in) || tokens.expires_in <= 0 || !SCOPES.split(' ').every(s => scopes.has(s))) throw new AdminError(502, 'X did not grant the required connection permissions.');
        const user = await xJson(fetcher, 'https://api.x.com/2/users/me', { headers: { Authorization: `Bearer ${tokens.access_token}` } });
        if (user.data?.username?.toLowerCase() !== 'digivatedx' || !/^\d+$/.test(user.data?.id || '')) throw new AdminError(403, 'Authorize @digivatedx. No connection was saved for this account.');
        const record = { userId: user.data.id, username: user.data.username, accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token, scope: tokens.scope, expiresAt: Date.now() + tokens.expires_in * 1000, connectedAt: new Date().toISOString() };
        await redis(['SET', CONNECTION, seal(record, cfg.encryption)]);
        res.statusCode = 303;
        res.setHeader('Location', `${cfg.origin}/connect-x.html`);
        return res.end();
      }
      if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); throw new AdminError(405, 'Unsupported method.'); }
      if (req.headers['sec-fetch-site'] === 'cross-site' || (req.method === 'POST' && req.headers.origin !== cfg.origin)) throw new AdminError(403, 'Open the owner page on Digivated.');
      const session = await requireSession(req, redis, cfg);
      if (req.method === 'GET' && !action) {
        const raw = await redis(['GET', CONNECTION]);
        const record = raw ? unseal(raw, cfg.encryption) : null;
        return send(200, { connected: Boolean(record), username: record?.username || null,
          accessTokenExpired: record ? record.expiresAt <= Date.now() : null, postingEnabled: false });
      }
      if (req.method !== 'POST' || url.search) throw new AdminError(400, 'Invalid connection request.');
      if (req.headers['x-admin-csrf'] !== session.csrf) throw new AdminError(403, 'Refresh the page before connecting.');
      const body = await jsonBody(req, 1024);
      if (body.action !== 'connect') throw new AdminError(400, 'Invalid connection action.');
      const state = randomBytes(32).toString('hex');
      const binding = randomBytes(32).toString('hex');
      const verifier = randomBytes(32).toString('base64url');
      await redis(['SET', `digivated:private:x:flow:${digest(state)}`, JSON.stringify({ binding: digest(binding), verifier,
        fingerprint: cfg.fingerprint, sessionKey: `digivated:admin:session:${digest(tokenFrom(req))}` }), 'EX', TTL]);
      res.setHeader('Set-Cookie', flowCookie(binding));
      const authorization = new URL('https://x.com/i/oauth2/authorize');
      authorization.search = new URLSearchParams({ response_type: 'code', client_id: cfg.client, redirect_uri: cfg.callback,
        scope: SCOPES, state, code_challenge: sha(verifier), code_challenge_method: 'S256' }).toString();
      return send(200, { authorizationUrl: authorization.href });
    } catch (error) {
      // OAuth codes, cookies, provider responses and tokens must never enter logs.
      return send(error instanceof AdminError ? error.status : 503,
        { error: error instanceof AdminError ? error.message : 'Connection unavailable. Start again or check storage settings.' });
    }
  };
}
