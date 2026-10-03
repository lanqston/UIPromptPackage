import test from 'node:test';
import assert from 'node:assert/strict';
import {matches,alreadyLogged,day} from './matcher.mjs';
import {readFileSync} from 'node:fs';
const config=JSON.parse(readFileSync(new URL('./config.json',import.meta.url)));
const now=Date.parse('2026-10-03T12:00:00Z');
const post={id:'123',permalink:'https://www.threads.com/@builder/post/abc',username:'builder',timestamp:'2026-10-03T10:00:00Z',is_reply:false,is_quote_post:false,text:'App builders, drop your projects below!'};
test('accepts recent explicit relevant invitations',()=>assert.equal(matches(post,config,now),true));
test('skips ambiguous, restricted, irrelevant, old, quoted, own and incomplete posts',()=>{
  for(const change of [{text:'What are you building?'},{text:'Only free apps: drop your projects'},{text:'Drop your products, no links'},{text:'Girls, share your apps'},{text:'Drop your handmade products'},{text:'Drop your projects'},{timestamp:'2026-09-01'},{is_quote_post:true},{is_reply:true},{username:'promptcove'},{is_reply:undefined},{timestamp:'bad'},{permalink:'bad'}]) assert.equal(matches({...post,...change},config,now),false,JSON.stringify(change));
});
test('duplicate guard catches IDs, reservations and URL host variants',()=>{
  assert.equal(alreadyLogged(post,[{postId:'123',state:'reserved'}]),true);
  assert.equal(alreadyLogged(post,[{postUrl:'https://www.threads.net/@builder/post/abc'}]),true);
  const seed=JSON.parse(readFileSync(new URL('./log.json',import.meta.url)));
  assert.equal(alreadyLogged({...post,permalink:'https://www.threads.net/@aayla.shah/post/DeACiwHIGr-'},seed.entries),true);
});
test('daily limit uses New York date around midnight',()=>assert.equal(day(new Date('2026-10-04T02:00:00Z')),'2026-10-03'));
