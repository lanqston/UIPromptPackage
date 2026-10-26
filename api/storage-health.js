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
      const command = async input => {
        const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: AbortSignal.timeout(8000) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.error) {
          const message = String(data.error || '');
          const reason = /quota|limit|exceed|billing|payment|suspend/i.test(message) ? 'quota' : response.status === 401 || response.status === 403 ? 'authorization' : 'other';
          return { error: true, status: response.status, reason };
        }
        return { result: data.result };
      };
      const ping = await command(['PING']);
      if (ping.error) return { name, reachable: false, status: ping.status, reason: ping.reason };
      const [submissions, published] = await Promise.all([command(['ZCARD', 'digivated:submissions']), command(['ZCARD', 'digivated:public:submissions'])]);
      return { name, reachable: true, submissions: submissions.result ?? null, published: published.result ?? null };
    } catch { return { name, reachable: false, reason: 'network' }; }
  }));
  res.statusCode = 200;
  res.end(JSON.stringify({ stores: results }));
}
