import { createSign } from 'node:crypto';

// Only aggregate counts leave this module. Google credentials remain server-side.
export async function getVisitorReport({ env = process.env, fetcher = fetch, now = new Date() } = {}) {
  const property = env.GA4_PROPERTY_ID;
  if (!property || !env.GA4_CLIENT_EMAIL || !env.GA4_PRIVATE_KEY) return { status: 'unconfigured' };
  if (!/^\d+$/.test(property)) throw new Error('Invalid GA4 property');
  const issuedAt = Math.floor(now.getTime() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iss: env.GA4_CLIENT_EMAIL, scope: 'https://www.googleapis.com/auth/analytics.readonly', aud: 'https://oauth2.googleapis.com/token', iat: issuedAt, exp: issuedAt + 3600 })}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(env.GA4_PRIVATE_KEY.replace(/\\n/g, '\n'), 'base64url');
  const tokenResponse = await fetcher('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }), signal: AbortSignal.timeout(4000) });
  if (!tokenResponse.ok) throw new Error('Analytics authentication failed');
  const token = (await tokenResponse.json()).access_token;
  if (!token) throw new Error('Missing analytics token');
  const report = async dimensions => {
    const response = await fetcher(`https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ dateRanges: [{ startDate: '30daysAgo', endDate: 'yesterday' }], metrics: [{ name: 'totalUsers' }], dimensions, ...(dimensions.length ? { orderBys: [{ dimension: { dimensionName: 'date' } }] } : {}) }), signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('Analytics report unavailable');
    return response.json();
  };
  // The period total must be queried separately: daily unique users cannot be summed.
  const [total, trend] = await Promise.all([report([]), report([{ name: 'date' }])]);
  const count = value => { const number = Number(value ?? 0); if (!Number.isSafeInteger(number) || number < 0) throw new Error('Invalid analytics count'); return number; };
  const dateInProperty = new Intl.DateTimeFormat('en-CA', { timeZone: trend.metadata?.timeZone || 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const day = new Date(`${dateInProperty}T12:00:00Z`);
  const rows = new Map((trend.rows || []).map(row => [row.dimensionValues[0].value, count(row.metricValues[0].value)]));
  const daily = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(day); date.setUTCDate(date.getUTCDate() - 30 + index);
    const iso = date.toISOString().slice(0, 10);
    return { date: iso, visitors: rows.get(iso.replaceAll('-', '')) || 0 };
  });
  return { status: 'ready', visitors: count(total.rows?.[0]?.metricValues?.[0]?.value), daily, startDate: daily[0].date, endDate: daily[29].date, updatedAt: now.toISOString() };
}
