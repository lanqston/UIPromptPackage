import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSubmission, makeSubmissionHandler } from '../server/submissions.mjs';
import { publicRecord } from '../server/community-publication.mjs';
import { publicProjects } from '../src/data/community.mjs';
const valid={creator:'Test creator',email:'creator@example.com',name:'Test project',url:'https://example.com',description:'A project description used only in automated tests.',category:'Apps',consent:true,image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aFJkAAAAASUVORK5CYII='};
test('submissions cannot self-approve or publish private fields',()=>{
 const record=validateSubmission({...valid,status:'featured',pick:true,email:'private@example.com',notes:'Private review notes'});
 assert.equal(record.status,'pending');assert.equal(record.pick,false);assert.equal(publicRecord(record),null);
 const result=publicRecord({...record,id:'fixture',date:'2026-10-05',status:'approved'});
 for(const field of ['email','notes','consent','consentVersion','consentedAt','emailOutreachConsent','emailOutreachConsentedAt','social'])assert.equal(field in result,false);
 assert.equal(publicProjects([{...result,status:'pending'},{...result,status:'rejected'},result]).length,1);
});
test('validate consent, category, URL, lengths, and image content',()=>{
 for(const patch of [{consent:false},{category:'Invented'},{url:'javascript:alert(1)'},{url:'https://user:password@example.com'},{email:'bad'},{description:'short'},{creator:'x'.repeat(101)},{image:''},{image:'data:image/svg+xml;base64,PHN2Zz4='},{image:'data:image/png;base64,aGVsbG8='}])assert.throws(()=>validateSubmission({...valid,...patch}));
 const {image,...withoutImage}=valid;
 assert.throws(()=>validateSubmission(withoutImage),/at least one project image/i);
 assert.equal(validateSubmission(valid).url,'https://example.com/');
});
test('email outreach requires a separate explicit choice and records it only for opted-in submissions',async()=>{
 assert.equal(validateSubmission(valid).emailOutreachConsent,false);
 assert.equal(validateSubmission({...valid,emailOutreachConsent:'true'}).emailOutreachConsent,false);
 let saved;
 const opted=await invoke({body:{...valid,emailOutreachConsent:true},redis:async command=>{saved=JSON.parse(command[7]);return 1;}});
 assert.equal(opted.status,201);
 assert.equal(saved.emailOutreachConsent,true);
 assert.equal(saved.emailOutreachConsentVersion,1);
 assert.match(saved.emailOutreachConsentedAt,/^\d{4}-\d\d-\d\dT/);
 await invoke({redis:async command=>{saved=JSON.parse(command[7]);return 1;}});
 assert.equal(saved.emailOutreachConsent,false);
 assert.equal('emailOutreachConsentedAt' in saved,false);
});
test('an image is required before a submission can be saved',async()=>{
 const result=await invoke({body:{...valid,image:''},redis:async()=>{throw Error('should not write');}});
 assert.equal(result.status,400);assert.match(result.data.error,/at least one project image/i);
});
async function invoke({body=valid,method='POST',origin='https://digivated.com',redis=async()=>1,headers={}}={}){
 const req={method,headers:{origin,'content-type':'application/json','x-real-ip':'127.0.0.1',authorization:'Bearer fixture',...headers},body};let data;const responseHeaders={};
 const res={setHeader:(k,v)=>responseHeaders[k]=v,end:value=>data=JSON.parse(value)};
 await makeSubmissionHandler({redis,verifyAccount:async()=>({id:'account-fixture',email:valid.email})})(req,res);return {status:res.statusCode,data,headers:responseHeaders};
}
test('an account is required even for a direct submission request',async()=>{
 const result=await invoke({headers:{authorization:''},redis:async()=>{throw Error('should not write');}});
 assert.equal(result.status,401);assert.match(result.data.error,/account or sign in/i);
});
test('successful save is private and pending, storage is required',async()=>{
 let command;const response=await invoke({redis:async c=>{command=c;return 1;}});assert.equal(response.status,201);assert.equal(response.data.status,'pending');assert.equal(JSON.parse(command[7]).status,'pending');
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
