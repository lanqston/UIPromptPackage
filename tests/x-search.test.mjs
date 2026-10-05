import test from 'node:test';
import assert from 'node:assert/strict';
import { candidatesFromSearch, SEARCH_QUERY } from '../server/x-search.mjs';
test('builder invitation is extracted from exact X post data',()=>{
  const text="I want more builders on my timeline. AI / ML, SaaS, AI Agents, Dev Tools, Startups. Tell me what you're building. Let's connect 🤝";
  const rows=candidatesFromSearch({data:[{id:'123',author_id:'1',text,created_at:'2026-10-05T11:00:00Z'}],includes:{users:[{id:'1',username:'builder'}]}});
  assert.equal(rows.length,1);assert.equal(rows[0].text,text);assert.equal(rows[0].niche,'AI & Machine Learning');assert.equal(rows[0].url,'https://x.com/builder/status/123');
  assert.ok(SEARCH_QUERY.includes('-is:retweet'));
});
test('unrelated posts, giveaways and missing authors are excluded',()=>{
  const data=[{id:'1',author_id:'1',text:'SaaS giveaway! Let’s connect'}, {id:'2',author_id:'1',text:'SaaS launch today'}, {id:'3',author_id:'2',text:'AI builders let’s connect'}];
  assert.deepEqual(candidatesFromSearch({data,includes:{users:[{id:'1',username:'builder'}]}}),[]);
});
