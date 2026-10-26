import { redisClient } from '../server/submissions.mjs';

// Temporary read-only recovery probe. It returns no credentials or project data.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') { res.statusCode = 405; return res.end('{}'); }
  const env = process.env;
  const stores = [
    ['configured', env.SUBMISSIONS_REDIS_REST_URL, env.SUBMISSIONS_REDIS_REST_TOKEN],
    ['original', env.KV_REST_API_URL, env.KV_REST_API_TOKEN],
    ['new', env.Digivated_KV_REST_API_URL, env.Digivated_KV_REST_API_TOKEN],
  ];
  const results = await Promise.all(stores.map(async ([name, url, token]) => {
    if (!url || !token) return { name, configured: false };
    try {
      const redis = redisClient({ SUBMISSIONS_REDIS_REST_URL: url, SUBMISSIONS_REDIS_REST_TOKEN: token });
      const [pong, submissions, published] = await Promise.all([
        redis(['PING']), redis(['ZCARD', 'digivated:submissions']), redis(['ZCARD', 'digivated:public:submissions']),
      ]);
      return { name, reachable: pong === 'PONG', submissions, published };
    } catch { return { name, reachable: false }; }
  }));
  res.statusCode = 200;
  res.end(JSON.stringify({ stores: results }));
}
