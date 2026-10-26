import { launchFields, pageSlug } from './launch-pages.mjs';
import { AdminError } from './admin-auth.mjs';
import { projectCategories, resourceCategories, normalizeResourceCategory, safeUrl, statuses } from '../src/data/community.mjs';
import { validateSubmission } from './submissions.mjs';
// The owner's original picks, verified against live records on 2026-10-15.
// Only existing approved records can be displayed. No records or view totals are seeded.
const originalPicks = new Set(['03e617c5-4841-43d1-8096-5fe4a556d053','141a4936-ebfa-4051-bdc8-31f0ad8dc74f']);
export const isDigivatedPick = record => ['approved','featured'].includes(record.status) && (typeof record.pickOverride === 'boolean' ? record.pickOverride : record.pick === true || originalPicks.has(record.id));
export const packetId = 'ui-ux-prompt-packet';
export const validId = id => typeof id === 'string' && /^[a-z0-9][a-z0-9-]{0,99}$/.test(id);
export const storageKey = (kind, id) => kind === 'submission' ? `digivated:submission:${id}` : `digivated:${kind}:${id}`;
export const indexKey = kind => kind === 'submission' ? 'digivated:submissions' : `digivated:${kind}s`;
export function text(value, name, max, required = true) {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) throw new AdminError(400, `Check ${name}.`);
  return value.trim();
}
function imageValue(value) {
  if (!value) return '';
  try { return validateSubmission({ creator: 'Owner', email: 'owner@example.com', name: 'Image validation', url: 'https://example.com', description: 'Only used to validate an uploaded image.', category: 'Other', consent: true, image: value }).image; }
  catch { throw new AdminError(400, 'Use a JPG, PNG, or WebP image up to 500 KB.'); }
}
export function validateEdit(kind, input, previous) {
  if (!['submission', 'resource', 'product'].includes(kind)) throw new AdminError(400, 'Invalid content type.');
  if (!validId(input.id) || (kind === 'product' && input.id === packetId)) throw new AdminError(400, 'This product is protected or the identifier is invalid.');
  const revision = previous?.revision || 0;
  if (!Number.isInteger(input.revision) || input.revision !== revision) throw new AdminError(409, 'This item changed elsewhere. Reload it before saving.');
  const now = new Date().toISOString();
  let record;
  if (kind === 'submission') {
    if (!previous || previous.consent !== true) throw new AdminError(400, 'A submission with permission is required.');
    if (!statuses.includes(input.status) || !projectCategories.includes(input.category)) throw new AdminError(400, 'Choose a valid status and category.');
    if (input.status === 'featured' && !['approved', 'featured'].includes(previous.status)) throw new AdminError(400, 'Approve this project before featuring it.');
    const socialUrl = text(input.socialUrl, 'creator profile URL', 500, false);
    record = { ...previous, name: text(input.name, 'project name', 120), creator: text(input.creator, 'creator', 100), description: text(input.description, 'description', 600), category: input.category, status: input.status, reviewFeedback: text(input.reviewFeedback ?? previous.reviewFeedback ?? '', 'private review feedback', 1500, false), pickOverride: input.pick === true, pick: input.pick === true && ['approved', 'featured'].includes(input.status), socialUrl: socialUrl ? safeUrl(socialUrl) : '', url: safeUrl(text(input.url, 'project URL', 500)) };
    if (previous.promotion?.requested) {
      const memberIncluded = previous.promotion.included === 'founding-membership' && typeof previous.promotion.memberSaleId === 'string';
      const approving = ['approved', 'featured'].includes(input.status);
      const verified = (memberIncluded && approving) || (input.promotionVerified === undefined ? previous.promotion.verified === true : input.promotionVerified === true);
      record.promotion = {...previous.promotion, verified};
      if (verified && !previous.promotion.verified) record.promotion.verifiedAt = now;
      if (!verified) delete record.promotion.verifiedAt;
      if (['approved','featured'].includes(record.status) && !verified) throw new AdminError(400,'Verify this Digivated promo purchase in Gumroad before publishing. Match the checkout email and order reference; confirm the payment is valid and not refunded.');
    }
    if (!record.url || (socialUrl && !record.socialUrl) || record.description.length < 20) throw new AdminError(400, 'Check the project description and links.');
    if (input.image) record.image = imageValue(input.image);
    if (input.removeImage === true) record.image = '';
    Object.assign(record, launchFields(input, previous));
    if (record.page) record.slug = previous.slug || pageSlug(record);
    if (!['approved','featured'].includes(record.status)) record.pagePublished = false;
  } else {
    if (!['draft', 'published', 'archived'].includes(input.status)) throw new AdminError(400, 'Choose a valid publishing status.');
    record = { id: input.id, status: input.status, description: text(input.description, 'description', 600), date: previous?.date || now, image: input.removeImage === true ? '' : input.image ? imageValue(input.image) : previous?.image || '' };
    if (kind === 'resource') {
      const category = normalizeResourceCategory(input.category);
      if (!resourceCategories.includes(category)) throw new AdminError(400, 'Choose an article topic.');
      const date = text(input.publishedDate, 'publication date', 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date) throw new AdminError(400, 'Use a valid publication date.');
      const readingTime = Number(input.readingTime);
      if (!Number.isInteger(readingTime) || readingTime < 1 || readingTime > 180) throw new AdminError(400, 'Reading time must be 1–180 minutes.');
      const related = text(input.related || '', 'related articles', 1200, false).split(',').map(s => s.trim()).filter(Boolean);
      if (related.length > 10 || related.some(s => !validId(s))) throw new AdminError(400, 'Use up to 10 related article slugs, separated by commas.');
      record = { ...record, title: text(input.title, 'title', 160), category, publishedDate: date, readingTime, content: text(input.content, 'article content', 50000), related };
    } else {
      const url = text(input.url, 'product URL', 500);
      const destination = safeUrl(url) ? new URL(url) : null;
      const protectedPacket = destination && ((['mccovery.gumroad.com', 'digivated.gumroad.com'].includes(destination.hostname) && destination.pathname.replace(/\/$/, '') === '/l/ui-prompt-package') || (['digivated.com', 'digitalpromptpackage.vercel.app', 'digivated.vercel.app'].includes(destination.hostname) && destination.pathname.replace(/\/$/, '') === '/ui-ux-prompt-packet'));
      if (!destination || protectedPacket) throw new AdminError(400, 'Use the existing page for a different product. The UI/UX Prompt Packet is managed separately.');
      record = { ...record, name: text(input.name, 'product name', 120), url: safeUrl(url), label: text(input.label || '', 'product label', 160, false) };
    }
  }
  return { ...record, revision: revision + 1, reviewedAt: now };
}
export function projectPublic(record) {
  if (!['approved', 'featured'].includes(record.status) || record.consent !== true || (record.promotion?.requested && !record.promotion.verified)) return null;
  return { ...(record.promotion?.verified ? {sponsored:true} : {}), ...(record.pagePublished && record.page?.consent ? { pageUrl: `/projects/${record.slug}` } : {}), id: record.id, name: record.name, creator: record.creator, description: record.description, category: record.category, url: safeUrl(record.url), socialUrl: safeUrl(record.socialUrl), date: record.date, status: record.status, pick: isDigivatedPick(record), image: record.image ? `/api/projects?image=${record.id}` : '' };
}
export function contentPublic(kind, record) {
  if (record.status !== 'published') return null;
  const image = record.image ? `/api/content?type=${kind}&image=${record.id}` : '';
  if (kind === 'resource') return { id: record.id, slug: record.id, title: record.title, description: record.description, category: normalizeResourceCategory(record.category), date: record.publishedDate, readingTime: record.readingTime, content: record.content, related: record.related, coverImage: image, url: `/resources/read?slug=${record.id}` };
  return { id: record.id, name: record.name, description: record.description, label: record.label, url: record.url, image };
}
// Compare-and-save and public index update happen in one Redis script.
// Featured status belongs to each submission, so several projects can be featured.
export const SAVE_EDIT = `
local old=redis.call('GET',KEYS[1]); local revision=0
if old then revision=cjson.decode(old).revision or 0 end
if revision~=tonumber(ARGV[1]) then return 0 end
local record=cjson.decode(ARGV[2]); local id=record.id
if ARGV[5]=='submission' and record.slug then
 local key='digivated:launch-slug:'..record.slug; local owner=redis.call('GET',key)
 if owner and owner~=id then return -1 end
 redis.call('SET',key,id)
end
redis.call('SET',KEYS[1],ARGV[2]); redis.call('ZADD',KEYS[2],ARGV[4],id)
if ARGV[3]~='' then redis.call('SET',KEYS[3],ARGV[3]); redis.call('ZADD',KEYS[4],ARGV[4],id)
else redis.call('DEL',KEYS[3]); redis.call('ZREM',KEYS[4],id) end
return 1`;
export async function saveRecord(redis, kind, input) {
  if (!validId(input.id)) throw new AdminError(400, 'Invalid identifier.');
  const raw = await redis(['GET', storageKey(kind, input.id)]);
  const record = validateEdit(kind, input, raw ? JSON.parse(raw) : null);
  const projection = kind === 'submission' ? projectPublic(record) : contentPublic(kind, record);
  const result = await redis(['EVAL', SAVE_EDIT, 4, storageKey(kind, input.id), indexKey(kind), `digivated:public:${kind}:${input.id}`, `digivated:public:${kind}s`, input.revision, JSON.stringify(record), projection ? JSON.stringify(projection) : '', Date.parse(record.date), kind]);
  if (result !== 1) throw new AdminError(409, 'This item changed elsewhere. Reload it before saving.');
  return record;
}
export const LIST = `local ids=redis.call('ZREVRANGE',KEYS[1],ARGV[1],ARGV[2]); local rows={}; for _,id in ipairs(ids) do local raw=redis.call('GET',ARGV[3]..id); if raw then local r=cjson.decode(raw); r.hasImage=(r.image and r.image~='') and true or false; r.image=nil; r.content=nil; r.notes=nil; r.email=nil; if r.promotion then r.promotion.receiptReference=nil end; r.consentedAt=nil; r.consentVersion=nil; r.emailOutreachConsentedAt=nil; r.emailOutreachConsentVersion=nil; table.insert(rows,cjson.encode(r)) end end; return rows`;
export async function listRecords(redis, kind, offset = 0) {
  const prefix = kind === 'submission' ? 'digivated:submission:' : `digivated:${kind}:`;
  const rows = await redis(['EVAL', LIST, 1, indexKey(kind), offset, offset + 24, prefix]);
  return { items: rows.map(JSON.parse).map(r => kind === 'submission' ? {...r,pick:isDigivatedPick(r)} : r), next: rows.length === 25 ? offset + 25 : null };
}
export async function publicRecords(redis, kind, offset = 0, limit = 100) {
  const ids = await redis(['ZREVRANGE', `digivated:public:${kind}s`, offset, offset + limit - 1]);
  if (!ids.length) return [];
  const projections=await redis(['MGET', ...ids.map(id => `digivated:public:${kind}:${id}`)]);
  return (await redis(['MGET', ...ids.map(id => storageKey(kind,id))])).filter((raw,index)=>raw && projections[index]).map(JSON.parse).map(record => kind === 'submission' ? projectPublic(record) : contentPublic(kind,record)).filter(Boolean);
}

