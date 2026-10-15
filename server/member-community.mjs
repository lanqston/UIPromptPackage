import { randomUUID } from 'node:crypto';
import { adminConfig, requireSession, jsonBody, AdminError } from './admin-auth.mjs';
import { redisClient } from './submissions.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function memberConfig(env){
 let url;try{url=new URL(env.COMMUNITY_SUPABASE_URL);}catch{return null;}
 if(url.protocol!=='https:'||!url.hostname.endsWith('.supabase.co')||url.pathname!=='/'||!env.COMMUNITY_SUPABASE_PUBLISHABLE_KEY)return null;
 return {url:url.origin,key:env.COMMUNITY_SUPABASE_PUBLISHABLE_KEY,google:env.COMMUNITY_GOOGLE_ENABLED==='true'};
}
export function imageBytes(data){
 const m=typeof data==='string'&&data.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
 if(!m)throw new AdminError(400,'Choose a JPG, PNG, or WebP image.');
 const bytes=Buffer.from(m[2],'base64');
 const valid=m[1]==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):m[1]==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
 if(!valid||bytes.length<12||bytes.length>2097152)throw new AdminError(400,'Choose a valid image smaller than 2 MB.');
 return {bytes,type:`image/${m[1]}`,ext:m[1]};
}
export function makeMemberCommunityHandler(deps={}){return async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
 const send=(status,data)=>{res.statusCode=status;res.end(JSON.stringify(data));};
 try{
  const env=deps.env||process.env,cfg=memberConfig(env),fetcher=deps.fetch||fetch;
  const action=new URL(req.url,'https://digivated.invalid').searchParams.get('action')||'config';
  if(req.method==='GET'&&action==='config')return send(200,{ready:!!cfg,...(cfg||{})});
  if(!cfg||!env.COMMUNITY_SUPABASE_SECRET_KEY)throw new AdminError(503,'Community is getting ready. Please check back soon.');
  const serviceHeaders={apikey:env.COMMUNITY_SUPABASE_SECRET_KEY,'Content-Type':'application/json'};
  async function rest(path,options={}){const r=await fetcher(`${cfg.url}/rest/v1/${path}`,{...options,headers:{...serviceHeaders,...options.headers},signal:AbortSignal.timeout(8000)});if(!r.ok)throw new AdminError(503,'Community is temporarily unavailable.');const text=await r.text();return text?JSON.parse(text):null;}
  const redis=deps.redis||redisClient(env);
  if(action==='moderation'){
   const ac=adminConfig(env),session=await requireSession(req,redis,ac);
   if(req.method==='GET')return send(200,{csrf:session.csrf,reports:await rest('community_reports?resolved=eq.false&order=created_at.desc&limit=100&select=*,post:community_posts(id,body,author_id,hidden)')});
   if(req.method!=='POST')throw new AdminError(405,'Method not allowed.');
   if(req.headers.origin!==ac.origin)throw new AdminError(403,'Please use the owner dashboard.');
   const body=await jsonBody(req,4000);
   if(body.csrf!==session.csrf||!UUID.test(body.id||''))throw new AdminError(403,'Refresh and try again.');
   if(body.operation==='hide'||body.operation==='restore')await rest(`community_posts?id=eq.${body.id}`,{method:'PATCH',body:JSON.stringify({hidden:body.operation==='hide'})});
   else if(body.operation==='resolve')await rest(`community_reports?id=eq.${body.id}`,{method:'PATCH',body:JSON.stringify({resolved:true})});
   else if(body.operation==='suspend')await rest('community_suspensions',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify({user_id:body.id})});
   else if(body.operation==='unsuspend')await rest(`community_suspensions?user_id=eq.${body.id}`,{method:'DELETE'});
   else throw new AdminError(400,'Choose an available action.');
   return send(200,{ok:true});
  }
  if(action!=='upload'||req.method!=='POST')throw new AdminError(405,'Method not allowed.');
  if(req.headers.origin!==(env.COMMUNITY_ORIGIN||'https://digivated.vercel.app'))throw new AdminError(403,'Please upload from Digivated.');
  const token=req.headers.authorization;
  if(!/^Bearer [\w.-]+$/.test(token||''))throw new AdminError(401,'Sign in to add an image.');
  const auth=await fetcher(`${cfg.url}/auth/v1/user`,{headers:{apikey:cfg.key,Authorization:token},signal:AbortSignal.timeout(8000)});
  if(!auth.ok)throw new AdminError(401,'Sign in again to add an image.');
  const user=await auth.json();if(!UUID.test(user.id)||!user.email_confirmed_at||user.is_anonymous)throw new AdminError(403,'Verify your email first.');
  if((await rest(`community_suspensions?user_id=eq.${user.id}&select=user_id`)).length)throw new AdminError(403,'Uploads are unavailable for this account.');
  const n=await redis(['EVAL',"local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],3600) end;return n",1,`digivated:community:upload:${user.id}`]);
  if(n>20)throw new AdminError(429,'You have reached the image limit for this hour.');
  const body=await jsonBody(req,2900000),img=imageBytes(body.image),path=`${user.id}/${randomUUID()}.${img.ext}`;
  const r=await fetcher(`${cfg.url}/storage/v1/object/community-media/${path}`,{method:'POST',headers:{apikey:env.COMMUNITY_SUPABASE_SECRET_KEY,Authorization:`Bearer ${env.COMMUNITY_SUPABASE_SECRET_KEY}`,'Content-Type':img.type},body:img.bytes,signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw new AdminError(503,'Your image could not be uploaded. Try again.');
  return send(200,{path});
 }catch(e){return send(e.status||503,{error:e.status?e.message:'Community is temporarily unavailable. Please try again.'});}
};}
