import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { getVisitorReport } from '../server/visitors.mjs';
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const env = { GA4_PROPERTY_ID: '123', GA4_CLIENT_EMAIL: 'viewer@example.test', GA4_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
test('missing credentials never return a fabricated visitor count', async () => {
  assert.deepEqual(await getVisitorReport({ env: {}, fetcher: () => { throw new Error('Should not fetch'); } }), { status: 'unconfigured' });
});
test('uses deduplicated period total and fills daily gaps in property timezone', async () => {
  const requests = [];
  const fetcher = async (url, options) => {
    if (url.includes('oauth2')) return { ok: true, json: async () => ({ access_token: 'fixture' }) };
    const body = JSON.parse(options.body); requests.push(body);
    return { ok: true, json: async () => body.dimensions.length ? { metadata: { timeZone: 'America/New_York' }, rows: [{ dimensionValues: [{ value: '20261003' }], metricValues: [{ value: '8' }] }, { dimensionValues: [{ value: '20261002' }], metricValues: [{ value: '8' }] }] } : { rows: [{ metricValues: [{ value: '10' }] }] } };
  };
  const result = await getVisitorReport({ env, fetcher, now: new Date('2026-10-05T03:00:00Z') });
  assert.equal(result.visitors, 10);
  assert.equal(result.daily.length, 30);
  assert.equal(result.startDate, '2026-09-04');
  assert.equal(result.endDate, '2026-10-03');
  assert.equal(result.daily[0].visitors, 0);
  assert.equal(result.daily[29].visitors, 8);
  assert.deepEqual(requests[0].dateRanges, [{ startDate: '30daysAgo', endDate: 'yesterday' }]);
});
test('Google authentication failure cannot be mistaken for zero visitors', async () => {
  await assert.rejects(getVisitorReport({ env, fetcher: async () => ({ ok: false }) }), /authentication failed/);
});
