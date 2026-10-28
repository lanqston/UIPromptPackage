import test from 'node:test';
import assert from 'node:assert/strict';
import { makeCardInteractionHandler, listPendingComments, moderateComment } from '../server/card-interactions.mjs';

const origin='https://digivated.com';
function fixtureRedis(){
 const values=new Map(), sorted=new Map();
 const members=key=>sorted.get(key)||new Map();
 const redis=async ([command,...args])=>{
  if(command==='GET')return values.get(args[0])??null;
  if(command==='SET'){values.set(args[0],args[1]);return 'OK';}
  if(command==='MGET')return args.map(key=>values.get(key)??null);
  if(command==='ZCARD')return members(args[0]).size;
  if(command==='ZREVRANGE')return [...members(args[0])].sort((a,b)=>b[1]-a[1]).slice(Number(args[1]),Number(args[2])+1).map(([id])=>id);
  if(command==='EVAL'){
   const [script,n,...rest]=args,keys=rest.slice(0,Number(n)),argv=rest.slice(Number(n));
   if(script.includes("ARGV[1]=='like'")){let count=Number(values.get(keys[1])||0),liked=values.has(keys[0]);if(argv[0]==='like'&&!liked){values.set(keys[0],'1');count++;values.set(keys[1],String(count));liked=true;}else if(argv[0]==='unlike'&&liked){values.delete(keys[0]);count=Math.max(0,count-1);values.set(keys[1],String(count));liked=false;}return [count,liked?1:0];}
   if(script.includes('comment-limit')){throw Error('unexpected script');}
   if(script.includes('local n=redis.call')){const count=Number(values.get(keys[0])||0)+1;values.set(keys[0],String(count));if(count>3)return 0;values.set(keys[1],argv[0]);const set=members(keys[2]);set.set(argv[2],Number(argv[1]));sorted.set(keys[2],set);if(argv[3]==='approved'){const publicSet=members(keys[3]);publicSet.set(argv[2],Number(argv[1]));sorted.set(keys[3],publicSet);}return 1;}
   const record=JSON.parse(values.get(keys[0]));if(record.status!=='pending'&&!(record.status==='approved'&&record.purpose==='project-feedback'&&argv[0]==='rejected'))return 0;record.status=argv[0];values.set(keys[0],JSON.stringify(record));const set=members(keys[1]);if(argv[0]==='approved')set.set(record.id,Number(argv[1]));else set.delete(record.id);sorted.set(keys[1],set);return 1;
  }
  throw Error(`Unexpected Redis command ${command}`);
 };
 return {redis,values,sorted};
}
async function call(handler,method,id,body,headers={},type='project'){
 let data;const res={statusCode:200,setHeader(){},end(value){data=JSON.parse(value);}};
 await handler({url:`/api/card-interactions?type=${type}&id=${id}`,method,headers:{origin,'content-type':'application/json','x-real-ip':'192.0.2.10','user-agent':'Mozilla/5.0',...headers},body:method==='POST'?{type,id,...body}:undefined},res);
 return {status:res.statusCode,data};
}
test('project interactions require a published project and moderate comments without changing its record',async()=>{
 const {redis,values}=fixtureRedis(),handler=makeCardInteractionHandler({redis,env:{SUBMISSIONS_ORIGIN:origin}});
 assert.equal((await call(handler,'GET','project-one')).status,404);
 const project={id:'project-one',name:'Original',status:'approved',consent:true,image:'original-image',views:52};
 const record=JSON.stringify(project);values.set('digivated:submission:project-one',record);
 assert.deepEqual((await call(handler,'GET','project-one')).data,{likes:0,comments:[],commentCount:0});
 assert.deepEqual((await call(handler,'POST','project-one',{action:'like'})).data,{liked:true,likes:1});
 assert.deepEqual((await call(handler,'POST','project-one',{action:'like'})).data,{liked:true,likes:1});
 assert.deepEqual((await call(handler,'POST','project-one',{action:'unlike'})).data,{liked:false,likes:0});
 assert.deepEqual((await call(handler,'POST','project-one',{action:'unlike'})).data,{liked:false,likes:0});
 assert.deepEqual((await call(handler,'POST','project-one',{action:'like'})).data,{liked:true,likes:1});
 assert.equal((await call(handler,'POST','project-one',{action:'comment',name:'Sam',comment:'A thoughtful idea'})).status,201);
 assert.equal((await call(handler,'GET','project-one')).data.commentCount,0);
 const pending=(await listPendingComments(redis)).items;
 assert.equal(pending.length,1);assert.equal(pending[0].status,'pending');
 assert.equal(await moderateComment(redis,pending[0].id,'approved'),1);
 assert.equal((await call(handler,'GET','project-one')).data.comments[0].body,'A thoughtful idea');
 assert.equal(values.get('digivated:submission:project-one'),record);
 values.set('digivated:submission:project-one',JSON.stringify({...project,status:'archived'}));
 assert.equal((await call(handler,'GET','project-one')).status,404);
 assert.equal((await call(handler,'POST','project-one',{action:'like'})).status,404);
});
test('cross-site writes and invalid requests fail before any interaction is stored',async()=>{
 const {redis,values}=fixtureRedis(),handler=makeCardInteractionHandler({redis,env:{SUBMISSIONS_ORIGIN:origin}});
 values.set('digivated:submission:project-one',JSON.stringify({id:'project-one',status:'approved',consent:true}));
 assert.equal((await call(handler,'POST','project-one',{action:'comment',comment:'Hello'}, {origin:'https://other.test'})).status,403);
 assert.equal((await call(handler,'POST','project-one',{action:'comment',comment:'Hi'})).status,400);
 assert.equal((await call(handler,'POST','../private',{action:'like'})).status,404);
 assert.equal((await call(handler,'GET','project-one')).data.likes,0);
});
test('project feedback appears immediately and cannot be sent to resources',async()=>{
 const {redis,values}=fixtureRedis(),handler=makeCardInteractionHandler({redis,env:{SUBMISSIONS_ORIGIN:origin}});
 values.set('digivated:submission:project-one',JSON.stringify({id:'project-one',status:'approved',consent:true}));
 const sent=await call(handler,'POST','project-one',{action:'project-feedback',name:'Visitor',comment:'The onboarding is clear; a pricing example would help.'});
 assert.equal(sent.status,201);assert.match(sent.data.message,/now visible/);
 const publicResult=(await call(handler,'GET','project-one')).data;
 assert.equal(publicResult.commentCount,1);
 assert.equal(publicResult.comments[0].body,'The onboarding is clear; a pricing example would help.');
 const entry=(await listPendingComments(redis)).items[0];assert.equal(JSON.parse(values.get(`digivated:card:comment:${entry.id}`)).purpose,'project-feedback');
 assert.equal(entry.status,'approved');
 assert.equal(await moderateComment(redis,entry.id,'approved'),0);
 assert.equal(await moderateComment(redis,entry.id,'rejected'),1);
 assert.equal((await call(handler,'GET','project-one')).data.commentCount,0);
 assert.deepEqual((await call(handler,'GET','project-one')).data.comments,[]);
 assert.equal((await call(handler,'POST','builtin-ui-ux-prompt-packet',{action:'project-feedback',comment:'A useful note'},{},'resource')).status,400);
});

test('private packet feedback cannot be published and never appears in public responses',async()=>{
 const {redis,values,sorted}=fixtureRedis(),handler=makeCardInteractionHandler({redis,env:{SUBMISSIONS_ORIGIN:origin}}),id='builtin-ui-ux-prompt-packet';
 const response=await call(handler,'POST',id,{action:'feedback',comment:'Tried a form review. The request label became clearer.',quoteConsent:false},{},'resource');
 assert.equal(response.status,201);assert.match(response.data.message,/privately/);
 const entry=(await listPendingComments(redis)).items[0];
 assert.equal(entry.purpose,'packet-feedback');assert.equal(entry.quoteConsent,false);
 assert.equal(await moderateComment(redis,entry.id,'approved'),-3);
 assert.deepEqual((await call(handler,'GET',id,undefined,{},'resource')).data.comments,[]);
 // Fail closed even if an old or manual storage edit marks private feedback approved.
 const key=`digivated:card:comment:${entry.id}`;values.set(key,JSON.stringify({...entry,status:'approved'}));
 sorted.set(`digivated:card:comments:resource:${id}`,new Map([[entry.id,Date.now()]]));
 assert.deepEqual((await call(handler,'GET',id,undefined,{},'resource')).data.comments,[]);
});

test('consented trial feedback becomes a quote only after owner approval',async()=>{
 const {redis}=fixtureRedis(),handler=makeCardInteractionHandler({redis,env:{SUBMISSIONS_ORIGIN:origin}}),id='builtin-ui-ux-prompt-packet';
 assert.equal((await call(handler,'POST',id,{action:'feedback',name:'Test fixture',comment:'Fixture feedback for the permission test.',quoteConsent:true},{},'resource')).status,201);
 assert.deepEqual((await call(handler,'GET',id,undefined,{},'resource')).data.comments,[]);
 const entry=(await listPendingComments(redis)).items[0];assert.equal(entry.quoteConsent,true);
 assert.equal(await moderateComment(redis,entry.id,'approved'),1);
 const quote=(await call(handler,'GET',id,undefined,{},'resource')).data.comments[0];
 assert.equal(quote.quote,true);assert.equal(quote.name,'Test fixture');
});

test('feedback requires explicit boolean permission and the correct product',async()=>{
 const {redis}=fixtureRedis(),handler=makeCardInteractionHandler({redis,env:{SUBMISSIONS_ORIGIN:origin}}),id='builtin-ui-ux-prompt-packet';
 for(const quoteConsent of [undefined,'true',1])assert.equal((await call(handler,'POST',id,{action:'feedback',comment:'A useful test comment.',quoteConsent},{},'resource')).status,400);
 assert.equal((await call(handler,'POST','make-sense-of-new-tech',{action:'feedback',comment:'A useful test comment.',quoteConsent:true},{},'resource')).status,404);
 assert.equal((await listPendingComments(redis)).items.length,0);
});
