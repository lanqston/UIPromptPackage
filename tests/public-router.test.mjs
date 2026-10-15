import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { makePublicRouter } from '../server/public-router.mjs';

test('shared deployment entry preserves each original URL, method, body and headers', async () => {
  for (const route of ['content', 'saved-item', 'project-views']) {
    const req = { url: `/api/${route}?type=resource&id=example`, method: route === 'project-views' ? 'POST' : 'GET', headers: { origin:'https://digivated.com' }, body:{ fixture:true } };
    const res = {};
    let calls = 0;
    const router = makePublicRouter({ [route]: async (incoming, outgoing) => { assert.equal(incoming,req); assert.equal(outgoing,res); calls++; return 'handled'; } });
    assert.equal(await router(req,res),'handled');
    assert.equal(calls,1);
  }
});
test('unknown routes cannot invoke handlers, including prototype properties', () => {
  const router = makePublicRouter({ content:()=>assert.fail('unexpected dispatch') });
  for (const path of ['/api/unknown','/api/toString','/api/content/extra','/content']) {
    const headers={}; let body;
    const res={setHeader:(k,v)=>headers[k]=v,end:v=>body=JSON.parse(v)};
    router({url:path},res);
    assert.equal(res.statusCode,404); assert.equal(headers['Cache-Control'],'no-store'); assert.equal(body.error,'Not found.');
  }
});
test('deployment keeps all capabilities within the Hobby function limit', () => {
  const entries=readdirSync(new URL('../api/',import.meta.url)).filter(name=>name.endsWith('.js'));
  assert.equal(entries.length,12);
  for (const name of ['[route].js','projects.js','submissions.js','admin.js','activate.js','edition.js','logout.js','x-connect.js','x-research.js','x-publish.js']) assert.ok(entries.includes(name));
});
