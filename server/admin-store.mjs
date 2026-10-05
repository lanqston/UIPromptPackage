import { AdminError } from './admin-auth.mjs';
import { projectCategories, resourceCategories, safeUrl, statuses } from '../src/data/community.mjs';
import { validateSubmission } from './submissions.mjs';
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
    record = { ...previous, name: text(input.name, 'project name', 120), creator: text(input.creator, 'creator', 100), description: text(input.description, 'description', 600), category: input.category, status: input.status, pick: input.pick === true && ['approved', 'featured'].includes(input.status), socialUrl: socialUrl ? safeUrl(socialUrl) : '', url: safeUrl(text(input.url, 'project URL', 500)) };
    if (!record.url || (socialUrl && !record.socialUrl) || record.description.length < 20) throw new AdminError(400, 'Check the project description and links.');
    if (input.removeImage === true) record.image = '';
  } else {
    if (!['draft', 'published', 'archived'].includes(input.status)) throw new AdminError(400, 'Choose a valid publishing status.');
    record = { id: input.id, status: input.status, description: text(input.description, 'description', 600), date: previous?.date || now, image: input.removeImage === true ? '' : input.image ? imageValue(input.image) : previous?.image || '' };
    if (kind === 'resource') {
      if (!resourceCategories.includes(input.category)) throw new AdminError(400, 'Choose an article category.');
      const date = text(input.publishedDate, 'publication date', 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date) throw new AdminError(400, 'Use a valid publication date.');
      const readingTime = Number(input.readingTime);
      if (!Number.isInteger(readingTime) || readingTime < 1 || readingTime > 180) throw new AdminError(400, 'Reading time must be 1–180 minutes.');
      const related = text(input.related || '', 'related articles', 1200, false).split(',').map(s => s.trim()).filter(Boolean);
      if (related.length > 10 || related.some(s => !validId(s))) throw new AdminError(400, 'Use up to 10 related article slugs, separated by commas.');
      record = { ...record, title: text(input.title, 'title', 160), category: input.category, publishedDate: date, readingTime, content: text(input.content, 'article content', 50000), related };
    } else {
      const url = text(input.url, 'product URL', 500);
      const destination = safeUrl(url) ? new URL(url) : null;
      const protectedPacket = destination && ((destination.hostname === 'mccovery.gumroad.com' && destination.pathname.replace(/\/$/, '') === '/l/ui-prompt-package') || (['digitalpromptpackage.vercel.app', 'digivated.vercel.app'].includes(destination.hostname) && destination.pathname.replace(/\/$/, '') === '/ui-ux-prompt-packet'));
      if (!destination || protectedPacket) throw new AdminError(400, 'Use the existing page for a different product. The UI/UX Prompt Packet is managed separately.');
      record = { ...record, name: text(input.name, 'product name', 120), url: safeUrl(url), label: text(input.label || '', 'product label', 160, false) };
    }
  }
  return { ...record, revision: revision + 1, reviewedAt: now };
}
export function projectPublic(record) {
  if (!['approved', 'featured'].includes(record.status) || record.consent !== true) return null;
  return { id: record.id, name: record.name, creator: record.creator, description: record.description, category: record.category, url: safeUrl(record.url), socialUrl: safeUrl(record.socialUrl), date: record.date, status: record.status, pick: record.pick === true, image: record.image ? `/api/projects?image=${record.id}` : '' };
}
export function contentPublic(kind, record) {
  if (record.status !== 'published') return null;
  const image = record.image ? `/api/content?type=${kind}&image=${record.id}` : '';
  if (kind === 'resource') return { id: record.id, slug: record.id, title: record.title, description: record.description, category: record.category, date: record.publishedDate, readingTime: record.readingTime, content: record.content, related: record.related, coverImage: image, url: `/resources/read?slug=${record.id}` };
  return { id: record.id, name: record.name, description: record.description, label: record.label, url: record.url, image };
}
// Compare-and-save, public index update, and exclusive Featured Build selection
// happen in one Redis script. Concurrent editors cannot silently overwrite work.
export const SAVE_EDIT = `
local old=redis.call('GET',KEYS[1]); local revision=0
if old then revision=cjson.decode(old).revision or 0 end
if revision~=tonumber(ARGV[1]) then return 0 end
local record=cjson.decode(ARGV[2]); local id=record.id
if ARGV[5]=='submission' then
 local featured=redis.call('GET',KEYS[5])
 if record.status=='featured' then
  if featured and featured~=id then
   local otherKey='digivated:submission:'..featured; local otherRaw=redis.call('GET',otherKey)
   if otherRaw then
    local other=cjson.decode(otherRaw); other.status='approved'; other.revision=(other.revision or 0)+1; other.reviewedAt=record.reviewedAt
    redis.call('SET',otherKey,cjson.encode(other))
    local publicKey='digivated:public:submission:'..featured; local p=redis.call('GET',publicKey)
    if p then local data=cjson.decode(p); data.status='approved'; redis.call('SET',publicKey,cjson.encode(data)) end
   end
  end
  redis.call('SET',KEYS[5],id)
 elseif featured==id then redis.call('DEL',KEYS[5]) end
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
  const result = await redis(['EVAL', SAVE_EDIT, 5, storageKey(kind, input.id), indexKey(kind), `digivated:public:${kind}:${input.id}`, `digivated:public:${kind}s`, 'digivated:featured', input.revision, JSON.stringify(record), projection ? JSON.stringify(projection) : '', Date.parse(record.date), kind]);
  if (result !== 1) throw new AdminError(409, 'This item changed elsewhere. Reload it before saving.');
  return record;
}
export const LIST = `local ids=redis.call('ZREVRANGE',KEYS[1],ARGV[1],ARGV[2]); local rows={}; for _,id in ipairs(ids) do local raw=redis.call('GET',ARGV[3]..id); if raw then local r=cjson.decode(raw); r.hasImage=(r.image and r.image~='') and true or false; r.image=nil; r.content=nil; r.notes=nil; r.email=nil; r.consentedAt=nil; r.consentVersion=nil; table.insert(rows,cjson.encode(r)) end end; return rows`;
export async function listRecords(redis, kind, offset = 0) {
  const prefix = kind === 'submission' ? 'digivated:submission:' : `digivated:${kind}:`;
  const rows = await redis(['EVAL', LIST, 1, indexKey(kind), offset, offset + 24, prefix]);
  return { items: rows.map(JSON.parse), next: rows.length === 25 ? offset + 25 : null };
}
export async function publicRecords(redis, kind, offset = 0, limit = 100) {
  const ids = await redis(['ZREVRANGE', `digivated:public:${kind}s`, offset, offset + limit - 1]);
  if (!ids.length) return [];
  return (await redis(['MGET', ...ids.map(id => `digivated:public:${kind}:${id}`)])).filter(Boolean).map(JSON.parse);
}
