import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeResourceViewHandler, withResourceViews, resourceViewKey } from '../server/resource-views.mjs';
import { makePublicHandler } from '../server/public-community.mjs';

const origin = 'https://views.test';
async function invoke(handler, { id = 'make-sense-of-new-tech', method = 'POST', headers = {} } = {}) {
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
  assert.equal(commands[0][3], 'digivated:resource:make-sense-of-new-tech');
  assert.equal(commands[0][4], resourceViewKey('make-sense-of-new-tech'));
  assert.equal(commands[0][6], '1');
  await invoke(handler, { id: 'published-article' });
  assert.equal(commands[1][6], '0');
  const missing = makeResourceViewHandler({ redis: async () => -1, env: { SUBMISSIONS_ORIGIN: origin } });
  assert.equal((await invoke(missing, { id: 'draft-article' })).status, 404);
  const offline = makeResourceViewHandler({ redis: async () => { throw Error('offline'); }, env: { SUBMISSIONS_ORIGIN: origin } });
  assert.equal((await invoke(offline)).status, 503);
});

test('read-only built-in counts are current without incrementing, including zero counts', async () => {
  const commands = [];
  const handler = makeResourceViewHandler({ redis: async command => { commands.push(command); return ['17', null]; } });
  let status = 200, body;
  await handler({ method: 'GET', url: '/api/resource-views?id=make-sense-of-new-tech&id=builtin-ui-ux-prompt-packet', headers: {} }, {
    setHeader() {}, set statusCode(value) { status = value; }, end(value) { body = JSON.parse(value); },
  });
  assert.equal(status, 200);
  assert.deepEqual(body.views, { 'make-sense-of-new-tech': 17, 'builtin-ui-ux-prompt-packet': 0 });
  assert.deepEqual(commands[0], ['MGET', resourceViewKey('make-sense-of-new-tech'), resourceViewKey('builtin-ui-ux-prompt-packet')]);
  assert.equal((await invoke(handler, { method: 'GET', id: 'private-article' })).status, 400);
});

test('published dashboard resources expose their stored view counts', async () => {
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
  assert.equal(body.item.views, 7);
  assert.deepEqual(await withResourceViews(async () => ['3', null], [{ id: 'a' }, { id: 'b' }]), [{ id: 'a', views: 3 }, { id: 'b', views: 0 }]);
  assert.deepEqual(await withResourceViews(async () => { throw Error('offline'); }, [{ id: 'a' }]), [{ id: 'a', views: null }]);
});
