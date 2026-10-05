import test from 'node:test';
import assert from 'node:assert/strict';
import { publishOne, credentials, RESERVE } from '../server/x-publisher.mjs';
import { seal, unseal } from '../server/x-connect.mjs';

const now=Date.parse('2026-10-05T12:00:00Z'), clock=()=>now;
const env={X_AUTO_REPLY_ENABLED:'true',X_TOKEN_ENCRYPTION_KEY:'a'.repeat(64),X_CLIENT_ID:'client',X_CLIENT_SECRET:'secret'};
const c={url:'https://x.com/builder/status/123',author:'builder',text:'Frontend builders, let’s connect!',invitation_excerpt:'let’s connect!',niche:'Frontend Development',created_at:'2026-10-05T11:00:00Z',researchedAt:'2026-10-05T11:30:00Z',reply:'Building frontend tools? Let’s connect 🤝',status:'draft_only'};
const record={userId:'42',username:'digivatedx',accessToken:'private-access',refreshToken:'private-refresh',scope:'tweet.read tweet.write users.read offline.access',expiresAt:now+7200000};
function fixture(options={}) {
  const data=new Map([['digivated:private:x:connection',seal(record,env.X_TOKEN_ENCRYPTION_KEY)]]),rolling=[],history=[],calls=[];
  const redis=async([cmd,key,value,...rest])=>{
    if(cmd==='GET')return data.get(key)??null;
    if(cmd==='SET'){if(rest.includes('NX')&&data.has(key))return null;data.set(key,value);return 'OK';}
    if(cmd==='LRANGE')return key.endsWith(':queue')?[JSON.stringify({...c,...options.candidate})]:history;
    if(cmd==='LPUSH'){history.unshift(value);return history.length;}
    if(cmd==='LTRIM')return 'OK';
    if(cmd==='EVAL'){
      if(key===RESERVE){
        const [paused,count,post,author,text,time,id]=rest;
        if(data.get(paused)==='1')return 'paused';
        while(rolling.length&&rolling[0]<=time-3600000)rolling.shift();
        if(rolling.length>=7)return 'hourly_limit';
        if(data.has(post)||data.has(author)||data.has(text))return 'duplicate';
        data.set(post,'attempted');data.set(author,'attempted');data.set(text,'attempted');rolling.push(time);return 'reserved';
      }
      if(key.includes("redis.call('SET',KEYS[1],ARGV[2])")){
        const [k,old,next]=rest;if(data.get(k)!==old)return 0;data.set(k,next);return 1;
      }
      const [k,lease]=rest;if(data.get(k)!==lease)return 0;data.delete(k);return 1;
    }
    throw Error('Unsupported Redis operation');
  };
  const fetcher=async(url,opts={})=>{
    calls.push({url,opts});
    if(options.fail && (opts.method==='POST'&&url.endsWith('/tweets')))throw Error('unknown network outcome');
    if(options.restriction && url.includes('/2/tweets/'))return {ok:false,status:429};
    const json=url.endsWith('/oauth2/token')?{access_token:'refreshed-access',refresh_token:'rotated-refresh',expires_in:7200,scope:record.scope}
      :url.endsWith('/users/me')?{data:{id:'42',username:options.wrongOwner?'other':'digivatedx'}}
      :opts.method==='POST'?{data:{id:'999'}}
      :{data:{id:'123',author_id:'100',text:options.changed?'changed post':c.text,created_at:c.created_at,possibly_sensitive:false},includes:{users:[{id:'100',username:options.wrongAuthor?'other':'builder'}]}};
    return {ok:true,json:async()=>json};
  };
  return {data,redis,rolling,history,calls,fetcher};
}
test('disabled and paused workers never call X',async()=>{
  const f=fixture();assert.equal((await publishOne({...env,X_AUTO_REPLY_ENABLED:'false'},f.redis,f.fetcher,clock)).status,'disabled');
  f.data.set('digivated:private:x-publish:paused','1');assert.equal((await publishOne(env,f.redis,f.fetcher,clock)).status,'paused');assert.equal(f.calls.length,0);
});
test('valid invitation sends one reply and excludes repeated contact',async()=>{
  const f=fixture();const r=await publishOne(env,f.redis,f.fetcher,clock);assert.equal(r.status,'sent');assert.equal(r.replyUrl,'https://x.com/digivatedx/status/999');
  const writes=f.calls.filter(c=>c.url.endsWith('/tweets')&&c.opts.method==='POST');assert.equal(writes.length,1);
  assert.deepEqual(JSON.parse(writes[0].opts.body),{text:c.reply,reply:{in_reply_to_tweet_id:'123'}});
  await publishOne(env,f.redis,f.fetcher,clock);assert.equal(f.calls.filter(c=>c.opts.method==='POST').length,1);
});
test('changed posts and wrong authors are skipped',async()=>{
  for(const opts of [{changed:true},{wrongAuthor:true}]){const f=fixture(opts);await publishOne(env,f.redis,f.fetcher,clock);assert.equal(f.calls.filter(c=>c.opts.method==='POST').length,0);}
});
test('rolling limit blocks an eighth attempt',async()=>{
  const f=fixture();f.rolling.push(...Array(7).fill(now-1000));assert.equal((await publishOne(env,f.redis,f.fetcher,clock)).status,'hourly_limit');assert.equal(f.calls.filter(c=>c.opts.method==='POST').length,0);
});
test('concurrent invocations send at most once',async()=>{
  const f=fixture();await Promise.all([publishOne(env,f.redis,f.fetcher,clock),publishOne(env,f.redis,f.fetcher,clock)]);assert.equal(f.calls.filter(c=>c.opts.method==='POST').length,1);
});
test('uncertain sends halt without retry and preserve the attempted marker',async()=>{
  const f=fixture({fail:true});assert.equal((await publishOne(env,f.redis,f.fetcher,clock)).status,'halted');
  assert.equal(f.data.get('digivated:private:x-publish:post:123'),'attempted');await publishOne(env,f.redis,f.fetcher,clock);assert.equal(f.calls.filter(c=>c.opts.method==='POST').length,1);
});
test('X restrictions and wrong connected accounts pause publishing',async()=>{
  for(const opts of [{restriction:true},{wrongOwner:true}]){const f=fixture(opts);assert.equal((await publishOne(env,f.redis,f.fetcher,clock)).status,'halted');assert.equal(f.data.get('digivated:private:x-publish:paused'),'1');assert.equal(f.calls.filter(c=>c.opts.method==='POST').length,0);}
});
test('expired credentials refresh and rotated tokens remain encrypted',async()=>{
  const f=fixture();f.data.set('digivated:private:x:connection',seal({...record,expiresAt:now-1},env.X_TOKEN_ENCRYPTION_KEY));
  const r=await credentials(env,f.redis,f.fetcher,clock);assert.equal(r.accessToken,'refreshed-access');const saved=f.data.get('digivated:private:x:connection');assert.ok(!saved.includes('refreshed-access'));assert.equal(unseal(saved,env.X_TOKEN_ENCRYPTION_KEY).refreshToken,'rotated-refresh');
});
test('stale research and non-invitations never reach X',async()=>{
  for(const candidate of [{researchedAt:'2026-10-05T08:00:00Z'},{invitation_excerpt:'Frontend',text:'Frontend tools are cool.'}]){const f=fixture({candidate});await publishOne(env,f.redis,f.fetcher,clock);assert.equal(f.calls.length,0);}
});
