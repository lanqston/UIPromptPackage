import test from 'node:test';
import assert from 'node:assert/strict';
import { accountIndex, makeProjectAccountHandler } from '../server/project-account.mjs';
import { makeSubmissionHandler } from '../server/submissions.mjs';

const env={COMMUNITY_SUPABASE_URL:'https://cglkjclolglwizwepvmy.supabase.co',COMMUNITY_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUBMISSIONS_REDIS_REST_TOKEN:'test-secret',SUBMISSIONS_ORIGIN:'https://digivated.com'};
const account={id:'4ad90c9b-5666-482d-899c-d0d3ef41ee46',email:'creator@example.com'};
async function invoke(handler,req){let body;const res={setHeader(){},end(value){body=JSON.parse(value);}};await handler(req,res);return {status:res.statusCode,body};}
const submission={creator:'Creator',email:account.email,name:'Sample',url:'https://example.com',description:'A sample project for account testing.',category:'Apps',consent:true};
test('verified submissions are indexed by email and visible only to that account without private fields',async()=>{
 const commands=[];
 const saved=await invoke(makeSubmissionHandler({env,verifyAccount:async()=>account,redis:async c=>{commands.push(c);return 1;}}),{method:'POST',url:'/api/submissions',headers:{origin:env.SUBMISSIONS_ORIGIN,authorization:'Bearer fixture','content-type':'application/json','x-real-ip':'127.0.0.1'},body:submission});
 assert.equal(saved.status,201);
 const command=commands[0];assert.equal(command[6],accountIndex(account.email,env.SUBMISSIONS_REDIS_REST_TOKEN));
 const stored=JSON.parse(command[7]);assert.equal(stored.accountId,account.id);
 const redis=async c=>c[0]==='ZREVRANGE'?[stored.id]:[JSON.stringify({...stored,notes:'private',promotion:{receiptReference:'secret'},reviewFeedback:'Please clarify your audience.'})];
 const handler=makeProjectAccountHandler({env,verifyAccount:async()=>account,redis});
 const result=await invoke(handler,{method:'GET',url:'/api/project-account',headers:{authorization:'Bearer fixture'}});
 assert.equal(result.status,200);assert.equal(result.body.submissions[0].feedback,'Please clarify your audience.');
 assert.equal(JSON.stringify(result.body).includes('private'),false);assert.equal(JSON.stringify(result.body).includes('secret'),false);
 const anonymous=await invoke(makeProjectAccountHandler({env,verifyAccount:async()=>null,redis}),{method:'GET',url:'/api/project-account',headers:{}});
 assert.equal(anonymous.status,401);
});
test('a verified account cannot submit using another email',async()=>{
 const result=await invoke(makeSubmissionHandler({env,verifyAccount:async()=>account,redis:async()=>{throw Error('should not write');}}),{method:'POST',url:'/api/submissions',headers:{origin:env.SUBMISSIONS_ORIGIN,authorization:'Bearer fixture','content-type':'application/json','x-real-ip':'127.0.0.1'},body:{...submission,email:'someone@example.com'}});
 assert.equal(result.status,403);
});
