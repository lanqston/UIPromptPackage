import test from 'node:test';
import assert from 'node:assert/strict';
import { makeXConnectHandler, seal, unseal } from '../server/x-connect.mjs';
import { adminConfig, digest, ADMIN_COOKIE } from '../server/admin-auth.mjs';

const env = { DIGIVATED_ADMIN_PASSWORD_HASH: `scrypt:${'a'.repeat(32)}:${'b'.repeat(128)}`,
  DIGIVATED_ADMIN_SESSION_SECRET: 'c'.repeat(64), DIGIVATED_ADMIN_ORIGIN: 'https://digivated.vercel.app',
  X_CLIENT_ID: 'client', X_CLIENT_SECRET: 'secret', X_TOKEN_ENCRYPTION_KEY: 'd'.repeat(64) };
const token = 'e'.repeat(64), csrf = 'f'.repeat(64);
function fixture(username = 'digivatedx') {
  const data = new Map([[`digivated:admin:session:${digest(token)}`, JSON.stringify({ csrf, fingerprint: adminConfig(env).fingerprint })]]);
  const requests = [];
  const redis = async ([cmd, key, value]) => {
    if (cmd === 'GET') return data.get(key) ?? null;
    if (cmd === 'SET') { data.set(key, value); return 'OK'; }
    if (cmd === 'GETDEL') { const old = data.get(key) ?? null; data.delete(key); return old; }
    throw new Error('Unexpected command');
  };
  const fetcher = async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => url.endsWith('/token')
      ? { access_token: 'private-access', refresh_token: 'private-refresh', expires_in: 7200, scope: 'tweet.read users.read tweet.write offline.access' }
      : { data: { id: '12345', username } } };
  };
  const handler = makeXConnectHandler({ env, redis, fetch: fetcher });
  async function call(method, url, headers = {}, body) {
    const result = { headers: {}, statusCode: 200, body: '' };
    const res = { setHeader: (key, value) => { result.headers[key] = value; }, end: value => { result.body = value || ''; },
      set statusCode(value) { result.statusCode = value; }, get statusCode() { return result.statusCode; } };
    await handler({ method, url, headers, body }, res);
    return result;
  }
  const owner = { cookie: `${ADMIN_COOKIE}=${token}`, origin: env.DIGIVATED_ADMIN_ORIGIN,
    'content-type': 'application/json', 'x-admin-csrf': csrf };
  async function start() {
    const res = await call('POST', '/api/x-connect', owner, { action: 'connect' });
    assert.equal(res.statusCode, 200);
    const url = new URL(JSON.parse(res.body).authorizationUrl);
    return { url, cookie: res.headers['Set-Cookie'].split(';')[0], path: `/api/x-connect?action=callback&state=${url.searchParams.get('state')}&code=code` };
  }
  return { data, requests, call, owner, start };
}

test('owner login and CSRF are required before starting', async () => {
  const f = fixture();
  assert.equal((await f.call('POST', '/api/x-connect', { ...f.owner, cookie: '' }, { action: 'connect' })).statusCode, 401);
  assert.equal((await f.call('POST', '/api/x-connect', { ...f.owner, 'x-admin-csrf': '' }, { action: 'connect' })).statusCode, 403);
  assert.equal((await f.call('POST', '/api/x-connect', { ...f.owner, origin: 'https://evil.example' }, { action: 'connect' })).statusCode, 403);
  assert.equal(f.requests.length, 0);
});

test('valid callback saves encrypted credentials and cannot be replayed', async () => {
  const f = fixture(), flow = await f.start();
  assert.equal(flow.url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(flow.url.searchParams.get('redirect_uri'), 'https://digivated.vercel.app/api/x-connect?action=callback');
  const response = await f.call('GET', flow.path, { cookie: flow.cookie });
  assert.equal(response.statusCode, 303);
  const raw = f.data.get('digivated:private:x:connection');
  assert.ok(raw);
  assert.ok(!raw.includes('private-access'));
  assert.equal(unseal(raw, env.X_TOKEN_ENCRYPTION_KEY).username, 'digivatedx');
  const status = await f.call('GET', '/api/x-connect', f.owner);
  assert.equal(JSON.parse(status.body).postingEnabled, false);
  assert.ok(!status.body.includes('private-'));
  const exchange = new URLSearchParams(f.requests[0].options.body);
  assert.equal(exchange.get('grant_type'), 'authorization_code');
  assert.ok(exchange.get('code_verifier'));
  assert.equal((await f.call('GET', flow.path, { cookie: flow.cookie })).statusCode, 400);
  assert.equal(f.requests.length, 2);
});

test('wrong browser cannot consume another flow', async () => {
  const f = fixture(), flow = await f.start();
  assert.equal((await f.call('GET', flow.path, {})).statusCode, 400);
  assert.equal(f.requests.length, 0);
  assert.equal((await f.call('GET', flow.path, { cookie: flow.cookie })).statusCode, 303);
});

test('logged out owner cannot complete a pending flow', async () => {
  const f = fixture(), flow = await f.start();
  f.data.delete(`digivated:admin:session:${digest(token)}`);
  assert.equal((await f.call('GET', flow.path, { cookie: flow.cookie })).statusCode, 401);
  assert.equal(f.requests.length, 0);
});

test('a different X account cannot replace the owner connection', async () => {
  const f = fixture('other'), flow = await f.start();
  f.data.set('digivated:private:x:connection', 'existing');
  assert.equal((await f.call('GET', flow.path, { cookie: flow.cookie })).statusCode, 403);
  assert.equal(f.data.get('digivated:private:x:connection'), 'existing');
});

test('provider cancellation does not exchange tokens', async () => {
  const f = fixture(), flow = await f.start();
  assert.equal((await f.call('GET', flow.path + '&error=access_denied', { cookie: flow.cookie })).statusCode, 400);
  assert.equal(f.requests.length, 0);
});

test('concurrent callbacks exchange at most once', async () => {
  const f = fixture(), flow = await f.start();
  const results = await Promise.all([f.call('GET', flow.path, { cookie: flow.cookie }), f.call('GET', flow.path, { cookie: flow.cookie })]);
  assert.deepEqual(results.map(r => r.statusCode).sort(), [303, 400]);
  assert.equal(f.requests.length, 2);
});

test('encrypted credentials reject tampering and wrong keys', () => {
  const raw = seal({ accessToken: 'private' }, env.X_TOKEN_ENCRYPTION_KEY);
  assert.throws(() => unseal(raw, 'a'.repeat(64)));
  const value = JSON.parse(raw); value.tag = Buffer.alloc(16).toString('base64');
  assert.throws(() => unseal(JSON.stringify(value), env.X_TOKEN_ENCRYPTION_KEY));
});
