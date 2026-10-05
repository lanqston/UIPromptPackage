import { withProjectViews } from './project-views.mjs';
import { redisClient } from './submissions.mjs';
import { publicRecords, validId, storageKey } from './admin-store.mjs';
export function makePublicHandler(type, deps = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, data) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(data)); };
    try {
      if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return send(405, { error: 'Method not allowed.' }); }
      const env = deps.env || process.env;
      const url = new URL(req.url, 'https://digivated.invalid');
      const kind = type === 'projects' ? 'submission' : url.searchParams.get('type') || 'resource';
      if (!['submission', 'resource', 'product'].includes(kind) || (type !== 'projects' && kind === 'submission')) return send(400, { error: 'Invalid content type.' });
      if (!deps.redis && (!env.SUBMISSIONS_REDIS_REST_URL || !env.SUBMISSIONS_REDIS_REST_TOKEN)) {
        if (url.searchParams.has('image') || url.searchParams.has('id')) return send(404, { error: 'Not found.' });
        return send(200, { items: [], next: null });
      }
      const redis = deps.redis || redisClient(env);
      const id = url.searchParams.get('image') || url.searchParams.get('id');
      if (id) {
        if (!validId(id)) return send(404, { error: 'Not found.' });
        const raw = await redis(['GET', `digivated:public:${kind}:${id}`]);
        if (!raw) return send(404, { error: 'Not found.' });
        if (!url.searchParams.has('image')) {
          const item = JSON.parse(raw);
          return send(200, { item: kind === 'submission' ? (await withProjectViews(redis, [item]))[0] : item });
        }
        const privateRaw = await redis(['GET', storageKey(kind, id)]);
        const record = privateRaw ? JSON.parse(privateRaw) : null;
        const published = kind === 'submission' ? record?.consent === true && ['approved', 'featured'].includes(record.status) : record?.status === 'published';
        const match = published && record.image?.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
        if (!match) return send(404, { error: 'Not found.' });
        res.setHeader('Content-Type', match[1]); res.setHeader('Content-Disposition', 'inline');
        res.statusCode = 200; return res.end(Buffer.from(match[2], 'base64'));
      }
      if (type === 'projects' && url.searchParams.get('view') === 'featured') {
        const featuredId = await redis(['GET', 'digivated:featured']);
        const raw = featuredId ? await redis(['GET', `digivated:public:submission:${featuredId}`]) : null;
        return send(200, { items: await withProjectViews(redis, raw ? [JSON.parse(raw)] : []), next: null });
      }
      const offset = Number(url.searchParams.get('offset') || 0);
      if (!Number.isInteger(offset) || offset < 0 || offset > 100000) return send(400, { error: 'Invalid page.' });
      let items = await publicRecords(redis, kind, offset);
      if (kind === 'submission') items = await withProjectViews(redis, items);
      // Article bodies are fetched only on the detail page.
      return send(200, { items: items.map(({ content, ...item }) => item), next: items.length === 100 ? offset + 100 : null });
    } catch { return send(503, { error: 'This collection is temporarily unavailable. Please try again shortly.' }); }
  };
}
