import test from 'node:test';
import assert from 'node:assert/strict';
import { imageBytes, memberConfig, makeMemberCommunityHandler } from '../server/member-community.mjs';
import { projectPublic, validateEdit } from '../server/admin-store.mjs';
test('community config exposes only validated public configuration',()=>{
 assert.equal(memberConfig({}),null);
 assert.equal(memberConfig({COMMUNITY_SUPABASE_URL:'http://example.com',COMMUNITY_SUPABASE_PUBLISHABLE_KEY:'public'}),null);
 const cfg=memberConfig({COMMUNITY_SUPABASE_URL:'https://example.supabase.co',COMMUNITY_SUPABASE_PUBLISHABLE_KEY:'public',COMMUNITY_SUPABASE_SECRET_KEY:'never-output'});
 assert.equal(cfg.key,'public');assert.ok(!JSON.stringify(cfg).includes('never-output'));
});
test('uploads reject disguised files and oversized payloads',()=>{
 assert.throws(()=>imageBytes('data:image/png;base64,'+Buffer.from('<script>bad</script>').toString('base64')));
 const large=Buffer.alloc(2097153);large.set([137,80,78,71,13,10,26,10]);
 assert.throws(()=>imageBytes('data:image/png;base64,'+large.toString('base64')));
 assert.throws(()=>imageBytes('data:image/svg+xml;base64,PHN2Zz4='));
});
test('original picks use verified IDs, preserve images, and respect owner removal',()=>{
 const record={id:'03e617c5-4841-43d1-8096-5fe4a556d053',name:'AppAtlas',creator:'Lloyd',description:'An original approved project with its unchanged data.',category:'Other',consent:true,status:'approved',pick:false,url:'https://www.appatlas.world/',image:'original',revision:0};
 assert.equal(projectPublic(record).pick,true);
 assert.equal(projectPublic(record).image,`/api/projects?image=${record.id}`);
 const edited=validateEdit('submission',{...record,image:undefined,pick:false},record);
 assert.equal(projectPublic(edited).pick,false);
 assert.equal(edited.image,'original');
 assert.equal(projectPublic({...record,status:'pending'}),null);
 assert.equal(projectPublic({...record,id:'different'}).pick,false);
});
test('missing community secret fails closed for uploads and owner moderation',async()=>{
 for(const action of ['upload','moderation']){
 let output;const res={setHeader(){},end(v){output=JSON.parse(v);}};
 await makeMemberCommunityHandler({env:{}})({url:`/?action=${action}`,method:'POST',headers:{}},res);
 assert.equal(res.statusCode,503);assert.ok(output.error);
 }
});
