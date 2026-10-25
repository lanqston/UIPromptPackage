import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { verifiedAccount } from './project-account.mjs';
import { redisClient } from './submissions.mjs';

const MEMBERS='digivated:weekly:members';
const preference=id=>`digivated:weekly:preference:${id}`;
const tokenKey=token=>`digivated:weekly:confirm:${token}`;
const sign=(id,secret)=>createHmac('sha256',secret).update(`weekly-unsubscribe:${id}`).digest('hex');
const valid=(a,b)=>typeof a==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const json=(res,status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');res.end(JSON.stringify(data));};
const admin=env=>createClient(env.COMMUNITY_SUPABASE_URL,env.COMMUNITY_SUPABASE_SECRET_KEY,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});

async function bodyOf(req){let body=req.body;if(body===undefined){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>2048)throw Error('Invalid request');chunks.push(chunk);}body=Buffer.concat(chunks).toString('utf8');}if(Buffer.isBuffer(body))body=body.toString('utf8');if(typeof body==='string')body=JSON.parse(body);if(!body||typeof body!=='object'||Array.isArray(body)||JSON.stringify(body).length>2048)throw Error('Invalid request');return body;}

export function makeReturnEmailHandler(deps={}){return async(req,res)=>{
 const env=deps.env||process.env;
 try{
  if(!env.SUBMISSIONS_REDIS_REST_TOKEN||!env.RESEND_API_KEY||!env.ACCOUNT_EMAIL_FROM)return json(res,503,{error:'Email preferences are temporarily unavailable.'});
  const redis=deps.redis||redisClient(env),url=new URL(req.url,'https://digivated.com'),action=url.searchParams.get('action');
  if(req.method==='GET'&&action==='unsubscribe'){
   const id=url.searchParams.get('id'),signature=url.searchParams.get('signature');
   if(!id||!valid(signature,sign(id,env.SUBMISSIONS_REDIS_REST_TOKEN)))return json(res,400,{error:'Invalid unsubscribe link.'});
   // GET only displays a confirmation page. Email scanners cannot unsubscribe someone.
   res.statusCode=200;res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');return res.end('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Digivated emails</title><main style="font:18px system-ui;max-width:560px;margin:12vh auto;padding:24px"><h1>Digivated weekly emails</h1><p>Stop receiving the weekly project email?</p><form method="post"><button style="padding:12px 18px">Unsubscribe</button></form><p><a href="https://digivated.com">Back to Digivated</a></p></main></html>');
  }
  if(req.method==='POST'&&action==='unsubscribe'){
   const id=url.searchParams.get('id'),signature=url.searchParams.get('signature');
   if(!id||!valid(signature,sign(id,env.SUBMISSIONS_REDIS_REST_TOKEN)))return json(res,400,{error:'Invalid unsubscribe link.'});
   await redis(['DEL',preference(id)]);await redis(['ZREM',MEMBERS,id]);
   res.statusCode=200;res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');return res.end('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribed</title><main style="font:18px system-ui;max-width:560px;margin:12vh auto;padding:24px"><h1>You are unsubscribed.</h1><p>You will not receive the weekly project email.</p><a href="https://digivated.com">Back to Digivated</a></main></html>');
  }
  if(req.method==='POST'&&action==='confirm'){
   if(req.headers.origin!=='https://digivated.com'||!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return json(res,403,{error:'Open Digivated to confirm.'});
   const {token}=await bodyOf(req);if(typeof token!=='string'||!/^[a-f0-9]{48}$/.test(token))return json(res,400,{error:'Invalid link.'});
   const raw=await redis(['GET',tokenKey(token)]);if(!raw)return json(res,410,{error:'This link has expired. Sign in to request another.'});
   const {id,email}=JSON.parse(raw),{data,error}=await (deps.adminClient||admin(env)).auth.admin.getUserById(id);
   if(error||data?.user?.email?.toLowerCase()!==email)return json(res,410,{error:'This link is no longer valid.'});
   await redis(['SET',preference(id),JSON.stringify({email,consentedAt:new Date().toISOString(),source:'account weekly email confirmation'})]);await redis(['ZADD',MEMBERS,0,id]);await redis(['DEL',tokenKey(token)]);
   return json(res,200,{ok:true});
  }
  if(!['GET','POST'].includes(req.method))return json(res,405,{error:'Method not allowed.'});
  if(req.method==='POST'&&(req.headers.origin!=='https://digivated.com'||!/^application\/json(?:;|$)/i.test(req.headers['content-type']||'')))return json(res,403,{error:'Open Digivated to change preferences.'});
  const account=await (deps.verifyAccount||verifiedAccount)(req,env,deps.fetcher||fetch);if(!account)return json(res,401,{error:'Sign in to manage email preferences.'});
  if(req.method==='GET'&&action==='status'){const stored=await redis(['GET',preference(account.id)]);return json(res,200,{subscribed:stored?JSON.parse(stored).email===account.email:false,available:!!env.WEEKLY_EMAIL_POSTAL_ADDRESS});}
  if(req.method==='POST'&&action==='off'){
   await redis(['DEL',preference(account.id)]);await redis(['ZREM',MEMBERS,account.id]);return json(res,200,{subscribed:false});
  }
  if(req.method==='POST'&&action==='on'){
   if(!env.WEEKLY_EMAIL_POSTAL_ADDRESS)return json(res,503,{error:'Weekly emails are being set up. Please check back soon.'});
   const previous=await redis(['GET',preference(account.id)]);if(previous&&JSON.parse(previous).email===account.email)return json(res,200,{subscribed:true});
   const limit=`digivated:weekly:request:${account.id}`;
   if(Number(await redis(['INCR',limit]))>3)return json(res,429,{error:'Please try again tomorrow.'});
   await redis(['EXPIRE',limit,86400]);
   const daily=`digivated:weekly:confirmation-day:${new Date().toISOString().slice(0,10)}`;
   const count=Number(await redis(['INCR',daily]));if(count===1)await redis(['EXPIRE',daily,172800]);
   if(count>20)return json(res,429,{error:'Email confirmations are busy today. Please try again tomorrow.'});
   const token=randomBytes(24).toString('hex');await redis(['SET',tokenKey(token),JSON.stringify({id:account.id,email:account.email}),'EX',86400]);
   const link=`https://digivated.com/email-preferences?token=${token}`;
   const response=await (deps.fetcher||fetch)('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:env.ACCOUNT_EMAIL_FROM,to:[account.email],subject:'Confirm your Digivated weekly email',text:`Confirm that you want a weekly email about new featured projects. Open this link and press Confirm: ${link}\n\nIf you did not request this, ignore this email.\n\nDigivated`}),signal:AbortSignal.timeout(8000),redirect:'error'});
   if(!response.ok)return json(res,503,{error:'Could not send confirmation. Try again later.'});
   return json(res,200,{subscribed:false,pending:true});
  }
  return json(res,404,{error:'Not found.'});
 }catch{return json(res,503,{error:'Email preferences are temporarily unavailable.'});}
};}

export function makeWeeklyDigestHandler(deps={}){return async(req,res)=>{
 const env=deps.env||process.env;
 if(req.method!=='GET'||!env.CRON_SECRET||!valid(req.headers.authorization,`Bearer ${env.CRON_SECRET}`))return json(res,401,{error:'Unauthorized.'});
 if(!env.WEEKLY_EMAIL_POSTAL_ADDRESS||!env.RESEND_API_KEY||!env.ACCOUNT_EMAIL_FROM||!env.COMMUNITY_SUPABASE_SECRET_KEY)return json(res,503,{error:'Weekly emails are not configured.'});
 try{
  const redis=deps.redis||redisClient(env),now=Date.now(),week=7*86400000;
  const ids=await redis(['ZREVRANGE','digivated:submissions',0,199]);
  const rows=ids.length?await redis(['MGET',...ids.map(id=>`digivated:submission:${id}`)]):[];
  const projects=rows.filter(Boolean).map(raw=>{try{return JSON.parse(raw);}catch{return null;}}).filter(p=>p&&['approved','featured'].includes(p.status)&&Date.parse(p.reviewedAt)>now-week).sort((a,b)=>Date.parse(b.reviewedAt)-Date.parse(a.reviewedAt)).slice(0,3);
  if(!projects.length)return json(res,200,{sent:0,reason:'no new projects'});
  // A small fixed weekly cap leaves room for sign-in and project update mail on the free plan.
  const members=await redis(['ZRANGEBYSCORE',MEMBERS,0,now-week,'LIMIT',0,10]);let sent=0;
  for(const id of members){
   const stored=await redis(['GET',preference(id)]);if(!stored){await redis(['ZREM',MEMBERS,id]);continue;}const email=JSON.parse(stored).email;
   const {data,error}=await (deps.adminClient||admin(env)).auth.admin.getUserById(id);
   if(error||data?.user?.email?.toLowerCase()!==email){await redis(['DEL',preference(id)]);await redis(['ZREM',MEMBERS,id]);continue;}
   const unsubscribe=`https://digivated.com/api/return-emails?action=unsubscribe&id=${encodeURIComponent(id)}&signature=${sign(id,env.SUBMISSIONS_REDIS_REST_TOKEN)}`;
   const text=`New on Digivated this week:\n\n${projects.map(p=>`${p.name} — ${p.url}`).join('\n\n')}\n\nBrowse more: https://digivated.com/discover?view=featured\n\nUnsubscribe: ${unsubscribe}\n\nDigivated\n${env.WEEKLY_EMAIL_POSTAL_ADDRESS}`;
   const response=await (deps.fetcher||fetch)('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`weekly-${id}-${new Date(now).toISOString().slice(0,10)}`},body:JSON.stringify({from:env.WEEKLY_EMAIL_FROM||env.ACCOUNT_EMAIL_FROM,to:[email],subject:'New projects on Digivated',text,headers:{'List-Unsubscribe':`<${unsubscribe}>`}}),signal:AbortSignal.timeout(8000),redirect:'error'});
   if(response.ok){await redis(['ZADD',MEMBERS,now,id]);sent++;}
  }
  return json(res,200,{sent});
 }catch{return json(res,503,{error:'Weekly email run failed.'});}
};}
