import test from 'node:test';
import assert from 'node:assert/strict';
import { makeAdminHandler } from '../server/admin-handler.mjs';
import { adminConfig, createSession, ADMIN_COOKIE } from '../server/admin-auth.mjs';
import { ownerCarouselList, ownerCarouselPreview } from '../server/owner-carousels.mjs';
const env={DIGIVATED_ADMIN_PASSWORD_HASH:`scrypt:${'a'.repeat(32)}:${'b'.repeat(128)}`,DIGIVATED_ADMIN_SESSION_SECRET:'c'.repeat(64),DIGIVATED_ADMIN_ORIGIN:'https://owner.test'};
const item={slug:'sample-lesson',title:'A <safe> lesson',summary:'A useful summary',slides:Array.from({length:7},(_,i)=>({text:`Lesson ${i+1} <script>alert(1)</script>`,alt:'Diagram',mime:'image/png',image:'aGVsbG8='})),references:[{label:'Official source',url:'https://example.com/lesson',note:'Next steps'},{label:'Unsafe',url:'javascript:alert(1)'}]};
function store(){const data=new Map([['digivated:carousel:item:sample-lesson',JSON.stringify(item)]]);const reads=[];return {reads,redis:async([op,key,value])=>{if(op==='SET'){data.set(key,value);return 'OK';}if(op==='ZREVRANGE')return ['sample-lesson'];if(op==='GET'){reads.push(key);return data.get(key)||null;}throw Error('Unexpected write');}};}
async function call(handler,url,cookie=''){let body;const headers={};const res={setHeader:(k,v)=>headers[k]=v,end:v=>body=v};await handler({method:'GET',url,headers:{cookie}},res);return {status:res.statusCode,headers,body};}
test('owner carousel reads require a current owner session and never expose full content anonymously',async()=>{
 const {redis,reads}=store();const handler=makeAdminHandler({env,redis});
 for(const url of ['/api/admin?action=carousels','/api/admin?action=preview&kind=carousel&id=sample-lesson'])assert.equal((await call(handler,url)).status,401);
 assert.equal(reads.length,0);
 const session=await createSession(redis,adminConfig(env));const cookie=`${ADMIN_COOKIE}=${session.token}`;
 const list=await call(handler,'/api/admin?action=carousels',cookie);assert.equal(list.status,200);assert.equal(JSON.parse(list.body).items[0].slideCount,7);assert.ok(!list.body.includes('Lesson 7'));
 const preview=await call(handler,'/api/admin?action=preview&kind=carousel&id=sample-lesson',cookie);assert.equal(preview.status,200);assert.match(preview.body,/Lesson 7/);assert.match(preview.body,/&lt;script&gt;/);assert.ok(!preview.body.includes('<script>'));assert.ok(!preview.body.includes('javascript:'));assert.match(preview.headers['Cache-Control'],/no-store/);assert.match(preview.headers['Content-Security-Policy'],/frame-ancestors 'none'/);assert.equal(preview.headers['X-Robots-Tag'],'noindex, nofollow');
 assert.equal((await call(handler,'/api/admin?action=carousels&offset=-1',cookie)).status,400);
 assert.equal((await call(handler,'/api/admin?action=preview&kind=carousel&id=../secret',cookie)).status,404);
});
test('owner carousel list and full preview use existing publisher records without membership or writes',async()=>{
 const {redis}=store();const list=await ownerCarouselList(redis);assert.equal(list.items.length,1);assert.equal(list.items[0].id,'sample-lesson');assert.equal(list.next,null);assert.ok((await ownerCarouselPreview(redis,'sample-lesson')).includes('id="slide-7"'));
});
