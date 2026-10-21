import test from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionStore, mergeCollections, initialCollections } from '../src/lib/collections.mjs';
import { makeSavedItemHandler } from '../server/saved-items.mjs';

test('saved carousels persist and survive backup merges alongside existing resources', () => {
  let raw = null;
  const storage = { getItem: () => raw, setItem: (_, value) => { raw = value; } };
  const store = createCollectionStore(storage);
  store.update(data => data.collections[0].items.push({ type: 'carousel', id: 'a-useful-lesson' }, { type: 'resource', id: 'builtin-ui-ux-prompt-packet' }));
  const restored = createCollectionStore(storage).get();
  assert.deepEqual(restored.collections[0].items.map(x=>x.type), ['carousel','resource']);
  const merged = mergeCollections(mergeCollections(initialCollections(), restored), restored);
  assert.equal(merged.collections[0].items.length, 2);
});

test('saved carousel lookup returns public metadata without full slides, references or member access', async () => {
  const item = { slug:'a-useful-lesson', title:'A useful lesson', summary:'Learn one idea.', slides:Array.from({length:7},()=>({text:'PAID_SLIDE',image:'PRIVATE_IMAGE'})), references:[{note:'PRIVATE_REFERENCE'}] };
  const handler = makeSavedItemHandler({ redis:async command => command[1] === 'digivated:carousel:item:a-useful-lesson' ? JSON.stringify(item) : null });
  const call = async id => {
    let body;
    const res = { statusCode:200, setHeader(){}, end(value){body=JSON.parse(value);} };
    await handler({method:'GET', url:`/api/saved-item?type=carousel&id=${id}`},res);
    return {status:res.statusCode,body};
  };
  const result = await call('a-useful-lesson');
  assert.equal(result.status,200);
  assert.deepEqual(result.body.item,{id:item.slug,title:item.title,description:item.summary,url:'/carousels/a-useful-lesson'});
  assert.doesNotMatch(JSON.stringify(result), /PAID_SLIDE|PRIVATE_IMAGE|PRIVATE_REFERENCE/);
  assert.equal((await call('missing-lesson')).status,404);
});
