import test from 'node:test';
import assert from 'node:assert/strict';
import { makeReturnEmailHandler, makeWeeklyDigestHandler } from '../server/return-emails.mjs';

const id='a5b2b29e-1aa2-4000-8000-63cfcc6be725',email='owner@example.com';
const env={SUBMISSIONS_REDIS_REST_TOKEN:'fixture-redis-secret',RESEND_API_KEY:'fixture-resend',ACCOUNT_EMAIL_FROM:'Digivated <hello@digivated.com>',COMMUNITY_SUPABASE_SECRET_KEY:'fixture',WEEKLY_EMAIL_POSTAL_ADDRESS:'123 Example St, Test City, NY 10001',CRON_SECRET:'fixture-cron-secret'};
function fixture(){
 const entries=new Map(),members=new Map(),sent=[];
 const redis=async ([command,...args])=>{
  if(command==='GET')return entries.get(args[0])||null;
  if(command==='SET'){entries.set(args[0],args[1]);return 'OK';}
  if(command==='DEL'){entries.delete(args[0]);return 1;}
  if(command==='INCR'){const n=Number(entries.get(args[0])||0)+1;entries.set(args[0],String(n));return n;}
  if(command==='EXPIRE')return 1;
  if(command==='ZADD'){members.set(args[2],Number(args[1]));return 1;}
  if(command==='ZREM'){members.delete(args[1]);return 1;}
  if(command==='ZRANGEBYSCORE')return [...members].filter(([,score])=>score<=Number(args[2])).map(([key])=>key).slice(Number(args[4]),Number(args[4])+Number(args[5]));
  if(command==='ZREVRANGE')return [...entries.keys()].filter(key=>key.startsWith('digivated:submission:')).map(key=>key.slice('digivated:submission:'.length));
  if(command==='MGET')return args.map(key=>entries.get(key)||null);
  throw Error(command);
 };
 const deps={env,redis,verifyAccount:async()=>({id,email}),adminClient:{auth:{admin:{getUserById:async()=>({data:{user:{email}}})}}},fetcher:async(_url,options)=>{sent.push(JSON.parse(options.body));return {ok:true};}};
 async function invoke(handler,method,url,body,headers={}){const req={method,url,headers:{origin:'https://digivated.com','content-type':'application/json',...headers},body};let raw;const res={setHeader(){},end(value){raw=value;}};await handler(req,res);return {status:res.statusCode,body:raw?.startsWith('{')?JSON.parse(raw):raw};}
 return {entries,members,sent,deps,invoke};
}

test('weekly email requires mailbox confirmation and allows immediate unsubscribe',async()=>{
 const f=fixture(),handler=makeReturnEmailHandler(f.deps);
 const initial=await f.invoke(handler,'GET','/api/return-emails?action=status');assert.equal(initial.body.subscribed,false);
 const requested=await f.invoke(handler,'POST','/api/return-emails?action=on',{});assert.equal(requested.body.pending,true);
 assert.equal(f.members.size,0);assert.equal(f.sent.length,1);
 const token=[...f.entries.keys()].find(key=>key.includes(':confirm:')).split(':').at(-1);
 const confirmed=await f.invoke(handler,'POST','/api/return-emails?action=confirm',{token});assert.equal(confirmed.status,200);
 assert.equal((await f.invoke(handler,'GET','/api/return-emails?action=status')).body.subscribed,true);
 const off=await f.invoke(handler,'POST','/api/return-emails?action=off',{});assert.equal(off.body.subscribed,false);assert.equal(f.members.size,0);
});

test('digest requires the cron secret and configured mailing address',async()=>{
 const f=fixture(),handler=makeWeeklyDigestHandler(f.deps);
 assert.equal((await f.invoke(handler,'GET','/api/weekly-digest')).status,401);
 const result=await f.invoke(handler,'GET','/api/weekly-digest',undefined,{authorization:`Bearer ${env.CRON_SECRET}`});assert.equal(result.status,200);assert.equal(result.body.sent,0);
 const noAddress=makeWeeklyDigestHandler({...f.deps,env:{...env,WEEKLY_EMAIL_POSTAL_ADDRESS:''}});
 assert.equal((await f.invoke(noAddress,'GET','/api/weekly-digest',undefined,{authorization:`Bearer ${env.CRON_SECRET}`})).status,503);
 const preference=makeReturnEmailHandler({...f.deps,env:{...env,WEEKLY_EMAIL_POSTAL_ADDRESS:''}});
 assert.equal((await f.invoke(preference,'GET','/api/return-emails?action=status')).body.available,false);
 assert.equal((await f.invoke(preference,'POST','/api/return-emails?action=on',{})).status,503);
 assert.equal(f.sent.length,0);
});

test('digest sends only recent published projects and stops at ten recipients',async()=>{
 const f=fixture(),handler=makeWeeklyDigestHandler(f.deps),now=Date.now();
 f.entries.set('digivated:submission:recent',JSON.stringify({status:'featured',name:'New tool',url:'https://example.com',reviewedAt:new Date(now).toISOString()}));
 f.entries.set('digivated:submission:private',JSON.stringify({status:'pending',name:'Private project',url:'https://private.example',reviewedAt:new Date(now).toISOString()}));
 for(let n=0;n<12;n++){const member=`member-${n}`;f.entries.set(`digivated:weekly:preference:${member}`,JSON.stringify({email}));f.members.set(member,0);}
 const result=await f.invoke(handler,'GET','/api/weekly-digest',undefined,{authorization:`Bearer ${env.CRON_SECRET}`});
 assert.equal(result.body.sent,10);assert.equal(f.sent.length,10);
 assert.match(f.sent[0].text,/New tool/);assert.doesNotMatch(f.sent[0].text,/Private project/);
 assert.match(f.sent[0].text,/Unsubscribe:/);assert.match(f.sent[0].text,/123 Example St/);
 assert.equal([...f.members.values()].filter(score=>score>0).length,10);
});
