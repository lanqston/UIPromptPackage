import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSubmission, makeSubmissionHandler } from '../server/submissions.mjs';
import { publicRecord } from '../server/community-publication.mjs';
import { publicProjects } from '../src/data/community.mjs';
const valid={creator:'Test creator',email:'creator@example.com',name:'Test project',url:'https://example.com',description:'A project description used only in automated tests.',category:'Apps',consent:true};
test('submissions cannot self-approve or publish private fields',()=>{
 const record=validateSubmission({...valid,status:'featured',pick:true,email:'private@example.com',notes:'Private review notes'});
 assert.equal(record.status,'pending');assert.equal(record.pick,false);assert.equal(publicRecord(record),null);
 const result=publicRecord({...record,id:'fixture',date:'2026-10-05',status:'approved'});
 for(const field of ['email','notes','consent','consentVersion','consentedAt','social'])assert.equal(field in result,false);
 assert.equal(publicProjects([{...result,status:'pending'},{...result,status:'rejected'},result]).length,1);
});
test('validate consent, category, URL, lengths, and image content',()=>{
 for(const patch of [{consent:false},{category:'Invented'},{url:'javascript:alert(1)'},{url:'https://user:password@example.com'},{email:'bad'},{description:'short'},{creator:'x'.repeat(101)},{image:'data:image/svg+xml;base64,PHN2Zz4='},{image:'data:image/png;base64,aGVsbG8='}])assert.throws(()=>validateSubmission({...valid,...patch}));
 assert.equal(validateSubmission(valid).url,'https://example.com/');
});
async function invoke({body=valid,method='POST',origin='https://digivated.vercel.app',redis=async()=>1,headers={}}={}){
 const req={method,headers:{origin,'content-type':'application/json','x-real-ip':'127.0.0.1',...headers},body};let data;const responseHeaders={};
 const res={setHeader:(k,v)=>responseHeaders[k]=v,end:value=>data=JSON.parse(value)};
 await makeSubmissionHandler({redis})(req,res);return {status:res.statusCode,data,headers:responseHeaders};
}
test('successful save is private and pending, storage is required',async()=>{
 let command;const response=await invoke({redis:async c=>{command=c;return 1;}});assert.equal(response.status,201);assert.equal(response.data.status,'pending');assert.equal(JSON.parse(command[6]).status,'pending');
 assert.equal((await invoke({redis:async()=>{throw Error('private secret upstream detail');}})).status,503);
 assert.equal((await invoke({redis:async()=>0})).status,429);
});
test('reject cross-origin, wrong method, malformed, oversized requests',async()=>{
 assert.equal((await invoke({origin:'https://evil.example'})).status,403);
 assert.equal((await invoke({origin:'https://digitalpromptpackage.vercel.app'})).status,403);
 assert.equal((await invoke({method:'GET'})).status,405);
 assert.equal((await invoke({body:'{'})).status,400);
 assert.equal((await invoke({headers:{'content-length':'800000'}})).status,413);
 assert.equal((await invoke({headers:{'content-type':'text/plain'}})).status,415);
});
