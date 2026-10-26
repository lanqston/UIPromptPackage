// Isolated from purchase handlers, sessions, rate-limit rules, and environment names.
// founding-access imports redisClient from this module. The membership helpers are
// used only inside request handlers, after both modules have finished loading.
import { randomUUID, createHmac } from 'node:crypto';
import { projectCategories, safeUrl } from '../src/data/community.mjs';
import { FoundingError, foundingConfig, readMember } from './founding-access.mjs';
import { accountIndex, verifiedAccount } from './project-account.mjs';
export class SubmissionError extends Error { constructor(status,message) { super(message); this.status=status; } }
export function validateSubmission(body) {
  const fail = message => {throw new SubmissionError(400,message);};
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Please use the project submission form.');
  if (body.company) fail('Please use the project submission form.');
  const text = (key,max,required=true) => {const value=body[key];if(value===undefined&&!required)return '';if(typeof value!=='string'||value.trim().length>max||(required&&!value.trim()))fail(`Please check ${key}.`);return value.trim();};
  const creator=text('creator',100), email=text('email',254), name=text('name',120), url=text('url',500), description=text('description',600), category=text('category',40), social=text('social',200,false), notes=text('notes',2000,false);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Enter a valid email address.');
  if (!safeUrl(url)) fail('Enter a valid HTTP or HTTPS project URL.');
  if (description.length<20) fail('Describe your project in at least 20 characters.');
  if (!projectCategories.includes(category)) fail('Choose a listed category.');
  if (body.consent!==true) fail('Please confirm you have permission to submit this project.');
  const submissionType = body.submissionType || 'directory';
  if (!['directory','promotion','founding-feature'].includes(submissionType)) fail('Choose a valid submission type.');
  let promotion;
  if (submissionType === 'promotion') {
    if (body.promotionPurchased !== true) fail('Purchase the Digivated promo on Gumroad before submitting a promotion request.');
    promotion = { requested:true, receiptReference:text('promotionReceipt',120), verified:false };
  } else if (submissionType === 'founding-feature') {
    // The handler replaces this after checking the founding session. Callers cannot mark it paid or verified.
    promotion = { requested:true, included:'founding-membership', verified:false };
  }
  if (!body.image) fail('Add at least one project image.');
  let image='';
  if (body.image) {
    if (typeof body.image!=='string') fail('Invalid image.');
    const match=body.image.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!match) fail('Choose a JPG, PNG, or WebP image.');
    const bytes=Buffer.from(match[2],'base64');
    const valid=match[1]==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):match[1]==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
    if (!valid||bytes.length>500*1024||bytes.length<12) fail('Use a valid JPG, PNG, or WebP image up to 500 KB.');
    image=body.image;
  }
  // Never accept caller-supplied status, ID, approval, picks, or timestamps.
  return {...(promotion ? {promotion} : {}),creator,email,name,url:safeUrl(url),description,category,social,notes,image,consent:true,consentVersion:1,emailOutreachConsent:body.emailOutreachConsent===true,status:'pending',pick:false};
}
export function redisClient(env=process.env,fetcher=fetch) {
  const endpoint=env.SUBMISSIONS_REDIS_REST_URL, token=env.SUBMISSIONS_REDIS_REST_TOKEN;
  let url;try {url=new URL(endpoint);}catch{throw new SubmissionError(503,'Submissions are not open yet. Please check back soon.');}
  if(url.protocol!=='https:'||!token)throw new SubmissionError(503,'Submissions are not open yet. Please check back soon.');
  return async command=>{const response=await fetcher(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(8000),redirect:'error'});if(!response.ok)throw new Error('Storage unavailable');const result=await response.json();if(result.error)throw new Error('Storage unavailable');return result.result;};
}
const SAVE = `local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],3600) end; if n>5 then return 0 end; redis.call('SET',KEYS[2],ARGV[1]); redis.call('ZADD',KEYS[3],ARGV[2],ARGV[3]); redis.call('ZADD',KEYS[4],ARGV[2],ARGV[3]); return 1`;
const SAVE_MEMBER_FEATURE = `local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],3600) end; if n>5 then return 0 end; if redis.call('SET',KEYS[4],ARGV[3],'NX') then redis.call('SET',KEYS[2],ARGV[1]); redis.call('ZADD',KEYS[3],ARGV[2],ARGV[3]); redis.call('ZADD',KEYS[5],ARGV[2],ARGV[3]); return 1 end; return -1`;
const MEMBER_FEATURE_MESSAGE = 'Sign in with your Founding Membership before using the included feature.';
const MEMBER_FEATURE_USED = 'This membership already includes one featured submission. It stays in review, and a feature is not guaranteed.';

async function memberFeature(req, env, deps) {
  const cfg = foundingConfig(env);
  if (!cfg.enabled) throw new SubmissionError(401, MEMBER_FEATURE_MESSAGE);
  let member;
  try { member = await readMember(req, cfg, deps.fetcher || fetch); }
  catch (error) {
    if (error instanceof FoundingError && error.status === 401) member = null;
    else throw new SubmissionError(503, 'We couldn’t check your Founding Membership right now. Please try again shortly.');
  }
  if (!member?.saleId || !/^[A-Za-z0-9+=/_-]{8,200}$/.test(member.saleId) || member.saleId.includes('..')) throw new SubmissionError(401, MEMBER_FEATURE_MESSAGE);
  return { requested:true, included:'founding-membership', verified:false, memberSaleId:member.saleId, receiptReference:'founding-membership' };
}
export function makeSubmissionHandler(deps={}) {
  return async(req,res)=>{
    res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    const send=(status,data)=>{res.statusCode=status;res.end(JSON.stringify(data));};
    try {
      if(req.method!=='POST'){res.setHeader('Allow','POST');throw new SubmissionError(405,'Use the project submission form.');}
      const env=deps.env||process.env;
      const origin=env.SUBMISSIONS_ORIGIN||'https://digivated.com';
      if(req.headers.origin!==origin||req.headers['sec-fetch-site']==='cross-site')throw new SubmissionError(403,'Open the submission form on Digivated and try again.');
      if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw new SubmissionError(415,'Use the project submission form.');
      const max=710000;
      if(Number(req.headers['content-length']||0)>max)throw new SubmissionError(413,'The submission is too large.');
      let body=req.body;
      if(body===undefined){let size=0;const chunks=[];for await(const chunk of req){size+=Buffer.byteLength(chunk);if(size>max)throw new SubmissionError(413,'The submission is too large.');chunks.push(Buffer.from(chunk));}body=Buffer.concat(chunks).toString('utf8');}
      if(Buffer.isBuffer(body))body=body.toString('utf8');
      if(typeof body==='string'){if(Buffer.byteLength(body)>max)throw new SubmissionError(413,'The submission is too large.');try{body=JSON.parse(body);}catch{throw new SubmissionError(400,'Invalid submission.');}}
      if(Buffer.byteLength(JSON.stringify(body)||'')>max)throw new SubmissionError(413,'The submission is too large.');
      let record=validateSubmission(body);
      const account=req.headers.authorization?await (deps.verifyAccount||verifiedAccount)(req,env,deps.fetcher||fetch):null;
      if(!account)throw new SubmissionError(401,'Create an account or sign in before submitting your project.');
      if(account&&record.email.toLowerCase()!==account.email)throw new SubmissionError(403,'Use the same email as your verified account.');
      if (record.promotion?.included === 'founding-membership') record = { ...record, promotion: await memberFeature(req, env, deps) };
      const redis=deps.redis||redisClient(env);
      const ip=req.headers['x-real-ip'];
      if(!deps.redis && (env.VERCEL!=='1'||typeof ip!=='string'||!ip))throw new SubmissionError(503,'Submissions are temporarily unavailable. Please try again later.');
      const hash=createHmac('sha256',env.SUBMISSIONS_REDIS_REST_TOKEN||'test-only').update(String(ip||'fixture')).digest('hex');
      const id=randomUUID();const now=new Date();
      const stored={...record,...(account?{accountId:account.id}:{}),id,date:now.toISOString(),consentedAt:now.toISOString(),...(record.emailOutreachConsent?{emailOutreachConsentedAt:now.toISOString(),emailOutreachConsentVersion:2}:{})};
      const accountKey=accountIndex(record.email,env.SUBMISSIONS_REDIS_REST_TOKEN||'test-only');
      const saved=record.promotion?.included==='founding-membership'
        ? await redis(['EVAL',SAVE_MEMBER_FEATURE,5,`digivated:limit:${hash}`,`digivated:submission:${id}`,'digivated:submissions',`digivated:founding-feature:${record.promotion.memberSaleId}`,accountKey,JSON.stringify(stored),now.getTime(),id])
        : await redis(['EVAL',SAVE,4,`digivated:limit:${hash}`,`digivated:submission:${id}`,'digivated:submissions',accountKey,JSON.stringify(stored),now.getTime(),id]);
      if(saved===-1)throw new SubmissionError(409,MEMBER_FEATURE_USED);
      if(saved!==1){res.setHeader('Retry-After','3600');throw new SubmissionError(429,'You’ve reached the submission limit. Please try again in an hour.');}
      send(201,{ok:true,id,status:'pending'});
    }catch(error){send(error instanceof SubmissionError?error.status:503,{error:error instanceof SubmissionError?error.message:'Submissions are temporarily unavailable. Your details have not been cleared; please try again later.'});}
  };
}
