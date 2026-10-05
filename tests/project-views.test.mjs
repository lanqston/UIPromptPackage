import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeProjectViewHandler, withProjectViews, viewKey } from '../server/project-views.mjs';
import { makePublicHandler } from '../server/public-community.mjs';
import { testRedis } from './helpers/redis.mjs';
const origin = 'https://views.test';
async function invoke(handler, {id='test-project', method='POST', headers={}}={}) {
 let body; const response={statusCode:200,setHeader(){},end(value){body=JSON.parse(value);}};
 await handler({method,url:`/api/project-views?id=${id}`,headers:{origin,'x-real-ip':'192.0.2.1','user-agent':'Mozilla/5.0',...headers}},response);
 return {status:response.statusCode,body};
}
test('view endpoint validates requests before storage and fails safely',async()=>{
 const handler=makeProjectViewHandler({env:{SUBMISSIONS_ORIGIN:origin},redis:async()=>{throw Error('offline');}});
 assert.equal((await invoke(handler,{method:'GET'})).status,405);
 assert.equal((await invoke(handler,{headers:{origin:'https://other.test'}})).status,403);
 assert.equal((await invoke(handler,{headers:{'sec-fetch-site':'cross-site'}})).status,403);
 assert.equal((await invoke(handler,{id:'../private'})).status,404);
 assert.equal((await invoke(handler,{headers:{'user-agent':'Googlebot'}})).body.views,null);
 assert.equal((await invoke(handler)).status,503);
 assert.deepEqual(await withProjectViews(async()=>{throw Error('offline');},[{id:'a'}]),[{id:'a',views:null}]);
});
test('real Redis: atomic counts, expiry, private projects and public API',{skip:!process.env.DIGIVATED_TEST_REDIS_PORT},async()=>{
 const redis=testRedis(12);await redis(['FLUSHDB']);
 try {
 const handler=makeProjectViewHandler({redis,env:{SUBMISSIONS_ORIGIN:origin}});
 assert.equal((await invoke(handler)).status,404);assert.equal(await redis(['DBSIZE']),0);
 const record={id:'test-project',name:'Fixture',status:'approved'};
 await redis(['SET','digivated:public:submission:test-project',JSON.stringify(record)]);
 await redis(['ZADD','digivated:public:submissions',1,'test-project']);
 const results=await Promise.all(Array.from({length:15},()=>invoke(handler)));
 assert.ok(results.every(r=>r.status===200&&r.body.views===1));
 assert.equal((await invoke(handler,{headers:{'x-real-ip':'192.0.2.2'}})).body.views,2);
 const keys=await redis(['KEYS','digivated:project-view-seen:*']);assert.equal(keys.length,2);
 assert.ok(keys.every(k=>!k.includes('192.0.2')));assert.ok((await redis(['TTL',keys[0]]))>86000);
 await redis(['DEL',...keys]);assert.equal((await invoke(handler)).body.views,3);
 const publicApi=makePublicHandler('projects',{redis});
 const read=async url=>{let data;await publicApi({method:'GET',url},{setHeader(){},end(b){data=JSON.parse(b);}});return data;};
 assert.equal((await read('/api/projects')).items[0].views,3);
 assert.equal((await read('/api/projects?id=test-project')).item.views,3);
 await redis(['SET','digivated:featured','test-project']);assert.equal((await read('/api/projects?view=featured')).items[0].views,3);
 await redis(['DEL','digivated:public:submission:test-project']);assert.equal((await invoke(handler)).status,404);
 assert.equal((await read('/api/projects')).items.length,0);assert.equal(await redis(['GET',viewKey('test-project')]),'3');
 await redis(['SET','digivated:public:submission:test-project',JSON.stringify({...record,status:'featured'})]);assert.equal((await read('/api/projects')).items[0].views,3);
 } finally {await redis(['FLUSHDB']);}
});
