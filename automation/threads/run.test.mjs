import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

function preview(scenario) {
  const harness=`
    const writes=[];
    const scenario=${JSON.stringify(scenario)};
    globalThis.fetch=async (url,opts)=>{
      url=new URL(url);
      if(opts.method!=='GET') { writes.push(url.pathname); throw new Error('Unexpected mutation'); }
      let body={}; let status=200;
      if(url.hostname==='api.github.com') body={sha:'logsha',content:Buffer.from(JSON.stringify({version:1,entries:[]})).toString('base64')};
      else if(url.pathname.endsWith('/me')) body={id:'me123',username:scenario==='wrong-account'?'lxngston':'promptcove'};
      else if(url.pathname.endsWith('/keyword_search')) body={data:[{id:'123',text:'App builders, drop your projects below!',permalink:'https://www.threads.com/@builder/post/abc',username:'builder',timestamp:new Date().toISOString(),is_reply:false,is_quote_post:false}]};
      else if(url.pathname.endsWith('/conversation')) {
        if(scenario==='unreadable') { status=403; body={error:{code:10}}; }
        else if(scenario==='partial') body={data:[{id:'456'}]};
        else if(scenario==='already-replied') body={data:[{id:'456',username:'promptcove'}]};
        else if(scenario==='pagination') body={data:[],paging:{next:'https://evil.example/?after=secret'}};
        else body={data:[]};
      } else throw new Error('Unexpected route');
      return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
    };
    await import('./automation/threads/run.mjs');
    console.log('MUTATIONS='+writes.length);
  `;
  return spawnSync(process.execPath,['--input-type=module','-e',harness],{cwd:new URL('../../',import.meta.url),encoding:'utf8',env:{PATH:process.env.PATH,THREADS_ACCESS_TOKEN:'test-token',GH_TOKEN:'test-gh',GITHUB_REPOSITORY:'test/repo',THREADS_LIVE:'true'}});
}
test('preview never publishes even with the environment live flag',()=>{
  const run=preview('valid'); assert.equal(run.status,0); assert.match(run.stdout,/Eligible \(preview only\)/); assert.match(run.stdout,/MUTATIONS=0/);
});
test('wrong account stops before any mutation',()=>{
  const run=preview('wrong-account'); assert.equal(run.status,1); assert.match(run.stdout,/not @promptcove/); assert.match(run.stdout,/MUTATIONS=0/);
});
test('unreadable, incomplete, duplicate and unsafe-paginated replies never publish',()=>{
  for(const scenario of ['unreadable','partial','already-replied','pagination']) {
    const run=preview(scenario); assert.equal(run.status,0,run.stdout); assert.match(run.stdout,/Skipped/); assert.doesNotMatch(run.stdout,/Eligible/); assert.match(run.stdout,/MUTATIONS=0/);
  }
});
