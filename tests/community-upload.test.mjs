import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
const source=stripTypeScriptTypes(readFileSync(new URL('../supabase/functions/community-upload/index.ts',import.meta.url),'utf8'));
const origin='https://digitalpromptpackage-git-feature-digivated-community-langston3.vercel.app';
const user={id:'e0000000-0000-4000-8000-000000000001',email_confirmed_at:'2026-10-15',is_anonymous:false};
const image='data:image/webp;base64,'+Buffer.from('RIFF0000WEBPVP8 test').toString('base64');
function handler(fetcher){let serve;vm.runInNewContext(source,{Deno:{serve:fn=>serve=fn,env:{get:n=>n==='SUPABASE_URL'?'https://example.supabase.co':'test-key'}},Request,Response,Uint8Array,TextDecoder,AbortSignal,crypto,atob,fetch:fetcher});return serve;}
function request(body={image},headers={}){return new Request('https://example.supabase.co/functions/v1/community-upload',{method:'POST',headers:{origin,authorization:'Bearer fixture.token.value',...headers},body:JSON.stringify(body)});}
test('upload rejects wrong origins and missing member tokens before using services',async()=>{const h=handler(()=>{throw new Error('unexpected service call');});assert.equal((await h(request({}, {origin:'https://other.invalid'}))).status,403);assert.equal((await h(request({}, {authorization:''}))).status,401);});
test('upload checks actual identity and confirmed email',async()=>{assert.equal((await handler(async()=>new Response('{}',{status:401}))(request())).status,401);assert.equal((await handler(async()=>Response.json({...user,email_confirmed_at:null}))(request())).status,403);});
test('upload rejects invalid image bytes before reserving budget',async()=>{let calls=0;const r=await handler(async()=>{calls++;return Response.json(user);})(request({image:'data:image/png;base64,bm90LWFuLWltYWdl'}));assert.equal(r.status,400);assert.equal(calls,1);});
test('upload stops when database denies budget or suspended member',async()=>{let calls=0;const r=await handler(async()=>++calls===1?Response.json(user):new Response('{}',{status:403}))(request());assert.equal(r.status,429);assert.equal(calls,2);});
test('upload writes validated bytes only under authenticated owner path',async()=>{const calls=[];const r=await handler(async(url,opts)=>{calls.push({url,opts});return calls.length===1?Response.json(user):Response.json({});})(request());assert.equal(r.status,200);assert.match((await r.json()).path,new RegExp('^'+user.id+'/'));assert.equal(calls[1].url,'https://example.supabase.co/rest/v1/rpc/community_reserve_upload');assert.match(calls[2].url,new RegExp('/community-media/'+user.id+'/'));assert.equal(calls[2].opts.headers['Content-Type'],'image/webp');assert.equal(r.headers.get('Access-Control-Allow-Origin'),origin);});
test('upload never returns server credentials on storage failures',async()=>{let calls=0;const r=await handler(async()=>++calls===1?Response.json(user):calls===2?Response.json({}):new Response('secret failure',{status:500}))(request());assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/secret failure|test-key/);});
