import { resourceArticlesVisible } from '../src/data/resource-publication.mjs';
import resources from '../src/data/resources.json' with { type:'json' };
import { redisClient } from './submissions.mjs';
import { projectPublic, contentPublic, validId, storageKey } from './admin-store.mjs';
import { carouselItemKey, MIN_SLIDES } from './carousels.mjs';
export function makeSavedItemHandler(deps={}){
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('X-Content-Type-Options','nosniff');
  const send=(status,body)=>{res.statusCode=status;res.end(JSON.stringify(body));};
  try{
   if(req.method!=='GET')return send(405,{error:'Method not allowed.'});
   const url=new URL(req.url,'https://digivated.invalid'),type=url.searchParams.get('type'),id=url.searchParams.get('id');
   if(!['project','resource','carousel'].includes(type)||!validId(id))return send(404,{error:'Not found.'});
   if(type==='carousel'){
    const env=deps.env||process.env;
    if(!deps.redis&&!env.SUBMISSIONS_REDIS_REST_URL)return send(404,{error:'Not found.'});
    const redis=deps.redis||redisClient(env);
    const raw=await redis(['GET',carouselItemKey(id)]);
    const item=raw?JSON.parse(raw):null;
    if(!item||item.slug!==id||typeof item.title!=='string'||typeof item.summary!=='string'||!Array.isArray(item.slides)||item.slides.length<MIN_SLIDES)return send(404,{error:'Not found.'});
    return send(200,{item:{id,title:item.title,description:item.summary,url:`/carousels/${encodeURIComponent(id)}`}});
   }
   if(type==='resource'&&id==='builtin-ui-ux-prompt-packet')return send(200,{item:{id,title:'UI/UX Prompt Packet',description:'75 practical prompts, workflows, and checklists.',url:'/ui-ux-prompt-packet'}});
   if(type==='resource'&&!resourceArticlesVisible)return send(404,{error:'Not found.'});
   const staticResource=type==='resource'?resources.find(r=>r.slug===id&&r.status==='published'):null;
   if(staticResource)return send(200,{item:{id,title:staticResource.title,description:staticResource.description,url:`/resources/${staticResource.slug}`}});
   const env=deps.env||process.env;if(!deps.redis&&!env.SUBMISSIONS_REDIS_REST_URL)return send(404,{error:'Not found.'});
   const redis=deps.redis||redisClient(env),kind=type==='project'?'submission':'resource';
   const raw=await redis(['GET',storageKey(kind,id)]);const record=raw?JSON.parse(raw):null;
   const item=record?(type==='project'?projectPublic(record):contentPublic('resource',record)):null;
   if(!item)return send(404,{error:'Not found.'});
   return send(200,{item:{id,title:item.name||item.title,description:item.description,url:item.pageUrl||item.url}});
  }catch{return send(503,{error:'Could not load saved item. Please try again.'});}
 };
}
