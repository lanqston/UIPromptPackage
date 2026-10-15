import { createHmac, randomUUID } from 'node:crypto';
import resources from '../src/data/resources.json' with { type: 'json' };
import { redisClient } from './submissions.mjs';
import { validId, storageKey, projectPublic, contentPublic } from './admin-store.mjs';

const builtinResources = new Set(['builtin-ui-ux-prompt-packet', ...resources.filter(item => item.status === 'published').map(item => item.slug)]);
const itemKey = (type,id) => `${type}:${id}`;
const likeKey = (type,id) => `digivated:card:likes:${itemKey(type,id)}`;
const commentIndex = (type,id) => `digivated:card:comments:${itemKey(type,id)}`;
export const commentKey = id => `digivated:card:comment:${id}`;
const LIKE = `local liked=redis.call('GET',KEYS[1]); local count=tonumber(redis.call('GET',KEYS[2]) or '0'); if ARGV[1]=='like' then if liked then return {count,1} end; redis.call('SET',KEYS[1],'1','EX',2592000); return {redis.call('INCR',KEYS[2]),1} end; if ARGV[1]=='unlike' then if liked then redis.call('DEL',KEYS[1]); if count>0 then count=redis.call('DECR',KEYS[2]) end end; return {count,0} end; return {-1,0}`;
const COMMENT = `local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],86400) end; if n>3 then return 0 end; redis.call('SET',KEYS[2],ARGV[1]); redis.call('ZADD',KEYS[3],ARGV[2],ARGV[3]); return 1`;
const MODERATE = `local raw=redis.call('GET',KEYS[1]); if not raw then return -1 end; local entry=cjson.decode(raw); if entry.status~='pending' then return 0 end; entry.status=ARGV[1]; redis.call('SET',KEYS[1],cjson.encode(entry)); if ARGV[1]=='approved' then redis.call('ZADD',KEYS[2],ARGV[2],entry.id) else redis.call('ZREM',KEYS[2],entry.id) end; return 1`;

export async function isPublicItem(redis,type,id) {
  if (type === 'resource' && builtinResources.has(id)) return true;
  const kind=type === 'project' ? 'submission' : 'resource';
  const raw=await redis(['GET',storageKey(kind,id)]);
  const record=raw ? JSON.parse(raw) : null;
  return !!(record && (type === 'project' ? projectPublic(record) : contentPublic('resource',record)));
}
export async function listComments(redis,type,id) {
  const ids=await redis(['ZREVRANGE',commentIndex(type,id),0,29]);
  const raws=ids.length ? await redis(['MGET',...ids.map(commentKey)]) : [];
  return raws.filter(Boolean).map(raw=>JSON.parse(raw)).filter(entry=>entry.status==='approved').map(({name,body,date})=>({name,body,date}));
}
export async function listPendingComments(redis,offset=0) {
  const ids=await redis(['ZREVRANGE','digivated:card:comments:all',offset,offset+49]);
  const raws=ids.length ? await redis(['MGET',...ids.map(commentKey)]) : [];
  return {items:raws.filter(Boolean).map(raw=>JSON.parse(raw)).map(({id,type,itemId,name,body,date,status})=>({id,type,itemId,name,body,date,status})),next:ids.length===50?offset+50:null};
}
export async function moderateComment(redis,id,status) {
  if(!validId(id)||!['approved','rejected'].includes(status))return 0;
  const raw=await redis(['GET',commentKey(id)]);
  if(!raw)return -1;
  const entry=JSON.parse(raw);
  if(!await isPublicItem(redis,entry.type,entry.itemId) && status==='approved')return -2;
  return redis(['EVAL',MODERATE,2,commentKey(id),commentIndex(entry.type,entry.itemId),status,Date.parse(entry.date)]);
}

export function makeCardInteractionHandler(deps={}) {
  return async(req,res)=>{
    res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    const send=(status,body)=>{res.statusCode=status;res.end(JSON.stringify(body));};
    try {
      if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return send(405,{error:'Method not allowed.'});}
      const env=deps.env||process.env;
      const origin=env.SUBMISSIONS_ORIGIN||'https://digivated.com';
      if(req.method==='POST'&&(req.headers.origin!==origin||req.headers['sec-fetch-site']==='cross-site'))return send(403,{error:'Open this on Digivated to continue.'});
      const url=new URL(req.url,'https://digivated.invalid');
      if(url.pathname!=='/api/card-interactions')return send(404,{error:'Not found.'});
      let body={};
      if(req.method==='POST'){
        if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return send(415,{error:'Use the form on Digivated.'});
        if(Number(req.headers['content-length']||0)>2048)return send(413,{error:'This comment is too long.'});
        body=req.body;
        if(body===undefined){const chunks=[];let size=0;for await(const chunk of req){size+=Buffer.byteLength(chunk);if(size>2048)return send(413,{error:'This comment is too long.'});chunks.push(Buffer.from(chunk));}body=Buffer.concat(chunks).toString('utf8');}
        if(Buffer.isBuffer(body))body=body.toString('utf8');
        if(typeof body==='string')try{body=JSON.parse(body);}catch{return send(400,{error:'Check the form and try again.'});}
        if(!body||typeof body!=='object'||Array.isArray(body)||Buffer.byteLength(JSON.stringify(body))>2048)return send(400,{error:'Check the form and try again.'});
      }
      const type=req.method==='GET'?url.searchParams.get('type'):body.type;
      const id=req.method==='GET'?url.searchParams.get('id'):body.id;
      if(!['project','resource'].includes(type)||!validId(id))return send(404,{error:'This item is not available.'});
      if(!deps.redis&&(!env.SUBMISSIONS_REDIS_REST_URL||!env.SUBMISSIONS_REDIS_REST_TOKEN))return send(503,{error:'Comments are temporarily unavailable.'});
      const redis=deps.redis||redisClient(env);
      if(!await isPublicItem(redis,type,id))return send(404,{error:'This item is not available.'});
      if(req.method==='GET'){
        const [likes,comments,count]=await Promise.all([redis(['GET',likeKey(type,id)]),listComments(redis,type,id),redis(['ZCARD',commentIndex(type,id)])]);
        return send(200,{likes:Number(likes||0),comments,commentCount:Number(count||0)});
      }
      const ip=req.headers['x-real-ip'];
      if(!deps.redis&&(env.VERCEL!=='1'||typeof ip!=='string'||!ip))return send(503,{error:'This action is temporarily unavailable.'});
      if(/bot|crawler|spider|headless|preview/i.test(req.headers['user-agent']||''))return send(403,{error:'This action is unavailable.'});
      const visitor=createHmac('sha256',env.SUBMISSIONS_REDIS_REST_TOKEN||'test-only').update(`${type}:${id}:${ip||'fixture'}`).digest('hex');
      if(body.action==='like'||body.action==='unlike'){
        const [likes,liked]=await redis(['EVAL',LIKE,2,`digivated:card:liked:${visitor}`,likeKey(type,id),body.action]);
        return send(200,{liked:Boolean(Number(liked)),likes:Number(likes)});
      }
      if(body.action!=='comment')return send(400,{error:'Unknown action.'});
      if(body.company)return send(400,{error:'Check the form and try again.'});
      const name=typeof body.name==='string'?body.name.trim():'',comment=typeof body.comment==='string'?body.comment.trim():'';
      if(name.length>40||comment.length<4||comment.length>500)return send(400,{error:'Use up to 40 characters for your name and 4 to 500 for your comment.'});
      const entry={id:randomUUID(),type,itemId:id,name:name||'Guest',body:comment,date:new Date().toISOString(),status:'pending'};
      const saved=await redis(['EVAL',COMMENT,3,`digivated:card:comment-limit:${visitor}`,commentKey(entry.id),'digivated:card:comments:all',JSON.stringify(entry),Date.parse(entry.date),entry.id]);
      if(saved!==1){res.setHeader('Retry-After','86400');return send(429,{error:'You’ve reached today’s comment limit. Please try again tomorrow.'});}
      return send(201,{ok:true,message:'Thanks for sharing your thoughts. Your comment will appear after review.'});
    }catch{return send(503,{error:'This action is temporarily unavailable. Please try again later.'});}
  };
}
