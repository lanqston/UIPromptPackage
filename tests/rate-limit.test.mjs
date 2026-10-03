import test from 'node:test';
import assert from 'node:assert/strict';
import { rateLimit } from '../server/handler.mjs';

test('one SDK rule isolates endpoints and environments and fails closed', async () => {
  const previous = { fetch: globalThis.fetch, vercel: process.env.VERCEL, mode: process.env.NODE_ENV };
  process.env.VERCEL = '1'; process.env.NODE_ENV = 'production';
  const calls = []; let status = 204;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, headers: options.headers });
    return new Response(null, {status});
  };
  const req = {headers: {'x-real-ip':'192.0.2.1', host:'attacker.invalid', cookie:'PRIVATE_COOKIE', authorization:'PRIVATE_TOKEN'}};
  const cfg = {origin:'https://preview.example.test'};
  try {
    await rateLimit(req, cfg, 'activate');
    await rateLimit(req, cfg, 'edition');
    await rateLimit(req, {origin:'https://production.example.test'}, 'activate');
    assert.equal(new Set(calls.map(c=>c.headers.get('x-vercel-rate-limit-key'))).size, 3);
    for (const c of calls) {
      assert(c.url.endsWith('/.well-known/vercel/rate-limit-api/uip-activate'));
      assert(!c.url.includes('attacker'));
      assert(!JSON.stringify([...c.headers]).includes('PRIVATE_'));
    }
    for (const responseStatus of [429,403]) {
      status=responseStatus;
      await assert.rejects(()=>rateLimit(req,cfg,'activate'),e=>e.status===429);
    }
    status=404;
    await assert.rejects(()=>rateLimit(req,cfg,'edition'),e=>e.status===503);
    status=500;
    await assert.rejects(()=>rateLimit(req,cfg,'edition'));
    await assert.rejects(()=>rateLimit({headers:{}},cfg,'edition'),e=>e.status===503);
    await assert.rejects(()=>rateLimit(req,cfg,'arbitrary'),e=>e.status===503);
    process.env.VERCEL='0';
    await assert.rejects(()=>rateLimit(req,cfg,'activate'),e=>e.status===503);
  } finally {
    globalThis.fetch=previous.fetch;
    if(previous.vercel===undefined) delete process.env.VERCEL; else process.env.VERCEL=previous.vercel;
    if(previous.mode===undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV=previous.mode;
  }
});
