import { redisClient } from './submissions.mjs';
import { safeUrl } from '../src/data/community.mjs';
import {
  FOUNDING_HREF, FoundingError, foundingConfig, publishAuthorized, readMember,
} from './founding-access.mjs';

export const PREVIEW_COUNT = 4;
export const MIN_SLIDES = 7;
/** Abuse ceiling only. A carousel can be as long as the lesson needs, up to this count. */
export const MAX_SLIDES = 100;
const MAX_IMAGE_BYTES = 350 * 1024;
const MAX_PUBLISH_BYTES = 4_000_000;
const ITEM_PREFIX = 'digivated:carousel:item:';
const INDEX_KEY = 'digivated:carousel:index';
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+){0,12}$/;

const LOCKED_COPY = {
  prelaunch: 'The rest of this carousel is for Founding Members.',
  unavailable: 'The rest of this carousel is temporarily unavailable.',
  open: 'The rest of this carousel is for Founding Members.',
};

function storage(env, deps) {
  if (deps.redis) return deps.redis;
  if (!env.SUBMISSIONS_REDIS_REST_URL || !env.SUBMISSIONS_REDIS_REST_TOKEN) return null;
  return redisClient(env, deps.fetcher);
}

function json(res, status, data, extra = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Vary', 'Cookie');
  for (const [key, value] of Object.entries(extra)) res.setHeader(key, value);
  res.end(JSON.stringify(data));
}

function imageBytes(mime, base64) {
  const bytes = Buffer.from(base64, 'base64');
  const valid = mime === 'image/png'
    ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : mime === 'image/jpeg'
      ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : mime === 'image/webp' && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!valid || bytes.length < 12 || bytes.length > MAX_IMAGE_BYTES) return null;
  return bytes;
}

function parseImage(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) return null;
  const bytes = imageBytes(match[1], match[2]);
  if (!bytes) return null;
  return { mime: match[1], image: match[2] };
}

function fail(message) { throw new FoundingError(400, message); }

export function validateCarousel(body, now = new Date()) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Invalid carousel.');
  const text = (value, max, label) => {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(`Please check ${label}.`);
    return value.trim();
  };
  const slug = text(body.slug, 80, 'slug');
  if (!SLUG.test(slug) || slug === 'read') fail('Use a lowercase slug with letters, numbers, and hyphens.');
  const title = text(body.title, 140, 'title');
  const summary = text(body.summary, 500, 'summary');
  let created = now.toISOString();
  if (body.created !== undefined) {
    if (typeof body.created !== 'string' || Number.isNaN(Date.parse(body.created))) fail('Please check created.');
    const time = Date.parse(body.created);
    if (time > now.getTime() + 5 * 60 * 1000) fail('Please check created.');
    created = new Date(time).toISOString();
  }
  if (!Array.isArray(body.references) || body.references.length > 12) fail('Please check references.');
  const references = body.references.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) fail('Please check references.');
    const url = safeUrl(text(item.url, 500, 'reference url'));
    if (!url.startsWith('https://')) fail('Reference links must be HTTPS.');
    return { label: text(item.label, 140, 'reference label'), url, note: typeof item.note === 'string' ? item.note.trim().slice(0, 300) : '' };
  });
  if (!Array.isArray(body.slides) || body.slides.length < MIN_SLIDES) fail(`A full carousel needs at least ${MIN_SLIDES} slides.`);
  if (body.slides.length > MAX_SLIDES) fail(`A carousel can include at most ${MAX_SLIDES} slides.`);
  const slides = body.slides.map((slide, index) => {
    if (!slide || typeof slide !== 'object' || Array.isArray(slide)) fail(`Please check slide ${index + 1}.`);
    const image = parseImage(slide.image);
    if (!image) fail(`Slide ${index + 1} needs a JPG, PNG, or WebP image up to 350 KB.`);
    return { text: text(slide.text, 2000, `slide ${index + 1} text`), alt: text(slide.alt, 180, `slide ${index + 1} alt`), ...image };
  });
  return { slug, title, summary, created, references, slides };
}

function mediaPath(slug, number) {
  return `/api/carousels?slug=${encodeURIComponent(slug)}&slide=${number}&media=1`;
}

function publicSlide(record, index) {
  const slide = record.slides[index];
  return { number: index + 1, text: slide.text, alt: slide.alt, image: mediaPath(record.slug, index + 1) };
}

export function projectCarousel(record, access, member) {
  const summary = {
    slug: record.slug,
    title: record.title,
    summary: record.summary,
    created: record.created,
    slideCount: record.slides.length,
    previewCount: PREVIEW_COUNT,
  };
  const visible = member ? record.slides.length : PREVIEW_COUNT;
  const projected = {
    ...summary,
    slides: Array.from({ length: visible }, (_, index) => publicSlide(record, index)),
    references: member ? record.references : [],
    locked: member ? null : {
      from: PREVIEW_COUNT + 1,
      count: record.slides.length - PREVIEW_COUNT,
      message: LOCKED_COPY[access.state] || LOCKED_COPY.prelaunch,
      href: FOUNDING_HREF,
    },
  };
  return projected;
}

async function readRecord(redis, slug) {
  if (!SLUG.test(slug)) return null;
  const raw = await redis(['GET', ITEM_PREFIX + slug]);
  if (!raw) return null;
  try {
    const record = JSON.parse(raw);
    if (!record || record.slug !== slug || !Array.isArray(record.slides) || record.slides.length < MIN_SLIDES || record.slides.length > MAX_SLIDES) return null;
    return record;
  } catch { return null; }
}

function lockedMessage(access) {
  return { locked: true, message: LOCKED_COPY[access.state] || LOCKED_COPY.prelaunch, href: FOUNDING_HREF, memberAccess: access.state === 'open' ? 'open' : access.state };
}

async function memberFor(req, env, deps) {
  const access = foundingConfig(env);
  if (!access.enabled) return { access, member: false };
  try {
    const member = await readMember(req, access, deps.fetcher || fetch);
    return { access, member: !!member };
  } catch (error) {
    if (error instanceof FoundingError && error.status === 503) return { access: { ...access, enabled: false, state: 'unavailable' }, member: false };
    return { access, member: false };
  }
}

export function makeCarouselHandler(deps = {}) {
  return async (req, res) => {
    try {
      if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return json(res, 405, { error: 'Method not allowed.' }); }
      const env = deps.env || process.env;
      const url = new URL(req.url, 'https://digivated.invalid');
      const redis = storage(env, deps);
      const { access, member } = await memberFor(req, env, deps);
      const slug = url.searchParams.get('slug') || '';
      const slideParam = url.searchParams.get('slide');
      const media = url.searchParams.get('media') === '1';
      if (!redis) {
        if (slug || media) return json(res, 404, { error: 'This carousel is not available.' });
        return json(res, 200, { items: [], memberAccess: access.state === 'open' ? 'open' : access.state, member: false });
      }
      if (!slug) {
        const rawIds = await redis(['ZREVRANGE', INDEX_KEY, 0, 99]);
        const ids = Array.isArray(rawIds) ? rawIds : rawIds ? [rawIds] : [];
        const items = [];
        for (const id of ids) {
          const record = await readRecord(redis, String(id));
          if (!record) continue;
          items.push({ slug: record.slug, title: record.title, summary: record.summary, created: record.created, slideCount: record.slides.length, previewCount: PREVIEW_COUNT });
        }
        return json(res, 200, { items, memberAccess: access.state === 'open' ? 'open' : access.state, member });
      }
      const record = await readRecord(redis, slug);
      if (!record) return json(res, 404, { error: 'This carousel is not available.' });
      if (slideParam !== null || media) {
        if (!media || !/^[1-9][0-9]*$/.test(slideParam || '')) return json(res, 404, { error: 'This slide is not available.' });
        const number = Number(slideParam);
        if (number > record.slides.length) return json(res, 404, { error: 'This slide is not available.' });
        if (number > PREVIEW_COUNT && !member) return json(res, access.enabled ? 401 : 403, lockedMessage(access));
        const slide = record.slides[number - 1];
        const bytes = imageBytes(slide.mime, slide.image);
        if (!bytes) return json(res, 404, { error: 'This slide is not available.' });
        res.statusCode = 200;
        res.setHeader('Content-Type', slide.mime);
        res.setHeader('Content-Disposition', 'inline');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
        res.setHeader('Cache-Control', number > PREVIEW_COUNT ? 'private, no-store' : 'public, max-age=300');
        return res.end(bytes);
      }
      return json(res, 200, {
        item: projectCarousel(record, access, member),
        memberAccess: access.state === 'open' ? 'open' : access.state,
        member,
      });
    } catch {
      return json(res, 503, { error: 'Carousels are temporarily unavailable. Please try again shortly.' });
    }
  };
}

async function readPublishBody(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new FoundingError(415, 'Send the carousel as JSON.');
  if (Number(req.headers['content-length'] || 0) > MAX_PUBLISH_BYTES) throw new FoundingError(413, 'The carousel is too large.');
  let body = req.body;
  if (body === undefined) {
    const chunks = []; let size = 0;
    for await (const chunk of req) {
      size += Buffer.byteLength(chunk);
      if (size > MAX_PUBLISH_BYTES) throw new FoundingError(413, 'The carousel is too large.');
      chunks.push(Buffer.from(chunk));
    }
    body = Buffer.concat(chunks).toString('utf8');
  }
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (typeof body === 'string') {
    if (Buffer.byteLength(body) > MAX_PUBLISH_BYTES) throw new FoundingError(413, 'The carousel is too large.');
    try { body = JSON.parse(body); } catch { throw new FoundingError(400, 'Invalid carousel JSON.'); }
  }
  return body;
}

export function makeCarouselPublishHandler(deps = {}) {
  return async (req, res) => {
    try {
      if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { error: 'Method not allowed.' }); }
      const env = deps.env || process.env;
      if (!publishAuthorized(req.headers.authorization, env)) return json(res, 401, { error: 'Publishing is unavailable.' });
      const record = validateCarousel(await readPublishBody(req), deps.now ? new Date(deps.now) : new Date());
      const redis = storage(env, deps);
      if (!redis) return json(res, 503, { error: 'Carousel storage is not configured.' });
      await redis(['SET', ITEM_PREFIX + record.slug, JSON.stringify(record)]);
      await redis(['ZADD', INDEX_KEY, Date.parse(record.created), record.slug]);
      return json(res, 201, { ok: true, slug: record.slug, slideCount: record.slides.length });
    } catch (error) {
      const status = error instanceof FoundingError ? error.status : 503;
      const message = error instanceof FoundingError ? error.message : 'The carousel could not be saved.';
      return json(res, status, { error: message });
    }
  };
}
