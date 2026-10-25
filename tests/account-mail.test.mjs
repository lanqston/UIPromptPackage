import test from 'node:test';
import assert from 'node:assert/strict';
import { projectUpdate, sendProjectUpdate } from '../server/account-mail.mjs';

const previous = { id:'project-1', accountId:'account-1', email:'creator@example.com', status:'pending', reviewFeedback:'' };
const saved = { ...previous, status:'approved', revision:1, reviewFeedback:'Private owner feedback.' };

test('account project updates link to private feedback without including it in email',()=>{
  const update=projectUpdate(previous,saved);
  assert.equal(update.to,previous.email);
  assert.match(update.text,/https:\/\/digivated.com\/account/);
  assert.doesNotMatch(JSON.stringify(update),/Private owner feedback/);
  assert.equal(projectUpdate(previous,{...previous,revision:1}),null);
  assert.equal(projectUpdate(previous,{...saved,accountId:null}),null);
});

test('project notifications require a configured sender and use a stable send key',async()=>{
  assert.equal(await sendProjectUpdate(previous,saved,{}),'unavailable');
  const requests=[];
  const send=async(url,options)=>{requests.push({url,options});return {ok:true};};
  const env={RESEND_API_KEY:'test-key',ACCOUNT_EMAIL_FROM:'Digivated <updates@digivated.com>'};
  const client={auth:{admin:{getUserById:async()=>({data:{user:{email:previous.email,email_confirmed_at:'2026-10-25T00:00:00Z'}},error:null})}}};
  assert.equal(await sendProjectUpdate(previous,saved,env,send,client),'sent');
  assert.equal(requests[0].url,'https://api.resend.com/emails');
  assert.equal(requests[0].options.headers['Idempotency-Key'],'digivated-project-project-1-r1');
  const body=JSON.parse(requests[0].options.body);
  assert.deepEqual(body.to,['creator@example.com']);
  assert.doesNotMatch(JSON.stringify(body),/Private owner feedback/);
  assert.equal(await sendProjectUpdate(previous,saved,env,async()=>({ok:false}),client),'failed');
  assert.equal(await sendProjectUpdate(previous,saved,env,async()=>{throw Error('provider');},client),'failed');
  const changedEmail={auth:{admin:{getUserById:async()=>({data:{user:{email:'new@example.com',email_confirmed_at:'2026-10-25T00:00:00Z'}},error:null})}}};
  assert.equal(await sendProjectUpdate(previous,saved,env,send,changedEmail),'failed');
  assert.equal(requests.length,1);
});
