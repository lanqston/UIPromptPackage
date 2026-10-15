import { createHmac } from 'node:crypto';
import resources from '../src/data/resources.json' with { type: 'json' };
import { redisClient } from './submissions.mjs';

const builtins = new Set(['builtin-ui-ux-prompt-packet', ...resources.filter(item => item.status === 'published').map(item => item.slug)]);
export const resourceViewKey = id => `digivated:resource-views:${id}`;
export const RECORD_RESOURCE_VIEW = `
if ARGV[1] ~= '1' then
 local raw=redis.call('GET',KEYS[1])
 if not raw then return -1 end
 local ok,record=pcall(cjson.decode,raw)
 if not ok or type(record)~='table' or record.status~='published' then return -1 end
end
if redis.call('SET',KEYS[3],'1','NX','EX',86400) then return redis.call('INCR',KEYS[2]) end
return tonumber(redis.call('GET',KEYS[2]) or '0')`;

export async function withResourceViews(redis, items) {
  if (!items.length) return items;
  try {
    const counts = await redis(['MGET', ...items.map(item => resourceViewKey(item.id))]);
    return items.map((item, i) => ({ ...item, views: Number(counts[i] || 0) }));
  } catch {
    return items.map(item => ({ ...item, views: null }));
  }
}

export function makeResourceViewHandler(deps = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, body) => { res.statusCode = status; res.end(JSON.stringify(body)); };
    try {
      if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(405, { error: 'Method not allowed.' }); }
      const env = deps.env || process.env;
      if (req.headers.origin !== (env.SUBMISSIONS_ORIGIN || 'https://digivated.com') || req.headers['sec-fetch-site'] === 'cross-site') return send(403, { error: 'Use the Digivated website.' });
      const id = new URL(req.url, 'https://digivated.invalid').searchParams.get('id');
      if (!id || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(id)) return send(404, { error: 'Resource not found.' });
      if (/bot|crawler|spider|headless|preview/i.test(req.headers['user-agent'] || '')) return send(200, { views: null });
      const ip = req.headers['x-real-ip'];
      if (!deps.redis && (env.VERCEL !== '1' || typeof ip !== 'string' || !ip || !env.SUBMISSIONS_REDIS_REST_TOKEN)) return send(503, { error: 'Views temporarily unavailable.' });
      const visitor = createHmac('sha256', env.SUBMISSIONS_REDIS_REST_TOKEN || 'test-only').update(`${id}:${ip || 'fixture'}`).digest('hex');
      const redis = deps.redis || redisClient(env);
      const views = await redis(['EVAL', RECORD_RESOURCE_VIEW, 3, `digivated:resource:${id}`, resourceViewKey(id), `digivated:resource-view-seen:${visitor}`, builtins.has(id) ? '1' : '0']);
      if (views === -1) return send(404, { error: 'Resource not found.' });
      return send(200, { views });
    } catch { return send(503, { error: 'Views temporarily unavailable.' }); }
  };
}
