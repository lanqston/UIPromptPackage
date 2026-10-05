import { randomBytes } from 'node:crypto';

export const SEARCH_QUERY = '("let\'s connect" OR "lets connect" OR "looking to connect" OR "more builders on my timeline") (builder OR developer OR designer OR SaaS OR "AI" OR Web3 OR cybersecurity OR blockchain OR "product management" OR "content creator" OR "digital products") -is:retweet -is:reply lang:en';
const nicheRules = [
  [/\b(UI|UX|UI\/UX)\b/i,'UI/UX'], [/product design/i,'Product Design'], [/front.?end/i,'Frontend Development'], [/back.?end/i,'Backend Development'],
  [/cybersecurity|infosec/i,'Cybersecurity'], [/blockchain/i,'Blockchain'], [/web3/i,'Web3'], [/\bAI\b|machine learning|\bML\b/i,'AI & Machine Learning'],
  [/product manag/i,'Product Management'], [/content creat/i,'Content Creation'], [/digital product/i,'Digital Products'], [/indie hack/i,'Indie Hackers'],
  [/indie build/i,'Indie Builders'], [/software|engineer|developer|dev tools/i,'Software Engineering'], [/builder|startup|SaaS/i,'Tech & Startup Builders']
];
const invitation = /\b(?:let[’']?s connect|looking to connect|more builders on my timeline)\b/i;
async function withX(env, redis, fetcher, task) {
  const key='digivated:private:x-publish:lock', lease=randomBytes(32).toString('hex');
  if(await redis(['SET',key,lease,'NX','EX',150])!=='OK') throw new Error('X connection busy');
  try {
    const { credentials } = await import('./x-publisher.mjs');
    const auth=await credentials(env,redis,fetcher);
    return await task(async path=>{
      const response=await fetcher('https://api.x.com'+path,{headers:{Authorization:'Bearer '+auth.accessToken},redirect:'error',signal:AbortSignal.timeout(15000)});
      if(!response.ok) throw new Error('X search HTTP '+response.status);
      return response.json();
    });
  } finally {
    await redis(['EVAL',"if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end; return 0",1,key,lease]);
  }
}
export function candidatesFromSearch(result) {
  const authors=new Map((result.includes?.users || []).map(u=>[u.id,u.username]));
  return (result.data || []).flatMap(p=>{
    const author=authors.get(p.author_id), match=p.text?.match(invitation), niche=nicheRules.find(([re])=>re.test(p.text || ''))?.[1];
    if(/giveaway|airdrop|follow.?back|follow for follow|like (?:and|&) (?:repost|retweet)/i.test(p.text || '')) return [];
    if(!author || !match || !niche || p.possibly_sensitive===true || author.toLowerCase()==='digivatedx')return [];
    return [{url:`https://x.com/${author}/status/${p.id}`,author,text:p.text,created_at:p.created_at,invitation_excerpt:match[0],niche}];
  });
}
export async function searchX(env,redis,fetcher=fetch) {
  return withX(env,redis,fetcher,async get=>{
    const query=new URLSearchParams({query:SEARCH_QUERY,max_results:'30','tweet.fields':'author_id,created_at,possibly_sensitive',expansions:'author_id','user.fields':'username',sort_order:'recency'});
    const candidates=candidatesFromSearch(await get('/2/tweets/search/recent?'+query));
    console.info(JSON.stringify({event:'x_direct_search',candidates:candidates.length}));
    return candidates;
  });
}
export async function verifyX(env,redis,candidates,fetcher=fetch) {
  return withX(env,redis,fetcher,async get=>{
    const ids=candidates.map(c=>c.url.split('/').pop()).join(',');
    const query=new URLSearchParams({ids,'tweet.fields':'author_id,created_at,possibly_sensitive',expansions:'author_id','user.fields':'username'});
    const actual=candidatesFromSearch(await get('/2/tweets?'+query));
    return candidates.map(c=>({url:c.url,verified:actual.some(a=>a.url===c.url&&a.text===c.text&&a.created_at===c.created_at)}));
  });
}
