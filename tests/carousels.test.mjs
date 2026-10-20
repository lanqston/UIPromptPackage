import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { PRODUCT_ID } from '../server/access.mjs';
import { MAX_SLIDES, makeCarouselHandler, makeCarouselPublishHandler, validateCarousel } from '../server/carousels.mjs';
import { foundingConfig, makeFoundingAccessHandler, makeFoundingLogoutHandler, sealFoundingSession, FOUNDING_COOKIE } from '../server/founding-access.mjs';
import { makePublicRouter } from '../server/public-router.mjs';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const image = `data:image/png;base64,${PNG}`;
const secret = 'ab'.repeat(32);
const productId = 'founding-product-id';
const license = 'A1B2C3D4-E5F60718-9ABCDEF0-1234ABCD';
const openEnv = {
  FOUNDING_ACCESS_ENABLED: 'true',
  APP_ORIGIN: 'https://example.test',
  FOUNDING_GUMROAD_PRODUCT_ID: productId,
  FOUNDING_SESSION_SECRET: randomBytes(32).toString('hex'),
  FOUNDING_GUMROAD_ACCESS_TOKEN: 'seller-token-fixture-value',
  VERCEL_ENV: 'production',
};

function memoryRedis() {
  const kv = new Map();
  const z = new Map();
  const writes = [];
  const redis = async command => {
    const [op, ...args] = command;
    if (op === 'SET' || op === 'ZADD') writes.push(String(args[0]));
    if (op === 'GET') return kv.has(args[0]) ? kv.get(args[0]) : null;
    if (op === 'SET') { kv.set(args[0], String(args[1])); return 'OK'; }
    if (op === 'ZADD') {
      if (!z.has(args[0])) z.set(args[0], new Map());
      z.get(args[0]).set(String(args[2]), Number(args[1]));
      return 1;
    }
    if (op === 'ZREVRANGE') {
      const items = [...(z.get(args[0]) || new Map()).entries()].sort((a, b) => b[1] - a[1]).map(([member]) => member);
      return items.slice(Number(args[1]), Number(args[2]) + 1);
    }
    if (op === 'INCR') { const n = Number(kv.get(args[0]) || 0) + 1; kv.set(args[0], String(n)); return n; }
    if (op === 'EXPIRE') return 1;
    throw new Error(`unsupported ${op}`);
  };
  return { redis, writes };
}

function carousel(slides = 7) {
  return {
    slug: 'how-indexes-work',
    title: 'How an index works',
    summary: 'A short public summary of the idea.',
    created: '2026-10-20T12:00:00.000Z',
    references: [{ label: 'Worked source', url: 'https://example.com/source', note: 'Read the definition.' }],
    slides: Array.from({ length: slides }, (_, index) => ({ text: `Private lesson ${index + 1}`, alt: `Diagram ${index + 1}`, image })),
  };
}

async function call(handler, request) {
  const headers = {};
  let body = Buffer.alloc(0);
  const res = { statusCode: 0, setHeader: (key, value) => { headers[key.toLowerCase()] = value; }, end: value => { body = Buffer.isBuffer(value) ? value : Buffer.from(String(value ?? '')); } };
  await handler({ method: 'GET', url: '/api/carousels', headers: {}, ...request }, res);
  const type = String(headers['content-type'] || '');
  return { status: res.statusCode, headers, body, json: type.includes('json') ? JSON.parse(body.toString('utf8')) : null };
}

function licenseFetcher(purchase = { product_id: productId, sale_id: 'sale-fixture', refunded: false, chargebacked: false, disputed: false, dispute_won: false, test: false }) {
  return async (url, options) => {
    assert.equal(String(url), 'https://api.gumroad.com/v2/licenses/verify');
    assert.equal(options.body.get('product_id'), productId);
    assert.notEqual(options.body.get('product_id'), PRODUCT_ID);
    return Response.json({ success: true, purchase });
  };
}

function sale(patch = {}) {
  return {
    id: 'B28UKN-dvxYabdavG97Y-Q==', email: 'member@example.test', purchase_email: 'member@example.test', product_id: productId,
    refunded: false, partially_refunded: false, chargedback: false, access_revoked: false, disputed: false, dispute_won: false,
    paid: true, test: false, subscription_id: null, license_disabled: false, ...patch,
  };
}

function emailFetcher(record = sale()) {
  return async url => {
    const href = String(url);
    assert.equal(href.startsWith('https://api.gumroad.com/'), true);
    if (href.includes('/v2/sales/')) return Response.json({ success: true, sale: record });
    return Response.json({ success: true, sales: [record] });
  };
}

test('publishing requires the secret and stores no public image payload', async () => {
  const { redis, writes } = memoryRedis();
  const publish = makeCarouselPublishHandler({ redis, env: { CAROUSEL_PUBLISH_SECRET: secret } });
  assert.equal((await call(publish, { method: 'POST', url: '/api/carousel-publish', headers: { authorization: 'Bearer no', 'content-type': 'application/json' }, body: carousel() })).status, 401);
  assert.equal((await call(publish, { method: 'POST', url: '/api/carousel-publish', headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' }, body: carousel(6) })).status, 400);
  const saved = await call(publish, { method: 'POST', url: '/api/carousel-publish', headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' }, body: carousel() });
  assert.equal(saved.status, 201);
  assert.equal(saved.json.slug, 'how-indexes-work');
  assert.equal(writes.every(key => key.startsWith('digivated:carousel:')), true);
  assert.throws(() => validateCarousel({ ...carousel(), slug: 'read' }), /slug/i);
});

test('carousel length has no editorial cap below the abuse ceiling', async () => {
  const { redis } = memoryRedis();
  const env = { CAROUSEL_PUBLISH_SECRET: secret, FOUNDING_ACCESS_ENABLED: 'false' };
  const publish = makeCarouselPublishHandler({ redis, env });
  const headers = { authorization: `Bearer ${secret}`, 'content-type': 'application/json' };
  assert.equal(MAX_SLIDES, 100);
  assert.equal((await call(publish, { method: 'POST', url: '/api/carousel-publish', headers, body: carousel(17) })).status, 201);
  const saved = await call(publish, { method: 'POST', url: '/api/carousel-publish', headers, body: carousel(MAX_SLIDES) });
  assert.equal(saved.status, 201);
  assert.equal(saved.json.slideCount, MAX_SLIDES);
  const over = await call(publish, { method: 'POST', url: '/api/carousel-publish', headers, body: carousel(MAX_SLIDES + 1) });
  assert.equal(over.status, 400);
  assert.match(over.json.error, /at most 100 slides/);
  const handler = makeCarouselHandler({ redis, env, fetcher: () => { throw new Error('gumroad should not be called'); } });
  const detail = await call(handler, { url: '/api/carousels?slug=how-indexes-work' });
  assert.equal(detail.json.item.slideCount, MAX_SLIDES);
  assert.equal(detail.json.item.previewCount, 4);
  assert.equal(detail.json.item.slides.length, 4);
  assert.equal(detail.json.item.locked.from, 5);
  assert.equal(detail.json.item.locked.count, MAX_SLIDES - 4);
  assert.equal(detail.json.item.slides.at(-1).text, 'Private lesson 4');
});

test('anonymous readers receive four slides and no locked image bytes', async () => {
  const { redis } = memoryRedis();
  const env = { CAROUSEL_PUBLISH_SECRET: secret, FOUNDING_ACCESS_ENABLED: 'false' };
  await call(makeCarouselPublishHandler({ redis, env }), { method: 'POST', url: '/api/carousel-publish', headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' }, body: carousel() });
  const handler = makeCarouselHandler({ redis, env, fetcher: () => { throw new Error('gumroad should not be called'); } });
  const list = await call(handler, { url: '/api/carousels' });
  assert.equal(list.json.items.length, 1);
  assert.equal(list.json.items[0].title, 'How an index works');
  assert.equal(list.json.memberAccess, 'prelaunch');
  assert.equal(JSON.stringify(list.json).includes('Private lesson'), false);
  assert.equal(JSON.stringify(list.json).includes(PNG), false);
  const detail = await call(handler, { url: '/api/carousels?slug=how-indexes-work' });
  assert.equal(detail.json.item.slides.length, 4);
  assert.equal(detail.json.item.slides[0].text, 'Private lesson 1');
  assert.equal(detail.json.item.locked.message, 'The rest of this carousel is for Founding Members.');
  assert.equal(detail.json.item.locked.href, '/founding-members');
  assert.deepEqual(detail.json.item.references, []);
  assert.equal(JSON.stringify(detail.json).includes(PNG), false);
  assert.equal(JSON.stringify(detail.json).includes('example.com/source'), false);
  const preview = await call(handler, { url: '/api/carousels?slug=how-indexes-work&slide=4&media=1' });
  assert.equal(preview.headers['content-type'], 'image/png');
  assert.equal(preview.body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), true);
  const locked = await call(handler, { url: '/api/carousels?slug=how-indexes-work&slide=5&media=1' });
  assert.equal(locked.status, 403);
  assert.equal(locked.headers['content-type'].includes('json'), true);
  assert.equal(locked.headers['cache-control'].includes('no-store'), true);
  assert.equal(locked.body.includes(Buffer.from([137, 80, 78, 71])), false);
  assert.equal(locked.json.href, '/founding-members');
  assert.equal(locked.body.toString().includes(PNG), false);
});

test('a packet session and a prelaunch founding cookie cannot open locked slides', async () => {
  const { redis } = memoryRedis();
  const env = { ...openEnv, CAROUSEL_PUBLISH_SECRET: secret };
  await call(makeCarouselPublishHandler({ redis, env }), { method: 'POST', url: '/api/carousel-publish', headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' }, body: carousel() });
  let calls = 0;
  const handler = makeCarouselHandler({ redis, env: { ...env, FOUNDING_ACCESS_ENABLED: 'false' }, fetcher: () => { calls += 1; throw new Error('unexpected'); } });
  const token = await sealFoundingSession({ method: 'license', license, saleId: 'sale-fixture' }, foundingConfig(env));
  const locked = await call(handler, { url: '/api/carousels?slug=how-indexes-work&slide=7&media=1', headers: { cookie: `${FOUNDING_COOKIE}=${token}` } });
  assert.equal(locked.status, 403);
  assert.equal(calls, 0);
  const packet = await call(makeCarouselHandler({ redis, env, fetcher: () => { calls += 1; return licenseFetcher()(); } }), { url: '/api/carousels?slug=how-indexes-work', headers: { cookie: '__Host-uip-session=packet-token' } });
  assert.equal(packet.json.item.slides.length, 4);
  assert.equal(calls, 0);
});

test('founding license and purchase email unlock only this product', async () => {
  const { redis } = memoryRedis();
  const env = { ...openEnv, CAROUSEL_PUBLISH_SECRET: secret };
  await call(makeCarouselPublishHandler({ redis, env }), { method: 'POST', url: '/api/carousel-publish', headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' }, body: carousel() });
  const access = makeFoundingAccessHandler({ env, limit: async () => {}, fetcher: licenseFetcher() });
  const prelaunch = await call(makeFoundingAccessHandler({ env: { FOUNDING_ACCESS_ENABLED: 'false' }, limit: async () => {}, fetcher: () => { throw new Error('gumroad should stay unused'); } }), { method: 'POST', url: '/api/founding-access?route=founding-access', headers: { origin: 'https://example.test', 'content-type': 'application/json' }, body: { license } });
  assert.equal(prelaunch.status, 403);
  const queryLicense = await call(makeFoundingAccessHandler({ env: { FOUNDING_ACCESS_ENABLED: 'false' }, limit: async () => {}, fetcher: () => { throw new Error('gumroad should stay unused'); } }), { method: 'POST', url: `/api/founding-access?route=founding-access&license=${license}`, headers: { origin: 'https://example.test', 'content-type': 'application/json' }, body: { license } });
  assert.equal(queryLicense.status, 400);
  assert.equal(prelaunch.json.href, '/founding-members');
  const badProduct = await call(makeFoundingAccessHandler({ env, limit: async () => {}, fetcher: licenseFetcher({ product_id: PRODUCT_ID, sale_id: 'sale-fixture', refunded: false, chargebacked: false, disputed: false, test: false }) }), { method: 'POST', url: '/api/founding-access', headers: { origin: env.APP_ORIGIN, 'content-type': 'application/json' }, body: { license } });
  assert.equal(badProduct.status, 401);
  const activated = await call(access, { method: 'POST', url: '/api/founding-access?route=founding-access', headers: { origin: env.APP_ORIGIN, 'content-type': 'application/json' }, body: { license } });
  assert.equal(activated.status, 200);
  assert.match(activated.headers['set-cookie'], new RegExp(`^${FOUNDING_COOKIE}=`));
  assert.doesNotMatch(activated.headers['set-cookie'], /__Host-uip-session/);
  const cookie = activated.headers['set-cookie'].split(';')[0];
  const full = await call(makeCarouselHandler({ redis, env, fetcher: licenseFetcher() }), { url: '/api/carousels?slug=how-indexes-work', headers: { cookie } });
  assert.equal(full.json.member, true);
  assert.equal(full.json.item.slides.length, 7);
  assert.equal(full.json.item.references[0].url, 'https://example.com/source');
  assert.equal(full.json.item.locked, null);
  const imageResponse = await call(makeCarouselHandler({ redis, env, fetcher: licenseFetcher() }), { url: '/api/carousels?slug=how-indexes-work&slide=7&media=1', headers: { cookie } });
  assert.equal(imageResponse.headers['content-type'], 'image/png');
  assert.match(imageResponse.headers['cache-control'], /private/);
  const refunded = await call(makeCarouselHandler({ redis, env, fetcher: licenseFetcher({ product_id: productId, sale_id: 'sale-fixture', refunded: true, chargebacked: false, disputed: false, test: false }) }), { url: '/api/carousels?slug=how-indexes-work&slide=7&media=1', headers: { cookie } });
  assert.equal(refunded.status, 401);
  assert.equal(refunded.headers['content-type'].includes('json'), true);
  const emailAccess = await call(makeFoundingAccessHandler({ env, limit: async () => {}, fetcher: emailFetcher() }), { method: 'POST', url: '/api/founding-access', headers: { origin: env.APP_ORIGIN, 'content-type': 'application/json' }, body: { email: 'Member@example.test' } });
  assert.equal(emailAccess.status, 200);
  for (const patch of [{ chargedback: true }, { access_revoked: true }, { disputed: true, dispute_won: false }, { refunded: true }, { paid: false }]) {
    const denied = await call(makeFoundingAccessHandler({ env, limit: async () => {}, fetcher: emailFetcher(sale(patch)) }), { method: 'POST', url: '/api/founding-access', headers: { origin: env.APP_ORIGIN, 'content-type': 'application/json' }, body: { email: 'member@example.test' } });
    assert.equal(denied.status, 401, JSON.stringify(patch));
  }
  const logout = await call(makeFoundingLogoutHandler({ env }), { method: 'POST', url: '/api/founding-logout', headers: { origin: env.APP_ORIGIN } });
  assert.match(logout.headers['set-cookie'], /^__Host-founding-session=;/);
  assert.equal(foundingConfig({ ...env, FOUNDING_GUMROAD_PRODUCT_ID: PRODUCT_ID }).state, 'unavailable');
  assert.equal(foundingConfig({ FOUNDING_ACCESS_ENABLED: 'false' }).state, 'prelaunch');
});

test('carousel routes stay on the shared function and do not add an API file', async () => {
  const entries = readdirSync(new URL('../api/', import.meta.url)).filter(name => name.endsWith('.js'));
  assert.equal(entries.length, 12);
  const headers = {};
  let body = '';
  const res = { statusCode: 0, setHeader: (key, value) => { headers[key] = value; }, end: value => { body = value; } };
  await makePublicRouter()({ method: 'GET', url: '/api/carousels', headers: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(body).memberAccess, 'prelaunch');
  const source = readFileSync(new URL('../src/scripts/carousel-library.js', import.meta.url), 'utf8');
  assert.equal(/buy now|join now/i.test(source), false);
  assert.match(source, /https:\/\/digivated\.gumroad\.com\/l\/founding-member-pass/);
  assert.match(source, /resource-card carousel-resource-card/);
  assert.match(source, /View carousel/);
  assert.match(source, /slides free/);
  assert.match(source, /observeResourceViews/);
  assert.match(source, /resourceViewId/);
  assert.match(source, /resourceViews/);
  assert.equal(source.includes('carousel-card'), false);
  const css = readFileSync(new URL('../src/styles/carousel-library.css', import.meta.url), 'utf8');
  assert.match(css, /height:112px/);
  assert.match(css, /repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css, /grid-template-columns:1fr/);
  assert.equal(css.includes('aspect-ratio:4/5'), false);
  assert.equal(/coming soon/i.test(source), false);
  const pages = readFileSync(new URL('../src/pages/resources/index.astro', import.meta.url), 'utf8');
  assert.match(pages, /The complete UI\/UX packet costs \$4 USD once/);
  assert.match(pages, /Educational carousels/);
  const offerPages = ['founding-members.astro', 'terms.astro'].map(name => readFileSync(new URL(`../src/pages/${name}`, import.meta.url), 'utf8')).join('\n');
  const teaser = readFileSync(new URL('../src/components/FoundingPassTeaser.astro', import.meta.url), 'utf8');
  const offer = `${offerPages}\n${teaser}\n${source}`;
  assert.match(offer, /https:\/\/digivated\.gumroad\.com\/l\/founding-member-pass/);
  assert.match(offer, /Get the Founding Member Pass/);
  assert.equal(/coming soon|aren't open|in preparation|sales aren't open/i.test(offer), false);
  assert.equal(offer.includes('\u2014'), false);
});
