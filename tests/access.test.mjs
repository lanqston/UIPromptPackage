import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { EncryptJWT } from 'jose';
import { config, PRODUCT_ID, COOKIE, verifyLicense, sealSession, openSession, sessionCookie, AccessError, normalizeLicense } from '../server/access.mjs';
import { makeHandler } from '../server/handler.mjs';
const license = 'A1B2C3D4-E5F60718-9ABCDEF0-1234ABCD';
const env = { ACCESS_ENABLED:'true', APP_ORIGIN:'https://example.test', GUMROAD_PRODUCT_ID:PRODUCT_ID, SESSION_SECRET:randomBytes(32).toString('hex'), EDITION_KEY:randomBytes(32).toString('hex'), VERCEL_ENV:'production' };
const cfg = config(env);
const purchase = { product_id:PRODUCT_ID, sale_id:'sale-fixture', refunded:false, chargebacked:false, disputed:false, dispute_won:false, test:false, subscription_id:null };
const upstream = (p=purchase, status=200) => async (url, options) => {
 assert.equal(url,'https://api.gumroad.com/v2/licenses/verify');
 assert.equal(options.body.get('increment_uses_count'),'false');
 assert.equal(options.body.get('product_id'),PRODUCT_ID);
 assert.equal(options.redirect,'error');
 return new Response(JSON.stringify({success:true,purchase:p}),{status});
};
const verify = (key,c) => verifyLicense(key,c,upstream());
const edition = { version:1,prompts:[{id:2,prompt:'PAID_FIXTURE'}],workflows:[],checklists:[] };
async function invoke(action, request={}, overrides={}) {
 const headers = {}; let body='';
 const res={setHeader:(k,v)=>{headers[k.toLowerCase()]=v;},end:v=>{body=v;},statusCode:0};
 await makeHandler(action,{env,verify,limit:async()=>{},load:async()=>edition,audit:()=>{},...overrides})({method:action==='edition'?'GET':'POST',url:`/api/${action}`,headers:{origin:cfg.origin,'content-type':'application/json',...request.headers},...request, ...(request.headers?{headers:{origin:cfg.origin,'content-type':'application/json',...request.headers}}:{})},res);
 return {status:res.statusCode,headers,body:JSON.parse(body)};
}
test('configuration fails closed; production cannot enable test purchases',()=>{
 assert.throws(()=>config({...env,ACCESS_ENABLED:'false'}));
 assert.throws(()=>config({...env,GUMROAD_PRODUCT_ID:'ui-prompt-package'}));
 assert.throws(()=>config({...env,SESSION_SECRET:'short'}));
 assert.throws(()=>config({...env,APP_ORIGIN:'http://example.test'}));
 assert.equal(config({...env,ALLOW_TEST_PURCHASES:'true'}).allowTest,false);
});
test('valid purchase; canonical normalization; no usage counter side effects',async()=>{
 assert.equal(normalizeLicense(' '+license.toLowerCase()+' '),license);
 assert.deepEqual(await verify(license,cfg),{saleId:'sale-fixture'});
});
for(const [name,patch] of Object.entries({wrong_product:{product_id:'another'},refund:{refunded:true},chargeback:{chargebacked:true},dispute:{disputed:true},test:{test:true},string_test:{test:'false'},subscription:{subscription_id:'sub'},missing_status:{refunded:undefined},missing_sale:{sale_id:undefined},malformed_status:{disputed:'false'}})) {
 test(`reject ${name}`,async()=>assert.rejects(()=>verifyLicense(license,cfg,upstream({...purchase,...patch})),e=>e.status===401));
}
test('won disputes regain access; preview test purchases remain separate',async()=>{
 await verifyLicense(license,cfg,upstream({...purchase,disputed:true,dispute_won:true}));
 await verifyLicense(license,{...cfg,allowTest:true},upstream({...purchase,test:true}));
});
test('invalid/disabled licenses rejected; outages fail closed',async()=>{
 await assert.rejects(()=>verifyLicense(license,cfg,upstream(purchase,404)),e=>e.status===401);
 for(const fetcher of [upstream(purchase,429),upstream(purchase,503),async()=>{throw Error('network');},async()=>new Response('not json')]) await assert.rejects(()=>verifyLicense(license,cfg,fetcher),e=>e.status===503);
});
test('encrypted, origin-bound session; tampering, expiry and wrong environment rejected',async()=>{
 const token=await sealSession(license,'sale-fixture',cfg);
 assert(!token.includes(license));
 assert.deepEqual(await openSession(`${COOKIE}=${token}`,cfg),{license,saleId:'sale-fixture'});
 await assert.rejects(()=>openSession(`${COOKIE}=${token.slice(0,-8)}brokenXX`,cfg));
 await assert.rejects(()=>openSession(`${COOKIE}=${token}`,{...cfg,origin:'https://other.test'}));
 await assert.rejects(()=>openSession(`${COOKIE}=${token}`,{...cfg,sessionKey:randomBytes(32)}));
 await assert.rejects(()=>openSession(`${COOKIE}=${token}; ${COOKIE}=${token}`,cfg));
 const expired=await new EncryptJWT({license,saleId:'sale-fixture',productId:PRODUCT_ID}).setProtectedHeader({alg:'dir',enc:'A256GCM'}).setIssuedAt(1).setExpirationTime(2).setIssuer(cfg.origin).setAudience('uip-full-edition').encrypt(cfg.sessionKey);
 await assert.rejects(()=>openSession(`${COOKIE}=${expired}`,cfg));
 assert.match(sessionCookie(token),/HttpOnly; Secure; SameSite=Strict/);
});
test('activation, return access, repeated activation and sign out',async()=>{
 const a=await invoke('activate',{body:{license}});assert.equal(a.status,200);
 assert.match(a.headers['set-cookie'],/Max-Age=2592000/);
 const second=await invoke('activate',{body:{license}});assert.equal(second.status,200);
 const cookie=a.headers['set-cookie'].split(';')[0];
 const read=await invoke('edition',{headers:{cookie}});assert.equal(read.status,200);assert.equal(read.body.prompts[0].prompt,'PAID_FIXTURE');
 assert.match(read.headers['cache-control'],/no-store/);
 assert.equal(read.headers['vercel-cdn-cache-control'],'no-store');
 const logout=await invoke('logout');assert.equal(logout.status,200);assert.match(logout.headers['set-cookie'],/Max-Age=0/);
});
test('anonymous, forged flags and keys in URLs never unlock content',async()=>{
 assert.equal((await invoke('edition')).status,401);
 assert.equal((await invoke('edition',{headers:{cookie:'unlocked=true; email=buyer@example.test'}})).status,401);
 assert.equal((await invoke('activate',{url:'/api/activate?license='+license,body:{license}})).status,400);
 assert.equal((await invoke('activate',{body:{email:'buyer@example.test'}})).status,401);
 assert.equal((await invoke('notification',{body:{product_id:PRODUCT_ID,sale_id:'forged'}})).status,404);
});
test('CSRF, wrong methods, invalid inputs, oversized input blocked',async()=>{
 assert.equal((await invoke('activate',{body:{license},headers:{origin:'https://evil.test'}})).status,403);
 assert.equal((await invoke('logout',{headers:{origin:undefined}})).status,403);
 assert.equal((await invoke('edition',{headers:{'sec-fetch-site':'cross-site'}})).status,403);
 assert.equal((await invoke('activate',{method:'GET'})).status,405);
 assert.equal((await invoke('activate',{body:{license},headers:{'content-type':'text/plain'}})).status,415);
 assert.equal((await invoke('activate',{body:'{'})).status,400);
 assert.equal((await invoke('activate',{body:' '.repeat(1025)})).status,413);
});
test('rate limits and dependency failures cannot grant access',async()=>{
 for(const status of [429,503]) {
 const r=await invoke('activate',{body:{license}},{limit:async()=>{throw new AccessError(status,'limit','Try later');}});
 assert.equal(r.status,status);assert.equal(r.headers['set-cookie'],undefined);assert.equal(r.headers['retry-after'],'60');
 }
 const r=await invoke('activate',{body:{license}},{load:async()=>{throw Error('private detail');}});
 assert.equal(r.status,503);assert(!JSON.stringify(r).includes('private detail'));
});
test('refund after activation revokes the next protected read',async()=>{
 const a=await invoke('activate',{body:{license}});const cookie=a.headers['set-cookie'].split(';')[0];
 const r=await invoke('edition',{headers:{cookie}},{verify:(key,c)=>verifyLicense(key,c,upstream({...purchase,refunded:true}))});
 assert.equal(r.status,401);assert.match(r.headers['set-cookie'],/Max-Age=0/);assert(!JSON.stringify(r).includes('PAID_FIXTURE'));
});
test('outage keeps encrypted session for retry; changed purchase identity denied',async()=>{
 const a=await invoke('activate',{body:{license}});const cookie=a.headers['set-cookie'].split(';')[0];
 const r=await invoke('edition',{headers:{cookie}},{verify:async()=>{throw new AccessError(503,'upstream','Try later');}});
 assert.equal(r.status,503);assert.equal(r.headers['set-cookie'],undefined);
 assert.equal((await invoke('edition',{headers:{cookie}},{verify:async()=>({saleId:'different'})})).status,401);
 assert.equal((await invoke('edition',{headers:{cookie}})).status,200);
});
test('audit contains neither raw credentials nor customer details',async()=>{
 const events=[];await invoke('activate',{body:{license}},{audit:event=>events.push(event)});
 const text=JSON.stringify(events);assert(!text.includes(license));assert(!text.includes('email'));assert(!text.includes('sale-fixture'));
});
