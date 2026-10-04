import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeEvent } from '../src/lib/monitoring-privacy.mjs';
import { makeHandler } from '../server/handler.mjs';

test('browser error payload excludes user input and keeps application source locations', () => {
  const secret = 'PRIVATE_LICENSE_EMAIL_NOTES';
  const result = sanitizeEvent({
    event_id: 'a'.repeat(32), release: 'b'.repeat(40), environment: 'production',
    request: { url: '?license=' + secret, cookies: secret, data: secret },
    user: { email: secret }, breadcrumbs: [{ message: secret }], extra: { notes: secret },
    contexts: { arbitrary: secret }, tags: { arbitrary: secret }, message: secret,
    exception: { values: [{ type: 'TypeError', value: secret, stacktrace: { frames: [
      { filename: 'https://digitalpromptpackage.vercel.app/_astro/app.js?license=' + secret, lineno: 12, vars: { secret }, pre_context: [secret] },
      { filename: 'https://external.test/' + secret, function: secret },
    ] } }] },
  }, 'browser');
  assert(!JSON.stringify(result).includes(secret));
  assert.equal(result.exception.values[0].type, 'TypeError');
  assert.deepEqual(result.exception.values[0].stacktrace.frames, [{ filename: '/_astro/app.js', lineno: 12 }]);
  assert.equal(result.environment, 'production');
  assert.equal(result.release, 'b'.repeat(40));
});

test('server payload contains only bounded diagnostic tags', () => {
  const result = sanitizeEvent({ request: { data: 'private' }, exception: { values: [{ value: 'private' }] },
    tags: { action: 'activate', phase: 'purchase_verification', status: '503', license: 'private' },
  }, 'server');
  assert.deepEqual(result.tags, { source: 'server', action: 'activate', phase: 'purchase_verification', status: '503' });
  assert(!JSON.stringify(result).includes('private'));
});

test('server failure reporting cannot leak request data or change the response', async () => {
  const reports = [];
  let body;
  const res = { setHeader() {}, end(value) { body = JSON.parse(value); } };
  await makeHandler('activate', { env: {}, audit() {}, report: async event => {
    reports.push(event); throw new Error('provider unavailable');
  } })({ method: 'POST', url: '/api/activate', headers: {}, body: { license: 'private' } }, res);
  assert.equal(res.statusCode, 503);
  assert.deepEqual(reports, [{ action: 'activate', phase: 'configuration', status: 503 }]);
  assert(!JSON.stringify(body).includes('private'));
});

test('ordinary client errors are not sent to Sentry', async () => {
  let calls = 0;
  const res = { setHeader() {}, end() {} };
  await makeHandler('activate', { audit() {}, report: async () => { calls++; } })(
    { method: 'GET', url: '/api/activate', headers: {} }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(calls, 0);
});
