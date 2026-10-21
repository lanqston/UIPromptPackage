import test from 'node:test';
import assert from 'node:assert/strict';
import { browseCarousels } from '../src/lib/carousel-browse.mjs';
const items = [{title:'Alpha', summary:'Design basics', created:'2026-10-19T12:00:00Z'}, {title:'Beta', summary:'Career planning', created:'2026-10-21T12:00:00Z'}, {title:'Undated', summary:'Older entry'}];
test('carousels default to newest first, keeping undated entries last without mutating input', () => {
  assert.deepEqual(browseCarousels(items).map(x=>x.title), ['Beta','Alpha','Undated']);
  assert.equal(items[0].title,'Alpha');
});
test('carousel search matches title or summary without case sensitivity', () => {
  assert.deepEqual(browseCarousels(items,' CAREER ').map(x=>x.title), ['Beta']);
  assert.equal(browseCarousels(items,'nothing').length,0);
});
test('carousel alphabetical sort is independent of dates', () => {
  assert.deepEqual(browseCarousels(items,'','title').map(x=>x.title), ['Alpha','Beta','Undated']);
});
