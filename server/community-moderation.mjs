import { randomBytes, createHash } from 'node:crypto';
import { adminConfig, requireSession, jsonBody, AdminError } from './admin-auth.mjs';
const key = ticket => `digivated:community:grant:${createHash('sha256').update(ticket).digest('hex')}`;
const operations = new Set(['hide','restore','resolve','suspend','unsuspend']);
export async function moderationBridge(req, action, {env,cfg,fetcher,redis}) {
 if(action==='moderation-ticket') {
  if(req.method!=='POST') throw new AdminError(405,'Method not allowed.');
  const {ticket}=await jsonBody(req,200);
  if(!/^[a-f0-9]{64}$/.test(ticket||'')) throw new AdminError(401,'Invalid grant.');
  const grant=await redis(['GETDEL',key(ticket)]);
  if(!grant) throw new AdminError(401,'Invalid or expired grant.');
  return JSON.parse(grant);
 }
 const ac=adminConfig(env),session=await requireSession(req,redis,ac);
 let grant={operation:'list'};
 if(req.method!=='GET') {
  if(req.method!=='POST') throw new AdminError(405,'Method not allowed.');
  if(req.headers.origin!==ac.origin) throw new AdminError(403,'Please use the owner dashboard.');
  const body=await jsonBody(req,4000);
  if(body.csrf!==session.csrf) throw new AdminError(403,'Refresh and try again.');
  if(!operations.has(body.operation)||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.id||'')) throw new AdminError(400,'Choose an available action.');
  grant={operation:body.operation,id:body.id};
 }
 const ticket=randomBytes(32).toString('hex');
 await redis(['SET',key(ticket),JSON.stringify(grant),'EX',30,'NX']);
 try {
  const response=await fetcher(`${cfg.url}/functions/v1/community-moderation`,{method:'POST',headers:{'Content-Type':'application/json',apikey:cfg.key},body:JSON.stringify({ticket}),signal:AbortSignal.timeout(15000)});
  if(!response.ok) throw new AdminError(503,'Moderation is temporarily unavailable.');
  const result=await response.json();
  return req.method==='GET'?{csrf:session.csrf,reports:result.reports}: {ok:true};
 } finally { await redis(['DEL',key(ticket)]); }
}
