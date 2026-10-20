import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeResourceViewHandler, withResourceViews, resourceViewKey, RECORD_RESOURCE_VIEW } from '../server/resource-views.mjs';
import { carouselItemKey } from '../server/carousels.mjs';
import { makePublicHandler } from '../server/public-community.mjs';

const origin = 'https://views.test';
async function invoke(handler, { id = 'builtin-ui-ux-prompt-packet', method = 'POST', headers = {} } = {}) {
  let body;
  const response = { statusCode: 200, setHeader() {}, end(value) { body = JSON.parse(value); } };
  await handler({ method, url: `/api/resource-views?id=${id}`, headers: { origin, 'x-real-ip': '192.0.2.1', 'user-agent': 'Mozilla/5.0', ...headers } }, response);
  return { status: response.statusCode, body };
}

test('resource views validate visitors, publication and storage errors', async () => {
  const commands = [];
  const redis = async command => { commands.push(command); return 1; };
  const handler = makeResourceViewHandler({ redis, env: { SUBMISSIONS_ORIGIN: origin } });
  assert.equal((await invoke(handler, { method: 'PUT' })).status, 405);
  assert.equal((await invoke(handler, { headers: { origin: 'https://other.test' } })).status, 403);
  assert.equal((await invoke(handler, { headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
  assert.equal((await invoke(handler, { id: '../private' })).status, 404);
  assert.equal((await invoke(handler, { headers: { 'user-agent': 'Googlebot' } })).body.views, null);
  assert.equal(commands.length, 0);
  assert.deepEqual((await invoke(handler)).body, { views: 1 });
  assert.equal(commands[0][3], 'digivated:resource:builtin-ui-ux-prompt-packet');
  assert.equal(commands[0][4], resourceViewKey('builtin-ui-ux-prompt-packet'));
  assert.equal(commands[0][6], '1');
  await invoke(handler, { id: 'published-article' });
  assert.deepEqual(commands[1], ['GET', carouselItemKey('published-article')]);
  assert.equal(commands[2][0], 'EVAL');
  assert.equal(commands[2][4], resourceViewKey('published-article'));
  assert.equal(commands[2][6], '0');
  const missing = makeResourceViewHandler({ redis: async () => -1, env: { SUBMISSIONS_ORIGIN: origin } });
  assert.equal((await invoke(missing, { id: 'draft-article' })).status, 404);
  const offline = makeResourceViewHandler({ redis: async () => { throw Error('offline'); }, env: { SUBMISSIONS_ORIGIN: origin } });
  assert.equal((await invoke(offline)).status, 503);
});

test('read-only built-in counts are current without incrementing, including zero counts', async () => {
  const commands = [];
  const handler = makeResourceViewHandler({ redis: async command => { commands.push(command); return ['17']; } });
  let status = 200, body;
  await handler({ method: 'GET', url: '/api/resource-views?id=builtin-ui-ux-prompt-packet', headers: {} }, {
    setHeader() {}, set statusCode(value) { status = value; }, end(value) { body = JSON.parse(value); },
  });
  assert.equal(status, 200);
  assert.deepEqual(body.views, { 'builtin-ui-ux-prompt-packet': 17 });
  assert.deepEqual(commands[0], ['MGET', resourceViewKey('builtin-ui-ux-prompt-packet')]);
  assert.equal((await invoke(handler, { method: 'GET', id: 'private-article' })).status, 400);
});

test('published carousel views share the resource counter and the 24 hour dedupe', async () => {
  const slug = 'device-code-phishing';
  const record = JSON.stringify({ slug, slides: Array.from({ length: 9 }, (_, index) => ({ number: index + 1 })) });
  const commands = [];
  const redis = async command => {
    commands.push(command);
    if (command[0] === 'GET' && command[1] === carouselItemKey(slug)) return record;
    if (command[0] === 'MGET' && command[1] === carouselItemKey(slug)) return [record];
    if (command[0] === 'MGET' && command[1] === resourceViewKey(slug)) return ['4'];
    if (command[0] === 'MGET') return [null];
    if (command[0] === 'EVAL') return 5;
    return null;
  };
  const handler = makeResourceViewHandler({ redis, env: { SUBMISSIONS_ORIGIN: origin } });
  assert.match(RECORD_RESOURCE_VIEW, /SET',KEYS\[3\],'1','NX','EX',86400/);
  const first = await invoke(handler, { id: slug });
  assert.deepEqual(first.body, { views: 5 });
  assert.deepEqual(commands[0], ['GET', carouselItemKey(slug)]);
  assert.equal(commands[1][4], resourceViewKey(slug));
  assert.equal(commands[1][6], '1');
  assert.match(commands[1][5], /^digivated:resource-view-seen:/);
  const second = await invoke(handler, { id: slug });
  assert.deepEqual(second.body, { views: 5 });
  assert.equal(commands[3][5], commands[1][5]);
  assert.equal(commands[3][6], '1');
  commands.length = 0;
  const read = await invoke(handler, { method: 'GET', id: slug });
  assert.equal(read.status, 200);
  assert.deepEqual(read.body.views, { [slug]: 4 });
  assert.equal(commands.some(command => command[0] === 'EVAL'), false);
  assert.deepEqual(commands[0], ['MGET', carouselItemKey(slug)]);
  assert.deepEqual(commands[1], ['MGET', resourceViewKey(slug)]);
  assert.equal((await invoke(handler, { method: 'GET', id: 'not-a-real-carousel' })).status, 400);
});

test('paused dashboard resources stay unavailable while stored view counts are preserved', async () => {
  const item = { id: 'published-article', status: 'published', title: 'Article', description: 'Useful guide', category: 'Technology & AI', publishedDate: '2026-10-14', readingTime: 2, content: 'Hello' };
  const redis = async command => {
    if (command[0] === 'MGET') return ['7'];
    if (command[0] === 'GET' && command[1] === 'digivated:public:resource:published-article') return '{}';
    if (command[0] === 'GET' && command[1] === 'digivated:resource:published-article') return JSON.stringify(item);
    return null;
  };
  const publicApi = makePublicHandler('content', { redis });
  let body;
  await publicApi({ method: 'GET', url: '/api/content?type=resource&id=published-article' }, { setHeader() {}, end(value) { body = JSON.parse(value); } });
  assert.deepEqual(body, { error: 'Not found.' });
  assert.deepEqual(await withResourceViews(async () => ['3', null], [{ id: 'a' }, { id: 'b' }]), [{ id: 'a', views: 3 }, { id: 'b', views: 0 }]);
  assert.deepEqual(await withResourceViews(async () => { throw Error('offline'); }, [{ id: 'a' }]), [{ id: 'a', views: null }]);
});
