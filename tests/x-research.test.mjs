import test from 'node:test';
import assert from 'node:assert/strict';
import { runResearch, validCandidate, cronAuthorized, makeResearchHandler, makeAgent } from '../server/x-research.mjs';
import { adminConfig, digest, ADMIN_COOKIE } from '../server/admin-auth.mjs';

const clock = () => Date.parse('2026-10-05T12:00:00Z');
const candidate = { url: 'https://x.com/builder/status/123', author: 'builder', text: 'Frontend builders, let’s connect!', invitation_excerpt: 'let’s connect!', niche: 'Frontend Development', created_at: '2026-10-05T10:00:00Z' };
function storage() {
  const data = new Map(), rows = [];
  const redis = async ([cmd, key, value, ...rest]) => {
    if (cmd === 'GET') return data.get(key) ?? null;
    if (cmd === 'SET') { if (rest.includes('NX') && data.has(key)) return null; data.set(key,value); return 'OK'; }
    if (cmd === 'LRANGE') return rows;
    if (cmd === 'EVAL') {
      const [post,author,queue,entry] = rest;
      if (data.has(post) || data.has(author)) return 0;
      data.set(post,'1'); data.set(author,'1'); rows.unshift(entry); return 1;
    }
    throw new Error('Unknown Redis command');
  };
  return { data, rows, redis };
}
function agents(verified = true) {
  const roles = [];
  const agent = async role => {
    roles.push(role);
    return { scout: [candidate], verifier: [{ url: candidate.url, verified }], writer: [{ url: candidate.url, reply: 'Let’s connect 🤝' }], reviewer: [{ url: candidate.url, acceptable: true }] }[role];
  };
  return { roles, agent };
}
test('candidate validation rejects stale, future, foreign and invented sources', () => {
  assert.ok(validCandidate(candidate, clock()));
  for (const patch of [{url:'https://evil.example/builder/status/123'}, {author:'wrong'}, {created_at:'2026-09-01T00:00:00Z'}, {created_at:'2027-01-01T00:00:00Z'}, {created_at:'2026-10-05T10:00:00'}, {niche:'unrelated'}, {invitation_excerpt:'invented'}]) assert.equal(validCandidate({...candidate,...patch},clock()),false);
});
test('four stages save only private drafts and a repeat run spends no calls', async () => {
  const s=storage(), a=agents();
  const result=await runResearch(s.redis,a.agent,clock);
  assert.equal(result.status,'completed');assert.equal(result.added,1);
  assert.deepEqual(a.roles,['scout','verifier','writer','reviewer']);
  assert.equal(JSON.parse(s.rows[0]).automatedReplyConsent,'not_established');
  assert.equal((await runResearch(s.redis,a.agent,clock)).status,'already_ran_this_hour');
  assert.equal(a.roles.length,4);
});
test('unverified posts never reach the writer', async () => {
  const s=storage(),a=agents('true');await runResearch(s.redis,a.agent,clock);
  assert.deepEqual(a.roles,['scout','verifier']);assert.equal(s.rows.length,0);
});
test('concurrent daily runs invoke the pipeline once', async () => {
  const s=storage(),a=agents();
  const values=await Promise.all([runResearch(s.redis,a.agent,clock),runResearch(s.redis,a.agent,clock)]);
  assert.deepEqual(values.map(v=>v.status).sort(),['already_ran_this_hour','completed']);assert.equal(a.roles.length,4);
});
test('pause prevents paid calls', async () => {
  const s=storage(),a=agents();s.data.set('digivated:private:x-research:paused','1');
  assert.equal((await runResearch(s.redis,a.agent,clock)).status,'paused');assert.equal(a.roles.length,0);
});
test('provider failure is redacted and does not automatically retry', async () => {
  const s=storage();let calls=0;const agent=async()=>{calls++;throw new Error('secret-provider-value');};
  const result=await runResearch(s.redis,agent,clock);assert.equal(result.status,'failed');assert.ok(!JSON.stringify(result).includes('secret-provider-value'));
  await runResearch(s.redis,agent,clock);assert.equal(calls,1);
});
test('cron requires a long configured secret and exact bearer header', () => {
  assert.equal(cronAuthorized('Bearer undefined',undefined),false);
  assert.equal(cronAuthorized('Bearer '+ 'a'.repeat(32),'a'.repeat(32)),true);
  assert.equal(cronAuthorized('Bearer '+ 'b'.repeat(32),'a'.repeat(32)),false);
});
test('public visitors cannot view or run research', async () => {
  const s=storage();let called=false;
  const env={DIGIVATED_ADMIN_PASSWORD_HASH:`scrypt:${'a'.repeat(32)}:${'b'.repeat(128)}`,DIGIVATED_ADMIN_SESSION_SECRET:'c'.repeat(64)};
  const handler=makeResearchHandler({env,redis:s.redis,agent:async()=>{called=true;}});
  const res={setHeader(){},end(value){this.body=value;}};
  await handler({method:'GET',headers:{}},res);assert.equal(res.statusCode,401);assert.equal(called,false);
});
test('owner mutations require CSRF', async () => {
  const s=storage();const token='e'.repeat(64);
  const env={DIGIVATED_ADMIN_PASSWORD_HASH:`scrypt:${'a'.repeat(32)}:${'b'.repeat(128)}`,DIGIVATED_ADMIN_SESSION_SECRET:'c'.repeat(64)};
  s.data.set(`digivated:admin:session:${digest(token)}`,JSON.stringify({csrf:'f'.repeat(64),fingerprint:adminConfig(env).fingerprint}));
  const res={setHeader(){},end(){}};
  await makeResearchHandler({env,redis:s.redis})({method:'POST',headers:{cookie:`${ADMIN_COOKIE}=${token}`,origin:'https://digivated.vercel.app','content-type':'application/json'},body:{action:'resume'}},res);
  assert.equal(res.statusCode,403);
});
test('Grok requests never access X publishing API', async () => {
  const s=storage();const usage=[];
  const agent=makeAgent({XAI_API_KEY:'fake'},s.redis,async(url,options)=>{
    assert.equal(url,'https://api.x.ai/v1/responses');assert.equal(options.redirect,'error');
    const body=JSON.parse(options.body);assert.equal(body.tools,undefined);
    return {ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'[]'}]}],usage:{}})};
  });
  assert.deepEqual(await agent('writer','draft',false,usage),[]);assert.equal(usage.length,1);
});
