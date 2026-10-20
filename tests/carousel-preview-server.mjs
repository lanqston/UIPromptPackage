// Local-only UI fixture. Never imported by API handlers or production code.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { deflateSync, crc32 } from 'node:zlib';
import { makeCarouselHandler, makeCarouselPublishHandler } from '../server/carousels.mjs';
import { makePublicHandler } from '../server/public-community.mjs';
import { defaultPublicHandlers, makePublicRouter } from '../server/public-router.mjs';

if (process.env.VERCEL) throw new Error('Local fixture only.');

function png(width, height, rgb, mark) {
  const chunk = (type, data) => {
    const name = Buffer.from(type);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
    return Buffer.concat([length, name, data, crc]);
  };
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const start = y * (width * 3 + 1);
    for (let x = 0; x < width; x++) {
      const band = y > height * 0.72 && y < height * 0.86 && x > width * 0.12 && x < width * (0.28 + mark * 0.08);
      const bar = Math.abs(y - Math.floor(height * (0.18 + mark * 0.08))) < 10 && x > width * 0.12 && x < width * 0.88;
      const pixel = band || bar ? [70, 70, 70] : rgb;
      raw.set(pixel, start + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function memoryRedis() {
  const kv = new Map();
  const z = new Map();
  return async command => {
    const [op, ...args] = command;
    if (op === 'GET') return kv.has(args[0]) ? kv.get(args[0]) : null;
    if (op === 'SET') { kv.set(args[0], String(args[1])); return 'OK'; }
    if (op === 'ZADD') {
      if (!z.has(args[0])) z.set(args[0], new Map());
      z.get(args[0]).set(String(args[2]), Number(args[1]));
      return 1;
    }
    if (op === 'ZREVRANGE') {
      const items = [...(z.get(args[0]) || new Map()).entries()].sort((a, b) => b[1] - a[1]).map(([member]) => member);
      return items.slice(Number(args[1]), Number(args[2]) + 1);
    }
    if (op === 'INCR') return 1;
    if (op === 'EXPIRE') return 1;
    throw new Error(`unsupported ${op}`);
  };
}

const secret = 'cd'.repeat(32);
const redis = memoryRedis();
const slides = [0, 1, 2, 3, 4, 5, 6].map(index => {
  const shade = 210 - index * 12;
  return {
    text: index < 4
      ? `Preview slide ${index + 1}. This local fixture shows the public explanation.`
      : `Locked slide ${index + 1}. This text must not appear for anonymous visitors.`,
    alt: `Silver fixture slide ${index + 1}`,
    image: `data:image/png;base64,${png(960, 540, [shade, shade, shade], index).toString('base64')}`,
  };
});
const env = { CAROUSEL_PUBLISH_SECRET: secret, FOUNDING_ACCESS_ENABLED: 'false' };
const publish = makeCarouselPublishHandler({ redis, env, now: '2026-10-20T15:00:00.000Z' });
await new Promise((resolvePromise, reject) => {
  const res = { statusCode: 0, setHeader() {}, end(value) { this.body = value; resolvePromise(this); } };
  publish({
    method: 'POST', url: '/api/carousel-publish',
    headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
    body: {
      slug: 'sample-carousel',
      title: 'Sample carousel',
      summary: 'A local fixture with seven slides. The first four are public. The rest stay locked while founding access is in prelaunch.',
      references: [{ label: 'Fixture source', url: 'https://example.com/source', note: 'Not a live reference.' }],
      slides,
    },
  }, res).catch(reject);
});

const router = makePublicRouter(defaultPublicHandlers({
  carousels: makeCarouselHandler({ redis, env }),
  'carousel-publish': makeCarouselPublishHandler({ redis, env }),
}));
const root = resolve('dist');
const headers = JSON.parse(await readFile('vercel.json', 'utf8')).headers[0].headers;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };

createServer(async (req, res) => {
  for (const header of headers) {
    if (header.key === 'Content-Security-Policy') {
      res.setHeader(header.key, header.value.replace('; upgrade-insecure-requests', ''));
    } else res.setHeader(header.key, header.value);
  }
  const url = new URL(req.url, 'http://127.0.0.1:4174');
  if (url.pathname === '/api/projects') return makePublicHandler('projects')(req, res);
  if (url.pathname.startsWith('/api/')) return router(req, res);
  let pathname = url.pathname;
  if (/^\/carousels\/[^/]+\/?$/.test(pathname) && !pathname.startsWith('/carousels/read')) pathname = '/carousels/read/';
  let path = resolve(root, `.${pathname}`);
  if (!path.startsWith(`${root}/`) && path !== root) { res.writeHead(403); res.end(); return; }
  if (!extname(path)) path = resolve(path, 'index.html');
  try {
    res.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream');
    res.end(await readFile(path));
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(4174, '127.0.0.1', () => console.log('Carousel fixture: http://127.0.0.1:4174/carousels/sample-carousel'));
