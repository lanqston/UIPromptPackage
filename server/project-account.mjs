import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { memberConfig } from './member-community.mjs';
import { redisClient } from './submissions.mjs';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export const accountIndex = (email, secret) => `digivated:account:submissions:${createHmac('sha256', secret).update(email.trim().toLowerCase()).digest('hex')}`;

// Older guest submissions predate the email index. Scan them once for each
// verified mailbox; never overwrite an existing accountId or grant edit rights.
async function indexLegacySubmissions(redis, account, key) {
  if(await redis(['GET',`${key}:legacy-scanned`])==='1')return;
  const entries=await redis(['ZREVRANGE','digivated:submissions',0,9999,'WITHSCORES']);
  if(!Array.isArray(entries)||entries.length===20000)throw new Error('Legacy submission index is too large for an account request.');
  for(let offset=0;offset<entries.length;offset+=40){
    const page=entries.slice(offset,offset+40);
    const ids=page.filter((_,index)=>index%2===0);
    const records=await redis(['MGET',...ids.map(id=>`digivated:submission:${id}`)]);
    if(!Array.isArray(records))throw new Error('Could not load legacy submissions.');
    const matches=[];
    for(let i=0;i<ids.length;i++){
      let row;try{row=JSON.parse(records[i]);}catch{continue;}
      if(row?.email?.trim().toLowerCase()===account.email&&(!row.accountId||row.accountId===account.id))matches.push(page[i*2+1],ids[i]);
    }
    if(matches.length)await redis(['ZADD',key,...matches]);
  }
  await redis(['SET',`${key}:legacy-scanned`,'1']);
}

export async function verifiedAccount(req, env, fetcher = fetch) {
  const cfg = memberConfig(env);
  if (!cfg) return null;
  const token = req.headers.authorization;
  if (typeof token !== 'string' || !/^Bearer [\w.-]{20,8192}$/.test(token)) return null;
  // Password accounts can submit their own work immediately. An emailed link
  // is still required before claiming older guest submissions by address.
  let claims;
  try { claims=JSON.parse(Buffer.from(token.slice(7).split('.')[1],'base64url').toString('utf8')); }
  catch { return null; }
  if(!Array.isArray(claims.amr)||!claims.amr.some(entry=>['magiclink','otp','password'].includes(entry?.method)))return null;
  const response = await fetcher(`${cfg.url}/auth/v1/user`, {headers:{apikey:cfg.key,Authorization:token},redirect:'error',signal:AbortSignal.timeout(8000)});
  if (!response.ok) return null;
  const user = await response.json();
  if (!UUID.test(user.id) || claims.sub!==user.id || !user.email_confirmed_at || user.is_anonymous || typeof user.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email) || claims.email?.toLowerCase()!==user.email.toLowerCase()) return null;
  const mailboxVerified=claims.amr.some(entry=>['magiclink','otp'].includes(entry?.method));
  return {id:user.id,email:user.email.trim().toLowerCase(),...(mailboxVerified?{}:{mailboxVerified:false})};
}

export function makeProjectAccountHandler(deps={}) {
  return async (req,res) => {
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.setHeader('Cache-Control','private, no-store');
    res.setHeader('Vercel-CDN-Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Vary','Authorization');
    const send=(status,body)=>{res.statusCode=status;res.end(JSON.stringify(body));};
    try {
      const env=deps.env||process.env;
      const url=new URL(req.url,'https://digivated.invalid');
      if(url.pathname!=='/api/project-account')return send(404,{error:'Not found.'});
      const cfg=memberConfig(env);
      if(req.method==='POST'&&url.searchParams.get('action')==='signup'){
        if(!cfg||!env.COMMUNITY_SUPABASE_SECRET_KEY||!env.SUBMISSIONS_REDIS_REST_TOKEN)return send(503,{error:'Accounts are temporarily unavailable.'});
        if(req.headers.origin!=='https://digivated.com'||req.headers['sec-fetch-site']==='cross-site'||!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return send(403,{error:'Open the signup page on Digivated.'});
        const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
        const email=String(body?.email||'').trim().toLowerCase(),password=body?.password;
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||typeof password!=='string'||password.length<10||password.length>128)return send(400,{error:'Enter a valid email and a password of 10–128 characters.'});
        const ip=req.headers['x-real-ip'];if(!ip||env.VERCEL!=='1'&&!deps.redis)return send(503,{error:'Signup is temporarily unavailable.'});
        const redis=deps.redis||redisClient(env),key=`digivated:signup:limit:${createHmac('sha256',env.SUBMISSIONS_REDIS_REST_TOKEN).update(ip).digest('hex')}`;
        const attempts=Number(await redis(['INCR',key]));if(attempts===1)await redis(['EXPIRE',key,3600]);if(!Number.isFinite(attempts)||attempts>5)return send(429,{error:'Too many signup attempts. Try again later.'});
        const client=deps.adminClient||createClient(cfg.url,env.COMMUNITY_SUPABASE_SECRET_KEY,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
        const {data,error}=await client.auth.admin.createUser({email,password,email_confirm:true});
        if(error)return send(error.status===422||error.status===400?409:503,{error:error.status===422||error.status===400?'This email already has an account. Sign in or reset its password.':'Account could not be created. Try again.'});
        return send(201,{ok:!!data?.user?.id});
      }
      if(req.method!=='GET'){res.setHeader('Allow','GET, POST');return send(405,{error:'Method not allowed.'});}
      if(url.searchParams.get('action')==='config')return send(200,{ready:!!cfg,...(cfg?{url:cfg.url,key:cfg.key}:{})});
      const accountStatus=url.searchParams.get('action')==='me';
      if([...url.searchParams.keys()].some(key=>key!=='route'&&!(accountStatus&&key==='action')))return send(400,{error:'Invalid request.'});
      if(!cfg)return send(503,{error:'Accounts are temporarily unavailable.'});
      const account=await (deps.verifyAccount||verifiedAccount)(req,env,deps.fetcher||fetch);
      if(!account)return send(401,{error:'Sign in to see your submissions.'});
      if(accountStatus)return send(200,{email:account.email});
      if(!env.SUBMISSIONS_REDIS_REST_TOKEN)return send(503,{error:'Your submissions could not be loaded. Try again shortly.'});
      const redis=deps.redis||redisClient(env);
      const key=accountIndex(account.email,env.SUBMISSIONS_REDIS_REST_TOKEN);
      if(account.mailboxVerified!==false)await indexLegacySubmissions(redis,account,key);
      const ids=await redis(['ZREVRANGE',key,0,99]);
      const rows=ids.length?await redis(['MGET',...ids.map(id=>`digivated:submission:${id}`)]):[];
      const submissions=rows.filter(Boolean).map(raw=>JSON.parse(raw)).filter(row=>row.email?.trim().toLowerCase()===account.email&&(row.accountId===account.id||account.mailboxVerified!==false&&!row.accountId)).map(row=>({id:row.id,name:row.name,url:row.url,date:row.date,status:row.status,feedback:row.reviewFeedback||'',reviewedAt:row.reviewedAt||null}));
      return send(200,{email:account.email,submissions});
    } catch {return send(503,{error:'Your submissions could not be loaded. Try again shortly.'});}
  };
}
