import { test } from 'node:test';
import assert from 'node:assert/strict';
import { passwordHash, adminConfig, createSession, cookie } from '../server/admin-auth.mjs';
import { makeAdminHandler } from '../server/admin-handler.mjs';

const id='4ad90c9b-5666-482d-899c-d0d3ef41ee46';
const origin='https://digivated.com';

test('owner-only account list and status change expose limited user fields',async()=>{
  const env={DIGIVATED_ADMIN_PASSWORD_HASH:await passwordHash('Test-only password for accounts'),DIGIVATED_ADMIN_SESSION_SECRET:'a'.repeat(64),DIGIVATED_ADMIN_ORIGIN:origin};
  const sessions=new Map();
  const redis=async command=>command[0]==='SET'?sessions.set(command[1],command[2]):sessions.get(command[1]);
  const session=await createSession(redis,adminConfig(env));
  const user={id,email:'creator@example.com',created_at:'2026-10-01T00:00:00Z',email_confirmed_at:'2026-10-01T00:00:00Z',app_metadata:{providers:['email'],adminSecret:'private'},user_metadata:{notes:'private'}};
  let banned=false;const calls=[];
  const accountClient={auth:{admin:{
    listUsers:async options=>{calls.push(options);return {data:{users:[{...user,banned_until:banned?'2126-10-01T00:00:00Z':null}]},error:null};},
    getUserById:async()=>({data:{user},error:null}),
    updateUserById:async(_id,input)=>{calls.push(input);banned=input.ban_duration!=='none';return {data:{user:{...user,banned_until:banned?'2126-10-01T00:00:00Z':null}},error:null};}
  }}};
  const handler=makeAdminHandler({env,redis,accountClient});
  async function invoke({method='GET',url='/api/admin?action=accounts',body,cookieHeader='',csrf='',requestOrigin=origin}={}){
    let result;const req={method,url,body,headers:{cookie:cookieHeader,origin:requestOrigin,'x-admin-csrf':csrf,'content-type':'application/json'}};
    const res={statusCode:200,setHeader(){},end(value){result=JSON.parse(value);}};
    await handler(req,res);return {status:res.statusCode,body:result};
  }
  assert.equal((await invoke()).status,401);
  const signed=cookie(session.token).split(';')[0];
  const listed=await invoke({cookieHeader:signed});assert.equal(listed.status,200);assert.equal(listed.body.items[0].email,user.email);
  assert.equal(JSON.stringify(listed.body).includes('private'),false);
  assert.deepEqual(calls[0],{page:1,perPage:50});
  assert.equal((await invoke({cookieHeader:signed,url:'/api/admin?action=accounts&page=-1'})).status,400);
  assert.equal((await invoke({method:'POST',url:'/api/admin',cookieHeader:signed,body:{action:'account-status',id,operation:'block'},csrf:'wrong'})).status,403);
  assert.equal((await invoke({method:'POST',url:'/api/admin',cookieHeader:signed,body:{action:'account-status',id,operation:'block'},csrf:session.csrf,requestOrigin:'https://other.test'})).status,403);
  const blocked=await invoke({method:'POST',url:'/api/admin',cookieHeader:signed,body:{action:'account-status',id,operation:'block'},csrf:session.csrf});
  assert.equal(blocked.status,200);assert.equal(blocked.body.user.bannedUntil,'2126-10-01T00:00:00Z');assert.deepEqual(calls.at(-1),{ban_duration:'876000h'});
  const restored=await invoke({method:'POST',url:'/api/admin',cookieHeader:signed,body:{action:'account-status',id,operation:'unblock'},csrf:session.csrf});
  assert.equal(restored.status,200);assert.deepEqual(calls.at(-1),{ban_duration:'none'});
});
