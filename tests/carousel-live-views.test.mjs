import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

function client(fetcher = async () => ({ ok: true, json: async () => ({ views: {} }) })) {
  const labels = [];
  const timers = [];
  const events = new Map();
  const document = {
    hidden: false,
    querySelector: () => null,
    getElementById: () => null,
    querySelectorAll: () => labels,
    addEventListener: (name, fn) => events.set(name, fn),
    createElement: () => ({ dataset: {}, children: [], append(...nodes) { this.children.push(...nodes); } }),
  };
  const source = readFileSync(new URL('../src/scripts/carousel-library.js', import.meta.url), 'utf8').replace(/^import .*;$/gm, '');
  const api = runInNewContext(`${source}\n;({viewStat,showStoredViews,bindCarouselViews,refreshCarouselViews})`, {
    document, window: { addEventListener: (name, fn) => events.set(name, fn) },
    fetch: fetcher, AbortSignal, URLSearchParams, Intl,
    cardIconMarkup: () => '', observeResourceViews() {},
    viewLabel: n => Number.isSafeInteger(n) && n >= 0 ? `${n} ${n === 1 ? 'view' : 'views'}` : 'Views unavailable',
    setInterval: (fn, interval) => { timers.push({ fn, interval }); return timers.length; },
  });
  return { api, labels, timers, events, document };
}

test('carousel counts retain current totals when cards are rebuilt, including a real zero', () => {
  const { api, labels } = client();
  const label = { dataset: { resourceViews: 'sample' }, textContent: 'Views unavailable' };
  labels.push(label);
  api.showStoredViews({ sample: 0 });
  assert.equal(label.textContent, '0 views');
  api.showStoredViews({ sample: 19 });
  assert.equal(api.viewStat('sample').children[1].textContent, '19 views');
  api.showStoredViews({ sample: 17 });
  assert.equal(label.textContent, '19 views');
  assert.equal(api.viewStat('sample').children[1].textContent, '19 views');
});

test('carousel refresh batches large libraries and refreshes on return without recording views', async () => {
  const requests = [];
  const { api, labels, timers, events, document } = client(async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => ({ views: Object.fromEntries(new URL(url, 'https://example.test').searchParams.getAll('id').map(id => [id, 7])) }) };
  });
  const ids = Array.from({ length: 45 }, (_, i) => `carousel-${i}`);
  labels.push(...ids.map(id => ({ dataset: { resourceViews: id }, textContent: 'Views unavailable' })));
  api.bindCarouselViews(ids);
  // Let both read batches finish.
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests.length, 2);
  assert.equal(labels[44].textContent, '7 views');
  assert.ok(requests.every(r => !r.options.method && r.options.cache === 'no-store'));
  assert.equal(timers[0].interval, 60000);
  document.hidden = true;
  await timers[0].fn();
  assert.equal(requests.length, 2);
  document.hidden = false;
  await events.get('focus')();
  assert.equal(requests.length, 4);
});

test('a temporary count read failure preserves known totals', async () => {
  const { api, labels } = client(async () => { throw Error('offline'); });
  labels.push({ dataset: { resourceViews: 'sample' }, textContent: '23 views' });
  api.showStoredViews({ sample: 23 });
  api.bindCarouselViews(['sample']);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(labels[0].textContent, '23 views');
  assert.equal(api.viewStat('sample').children[1].textContent, '23 views');
});
