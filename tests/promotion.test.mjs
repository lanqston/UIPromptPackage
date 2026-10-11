import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateSubmission} from '../server/submissions.mjs';
import {validateEdit,projectPublic} from '../server/admin-store.mjs';
import {launchPublic} from '../server/launch-pages.mjs';
import {publicRecord} from '../server/community-publication.mjs';
const input={creator:'Creator',email:'checkout@example.com',name:'Project',url:'https://example.com',description:'A useful independent project for testing.',category:'Apps',consent:true};
const promo={...input,submissionType:'promotion',promotionPurchased:true,promotionReceipt:'ORDER-TEST'};
test('promotion purchase claims remain private and cannot self-verify',()=>{
 const r=validateSubmission({...promo,status:'approved',promotionVerified:true,promotion:{verified:true}});
 assert.equal(r.status,'pending');assert.deepEqual(r.promotion,{requested:true,receiptReference:'ORDER-TEST',verified:false});
 for(const patch of [{promotionPurchased:false},{promotionReceipt:''},{promotionReceipt:'x'.repeat(121)},{submissionType:'invented'}])assert.throws(()=>validateSubmission({...promo,...patch}));
 assert.equal(validateSubmission(input).promotion,undefined);
});
test('admin must verify paid requests before publication; legacy free moderation remains intact',()=>{
 const previous={...validateSubmission(promo),id:'promo-fixture',revision:0,date:'2026-10-11'};
 const edit={...previous,status:'approved',socialUrl:''};
 assert.throws(()=>validateEdit('submission',edit,previous),e=>e.status===400&&e.message.includes('Verify'));
 const approved=validateEdit('submission',{...edit,promotionVerified:true},previous);
 assert.equal(approved.promotion.verified,true);assert.ok(approved.promotion.verifiedAt);
 assert.throws(()=>validateEdit('submission',{...approved,revision:approved.revision,promotionVerified:false},approved),e=>e.status===400);
 const withdrawn=validateEdit('submission',{...approved,revision:approved.revision,status:'archived',promotionVerified:false},approved);
 assert.equal(projectPublic(withdrawn),null);
 const free={...validateSubmission(input),id:'free-fixture',revision:0,date:'2026-10-11'};
 assert.equal(validateEdit('submission',{...free,status:'approved'},free).status,'approved');
});
test('public projections fail closed for unverified promotions and omit receipt data',()=>{
 const r={...validateSubmission(promo),id:'promo-fixture',date:'2026-10-11',status:'approved',pagePublished:true,slug:'promo-fixture',page:{consent:true,gallery:[]}};
 for(const project of [r,{...r,promotion:{...r.promotion,verified:true}}]){
  for(const projectPublicData of [projectPublic(project),publicRecord(project),launchPublic(project)]){
   if(!project.promotion.verified){assert.equal(projectPublicData,null);continue;}
   assert.equal(projectPublicData.sponsored,true);
   for(const privateValue of ['checkout@example.com','ORDER-TEST','receiptReference','verifiedAt'])assert.ok(!JSON.stringify(projectPublicData).includes(privateValue));
  }
 }
});
