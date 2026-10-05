import { isPublished, safeUrl } from '../src/data/community.mjs';
// Deliberate allowlist: private review fields must never enter public build input.
export function publicRecord(record) {
  if (!isPublished(record) || record.consent !== true) return null;
  if (!safeUrl(record.url)) throw new Error('Invalid project URL');
  return {id:record.id,name:record.name,creator:record.creator,description:record.description,category:record.category,url:safeUrl(record.url),socialUrl:safeUrl(record.socialUrl),date:record.date,status:record.status,pick:record.pick===true,image:record.image?`/community/${record.id}.${record.image.startsWith('data:image/jpeg;')?'jpg':record.image.startsWith('data:image/png;')?'png':'webp'}`:''};
}
