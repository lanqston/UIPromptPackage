import { randomBytes, createHash } from 'node:crypto';
import { unseal, seal } from './x-connect.mjs';
import { cronAuthorized, validCandidate } from './x-research.mjs';
import { AdminError, adminConfig, requireSession, jsonBody } from './admin-auth.mjs';
import { redisClient } from './submissions.mjs';

const P = 'digivated:private:x-publish:';
const CONNECTION = 'digivated:private:x:connection';
const RELEASE = `if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end; return 0`;
const CAS = `if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end; redis.call('SET',KEYS[1],ARGV[2]); return 1`;
export const RESERVE = `if redis.call('GET',KEYS[1])=='1' then return 'paused' end
redis.call('ZREMRANGEBYSCORE',KEYS[2],'-inf',ARGV[1]-3600000)
if redis.call('ZCARD',KEYS[2])>=7 then return 'hourly_limit' end
if redis.call('EXISTS',KEYS[3])==1 or redis.call('EXISTS',KEYS[4])==1 or redis.call('EXISTS',KEYS[5])==1 then return 'duplicate' end
redis.call('SET',KEYS[3],'attempted','EX',7776000); redis.call('SET',KEYS[4],'attempted','EX',7776000); redis.call('SET',KEYS[5],'attempted','EX',2592000)
redis.call('ZADD',KEYS[2],ARGV[1],ARGV[2]); redis.call('EXPIRE',KEYS[2],7200); return 'reserved'`;
const hash = s => createHash('sha256').update(s).digest('hex');
const invitation = /\b(?:let[’']?s connect|looking (?:for (?:connections|mutuals)|to connect)|connect with (?:me|us)|who wants to connect)\b/i;
class XError extends Error { constructor(status) { super(`X API HTTP ${status}`); this.status = status; } }
async function request(fetcher, path, token, options = {}) {
  const res = await fetcher(`https://api.x.com${path}`, { ...options, redirect: 'error', signal: AbortSignal.timeout(12000), headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
  if (!res.ok) throw new XError(res.status);
  return res.json();
}

export async function credentials(env, redis, fetcher = fetch, clock = Date.now) {
  const raw = await redis(['GET', CONNECTION]);
  if (!raw) throw new Error('X connection missing');
  let record = unseal(raw, env.X_TOKEN_ENCRYPTION_KEY);
  if (record.username?.toLowerCase() !== 'digivatedx' || !/^\d+$/.test(record.userId || '')) throw new Error('Wrong connected account');
  if (!Number.isFinite(record.expiresAt)) throw new Error('Invalid token expiry');
  if (record.expiresAt <= clock() + 60000) {
    if (!record.refreshToken || !env.X_CLIENT_ID || !env.X_CLIENT_SECRET) throw new Error('Reconnect X');
    const basic = Buffer.from(`${encodeURIComponent(env.X_CLIENT_ID)}:${encodeURIComponent(env.X_CLIENT_SECRET)}`).toString('base64');
    const res = await fetcher('https://api.x.com/2/oauth2/token', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(12000),
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: record.refreshToken }).toString() });
    if (!res.ok) throw new XError(res.status);
    const next = await res.json();
    if (typeof next.access_token !== 'string' || !next.access_token || typeof next.refresh_token !== 'string' || !next.refresh_token || !Number.isFinite(next.expires_in) || next.expires_in <= 0) throw new Error('Invalid refresh response');
    const scope = next.scope || record.scope;
    if (!['tweet.read','tweet.write','users.read'].every(v => String(scope).split(' ').includes(v))) throw new Error('Missing X permissions');
    record = { ...record, accessToken: next.access_token, refreshToken: next.refresh_token, scope, expiresAt: clock() + next.expires_in * 1000 };
    if (await redis(['EVAL', CAS, 1, CONNECTION, raw, seal(record, env.X_TOKEN_ENCRYPTION_KEY)]) !== 1) throw new Error('Connection changed; retry next scheduled run');
  }
  const me = await request(fetcher, '/2/users/me', record.accessToken);
  if (me.data?.id !== record.userId || me.data?.username?.toLowerCase() !== 'digivatedx') throw new Error('Wrong connected account');
  return record;
}

export async function publishOne(env, redis, fetcher = fetch, clock = Date.now) {
  if (env.X_AUTO_REPLY_ENABLED !== 'true') return { status: 'disabled', sent: 0 };
  if (await redis(['GET', P+'paused']) === '1' || await redis(['GET','digivated:private:x-research:paused']) === '1') return { status: 'paused', sent: 0 };
  const lease = randomBytes(32).toString('hex');
  if (await redis(['SET',P+'lock',lease,'NX','EX',150]) !== 'OK') return { status: 'busy', sent: 0 };
  let report = { status: 'no_eligible_posts', sent: 0, time: new Date(clock()).toISOString() };
  try {
    const rows = (await redis(['LRANGE','digivated:private:x-research:queue',0,49])).map(JSON.parse);
    const eligible = [];
    for (const c of rows) {
      if (!validCandidate(c,clock()) || !invitation.test(c.invitation_excerpt) || c.status !== 'draft_only' || !Number.isFinite(Date.parse(c.researchedAt)) || clock()-Date.parse(c.researchedAt) > 2*3600000 || Date.parse(c.researchedAt)>clock() || typeof c.reply !== 'string' || !c.reply.trim() || c.reply.length>240 || /https?:\/\/|@[a-zA-Z0-9_]/.test(c.reply)) continue;
      const id = c.url.split('/').pop();
      if (await redis(['GET',P+'post:'+id]) || await redis(['GET',P+'author:'+c.author.replace(/^@/,'').toLowerCase()]) || await redis(['GET',P+'text:'+hash(c.reply.trim().toLowerCase())])) continue;
      eligible.push(c);
    }
    if (!eligible.length) return report;
    const auth = await credentials(env,redis,fetcher,clock);
    // At most three preflight lookups and one send per invocation.
    for (const c of eligible.slice(0,3)) {
      const id=c.url.split('/').pop();
      let source;
      try { source=await request(fetcher,`/2/tweets/${id}?tweet.fields=author_id,created_at,possibly_sensitive&expansions=author_id&user.fields=username`,auth.accessToken); }
      catch (error) { if (error.status===404) continue; throw error; }
      const author=source.includes?.users?.find(u=>u.id===source.data?.author_id);
      if (!source.data || !author || author.username?.toLowerCase()!==c.author.replace(/^@/,'').toLowerCase() || source.data.text!==c.text || source.data.possibly_sensitive===true || !invitation.test(source.data.text)) continue;
      if (!Number.isFinite(Date.parse(source.data.created_at)) || clock()-Date.parse(source.data.created_at)>7*86400000) continue;
      if (await redis(['GET','digivated:private:x-research:paused']) === '1') return {status:'paused',sent:0};
      const reservation=await redis(['EVAL',RESERVE,5,P+'paused',P+'rolling',P+'post:'+id,P+'author:'+author.username.toLowerCase(),P+'text:'+hash(c.reply.trim().toLowerCase()),clock(),id]);
      if (reservation!=='reserved') { report.status=reservation; if(reservation==='duplicate')continue;return report; }
      // Persist uncertainty before the write. Never retry a potentially successful send.
      report={...report,status:'sending',sourceUrl:c.url};
      await redis(['SET',P+'latest',JSON.stringify(report)]);
      const result=await request(fetcher,'/2/tweets',auth.accessToken,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:c.reply,reply:{in_reply_to_tweet_id:id}})});
      if (!/^\d+$/.test(result.data?.id || '')) throw new Error('Uncertain posting result');
      report={...report,status:'sent',sent:1,replyUrl:`https://x.com/digivatedx/status/${result.data.id}`};
      await redis(['SET',P+'post:'+id,JSON.stringify(report),'EX',7776000]);
      await redis(['LPUSH',P+'history',JSON.stringify(report)]);await redis(['LTRIM',P+'history',0,199]);
      return report;
    }
    return report;
  } catch (error) {
    // Any restriction or uncertain network/storage outcome pauses future writes.
    report={...report,status:'halted',error:error instanceof XError?error.message:'Connection or send failed. Inspect X before resuming.'};
    await redis(['SET',P+'paused','1']);
    return report;
  } finally {
    await redis(['SET',P+'latest',JSON.stringify(report)]);
    await redis(['EVAL',RELEASE,1,P+'lock',lease]);
  }
}

export function makePublisherHandler(deps={}) {
  return async(req,res)=>{
    res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','private, no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');
    const send=(status,data)=>{res.statusCode=status;res.end(JSON.stringify(data));};
    try {
      const env=deps.env||process.env,redis=deps.redis||redisClient(env);
      if(req.method==='GET' && cronAuthorized(req.headers.authorization,env.CRON_SECRET)) {
        const report=await publishOne(env,redis,deps.fetch||fetch);
        console.info(JSON.stringify({event:'x_publish',...report}));return send(200,report);
      }
      const cfg=adminConfig(env);
      if(req.headers['sec-fetch-site']==='cross-site'||(req.method==='POST'&&req.headers.origin!==cfg.origin))throw new AdminError(403,'Open the owner page.');
      const session=await requireSession(req,redis,cfg);
      if(req.method==='GET') {
        const latest=await redis(['GET',P+'latest']);
        return send(200,{enabled:env.X_AUTO_REPLY_ENABLED==='true',paused:await redis(['GET',P+'paused'])==='1',latest:latest?JSON.parse(latest):null,history:(await redis(['LRANGE',P+'history',0,199])).map(JSON.parse)});
      }
      if(req.method!=='POST')throw new AdminError(405,'Unsupported method.');
      if(req.headers['x-admin-csrf']!==session.csrf)throw new AdminError(403,'Refresh the page.');
      const body=await jsonBody(req,1024);
      if(!['pause','resume'].includes(body.action))throw new AdminError(400,'Invalid action.');
      await redis(['SET',P+'paused',body.action==='pause'?'1':'0']);return send(200,{ok:true});
    } catch(error){return send(error instanceof AdminError?error.status:503,{error:error instanceof AdminError?error.message:'Publisher unavailable.'});}
  };
}
