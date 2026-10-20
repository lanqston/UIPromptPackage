import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makePublicHandler } from '../server/public-community.mjs';
import { makeSavedItemHandler } from '../server/saved-items.mjs';

async function get(handler,url) {
  let body; const res={statusCode:200,setHeader(){},end(value){body=JSON.parse(value);}};
  await handler({method:'GET',url,headers:{}},res);
  return {status:res.statusCode,body};
}
test('withdrawn articles and images cannot be retrieved through public or saved APIs',async()=>{
  let reads=0;const redis=async()=>{reads++;throw Error('Archived content must not be fetched');};
  const content=makePublicHandler('content',{redis});
  assert.deepEqual((await get(content,'/api/content?type=resource')).body,{items:[],next:null});
  for(const query of ['id=make-sense-of-new-tech','id=dashboard-article','image=dashboard-article']) {
    assert.equal((await get(content,'/api/content?type=resource&'+query)).status,404);
  }
  const saved=makeSavedItemHandler({redis});
  assert.equal((await get(saved,'/api/saved-item?type=resource&id=make-sense-of-new-tech')).status,404);
  assert.equal((await get(saved,'/api/saved-item?type=resource&id=dashboard-article')).status,404);
  const packet=await get(saved,'/api/saved-item?type=resource&id=builtin-ui-ux-prompt-packet');
  assert.equal(packet.status,200);assert.equal(packet.body.item.url,'/ui-ux-prompt-packet');
  assert.equal(reads,0);
});
test('all original articles remain archived outside the active catalog',()=>{
  const archive=JSON.parse(readFileSync(new URL('../docs/archive/resources-2026-10-20.json',import.meta.url),'utf8'));
  const active=JSON.parse(readFileSync(new URL('../src/data/resources.json',import.meta.url),'utf8'));
  assert.equal(archive.length,18);assert.ok(archive.every(r=>r.slug&&r.content.length&&r.title));
  assert.deepEqual(active,[]);
});
