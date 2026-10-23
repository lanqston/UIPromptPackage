import { createHmac } from 'node:crypto';
import { memberConfig } from './member-community.mjs';
import { redisClient } from './submissions.mjs';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export const accountIndex = (email, secret) => `digivated:account:submissions:${createHmac('sha256', secret).update(email.trim().toLowerCase()).digest('hex')}`;

export async function verifiedAccount(req, env, fetcher = fetch) {
  const cfg = memberConfig(env);
  if (!cfg) return null;
  const token = req.headers.authorization;
  if (typeof token !== 'string' || !/^Bearer [\w.-]{20,8192}$/.test(token)) return null;
  // This Auth project currently auto-confirms email addresses. A password signup
  // can therefore have email_confirmed_at without proving mailbox ownership.
  // Require a session established through an emailed link or code as well.
  let claims;
  try { claims=JSON.parse(Buffer.from(token.slice(7).split('.')[1],'base64url').toString('utf8')); }
  catch { return null; }
  if(!Array.isArray(claims.amr)||!claims.amr.some(entry=>['magiclink','otp'].includes(entry?.method)))return null;
  const response = await fetcher(`${cfg.url}/auth/v1/user`, {headers:{apikey:cfg.key,Authorization:token},redirect:'error',signal:AbortSignal.timeout(8000)});
  if (!response.ok) return null;
  const user = await response.json();
  if (!UUID.test(user.id) || claims.sub!==user.id || !user.email_confirmed_at || user.is_anonymous || typeof user.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email) || claims.email?.toLowerCase()!==user.email.toLowerCase()) return null;
  return {id:user.id,email:user.email.trim().toLowerCase()};
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
      if(req.method!=='GET'){res.setHeader('Allow','GET');return send(405,{error:'Method not allowed.'});}
      const env=deps.env||process.env;
      const url=new URL(req.url,'https://digivated.invalid');
      if(url.pathname!=='/api/project-account')return send(404,{error:'Not found.'});
      const cfg=memberConfig(env);
      if(url.searchParams.get('action')==='config')return send(200,{ready:!!cfg,...(cfg?{url:cfg.url,key:cfg.key}:{})});
      const accountStatus=url.searchParams.get('action')==='me';
      if([...url.searchParams.keys()].some(key=>key!=='route'&&!(accountStatus&&key==='action')))return send(400,{error:'Invalid request.'});
      if(!cfg)return send(503,{error:'Accounts are temporarily unavailable.'});
      const account=await (deps.verifyAccount||verifiedAccount)(req,env,deps.fetcher||fetch);
      if(!account)return send(401,{error:'Use an emailed sign-in link to see your submissions.'});
      if(accountStatus)return send(200,{email:account.email});
      if(!env.SUBMISSIONS_REDIS_REST_TOKEN)return send(503,{error:'Your submissions could not be loaded. Try again shortly.'});
      const redis=deps.redis||redisClient(env);
      const ids=await redis(['ZREVRANGE',accountIndex(account.email,env.SUBMISSIONS_REDIS_REST_TOKEN),0,99]);
      const rows=ids.length?await redis(['MGET',...ids.map(id=>`digivated:submission:${id}`)]):[];
      const submissions=rows.filter(Boolean).map(raw=>JSON.parse(raw)).filter(row=>row.email?.trim().toLowerCase()===account.email).map(row=>({id:row.id,name:row.name,url:row.url,date:row.date,status:row.status,feedback:row.reviewFeedback||'',reviewedAt:row.reviewedAt||null}));
      return send(200,{email:account.email,submissions});
    } catch {return send(503,{error:'Your submissions could not be loaded. Try again shortly.'});}
  };
}
