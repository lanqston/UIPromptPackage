import { AdminError } from './admin-auth.mjs';
import { carouselItemKey, MIN_SLIDES, MAX_SLIDES } from './carousels.mjs';
import { safeUrl } from '../src/data/community.mjs';
const valid = slug => typeof slug === 'string' && slug.length <= 80 && /^[a-z0-9]+(?:-[a-z0-9]+){0,12}$/.test(slug) && slug !== 'read';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function record(redis, slug) {
  if(!valid(slug))throw new AdminError(404,'This carousel could not be found.');
  const raw=await redis(['GET',carouselItemKey(slug)]);
  let item;try{item=JSON.parse(raw);}catch{}
  if(!item || item.slug!==slug || !Array.isArray(item.slides) || item.slides.length<MIN_SLIDES || item.slides.length>MAX_SLIDES)throw new AdminError(404,'This carousel could not be found.');
  return item;
}
// Called only after requireSession in the owner API. This is not a member bypass
// on the public carousel endpoint, and never writes to the carousel records.
export async function ownerCarouselList(redis, offset=0) {
  const ids=await redis(['ZREVRANGE','digivated:carousel:index',offset,offset+24]);
  const items=[];
  for(const id of Array.isArray(ids)?ids:[]){
    try{const item=await record(redis,id);items.push({id:item.slug,title:item.title,summary:item.summary,slideCount:item.slides.length,status:'available'});}
    catch(error){if(!(error instanceof AdminError && error.status===404))throw error;}
  }
  return {items,next:ids?.length===25?offset+25:null};
}
export async function ownerCarouselPreview(redis, slug) {
  const item=await record(redis,slug);
  const slides=item.slides.map((slide,index)=>{
    const image=['image/png','image/jpeg','image/webp'].includes(slide.mime) && typeof slide.image==='string' && /^[A-Za-z0-9+/]+={0,2}$/.test(slide.image)?`<img src="data:${slide.mime};base64,${slide.image}" alt="${escape(slide.alt)}" loading="lazy">`:'';
    return `<article id="slide-${index+1}"><h2>Slide ${index+1} of ${item.slides.length}</h2>${image}<p class="slide-text">${escape(slide.text)}</p><a href="#top">Back to top</a></article>`;
  }).join('');
  const references=(Array.isArray(item.references)?item.references:[]).map(ref=>{
    const url=safeUrl(ref.url);if(!url.startsWith('https://'))return '';
    return `<li><a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(ref.label)}</a><p>${escape(ref.note)}</p></li>`;
  }).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>${escape(item.title)} · Owner preview</title><style>html{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#f5f5f5;color:#171717;font:16px/1.7 system-ui,sans-serif}main{max-width:800px;margin:auto;padding:28px 20px 80px}a{color:#292929;text-underline-offset:4px}a:focus-visible{outline:2px solid #171717;outline-offset:4px}h1{font-size:clamp(1.8rem,5vw,2.7rem);line-height:1.2}h2{font-size:1.1rem}article{margin:28px 0;padding:24px;background:white;border:1px solid #d5d5d5;border-radius:16px;overflow-wrap:anywhere}img{display:block;max-width:100%;height:auto;margin:auto}.slide-text{white-space:pre-wrap}nav{display:flex;flex-wrap:wrap;gap:12px}nav a{padding:8px 12px;border:1px solid #aaa;border-radius:8px;background:#fff}li{margin:20px 0}</style></head><body><main id="top"><p>Digivated · Private owner preview</p><a href="/admin">← Owner dashboard</a><h1>${escape(item.title)}</h1><p>${escape(item.summary)}</p><p>All ${item.slides.length} slides. This preview requires your owner sign-in.</p><nav aria-label="Jump to slide">${item.slides.map((_,i)=>`<a href="#slide-${i+1}">${i+1}</a>`).join('')}</nav>${slides}${references?`<section><h2>References and further reading</h2><ul>${references}</ul></section>`:''}</main></body></html>`;
}
