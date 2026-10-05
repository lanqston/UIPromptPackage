// Owner-only local CLI. Never deployed as a public administration endpoint.
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { redisClient } from '../server/submissions.mjs';
import { publicRecord } from '../server/community-publication.mjs';
import { statuses, safeUrl } from '../src/data/community.mjs';
const [command,id,value]=process.argv.slice(2);
const usage='Commands: list | inspect ID | status ID pending|approved|featured|rejected|archived | pick ID true|false | social ID https://... | export';
if(!['list','inspect','status','pick','social','export'].includes(command))throw new Error(usage);
const redis=redisClient();
const get=async id=>{if(!/^[a-f0-9-]{36}$/.test(id||''))throw new Error('Invalid ID');const raw=await redis(['GET',`digivated:submission:${id}`]);if(!raw)throw new Error('Submission not found');return JSON.parse(raw);};
const put=record=>redis(['SET',`digivated:submission:${record.id}`,JSON.stringify(record)]);
const ids=()=>redis(['ZREVRANGE','digivated:submissions',0,-1]);
if(command==='list'){
  for(const id of await ids()){const r=await get(id);console.log(JSON.stringify({id:r.id,status:r.status,name:r.name,creator:r.creator,date:r.date}));}
}else if(command==='inspect'){
  const r=await get(id);console.log(JSON.stringify({...r,image:r.image?'[Image saved to private preview file]':''},null,2));
  if(r.image){await mkdir('.private/submissions',{recursive:true});const ext=r.image.startsWith('data:image/png;')?'png':r.image.startsWith('data:image/jpeg;')?'jpg':'webp';await writeFile(`.private/submissions/${id}.${ext}`,Buffer.from(r.image.split(',')[1],'base64'),{mode:0o600});}
}else if(command==='export'){
  const catalog=[];await mkdir('public/community',{recursive:true});
  for(const id of await ids()){
    const r=await get(id);const item=publicRecord(r);if(!item)continue;
    if(r.image)await writeFile(`public${item.image}`,Buffer.from(r.image.split(',')[1],'base64'));
    catalog.push(item);
  }
  // Remove previously published images when a project is withdrawn.
  const old=JSON.parse(await readFile('src/data/projects.json','utf8'));
  const {unlink}=await import('node:fs/promises');
  const retained=new Set(catalog.map(r=>r.image));
  for(const r of old)if(/^\/community\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(r.image||'')&&!retained.has(r.image))await unlink(`public${r.image}`).catch(e=>{if(e.code!=='ENOENT')throw e;});
  await writeFile('src/data/projects.json.tmp',JSON.stringify(catalog,null,2)+'\n');await rename('src/data/projects.json.tmp','src/data/projects.json');
  console.log(`Exported ${catalog.length} reviewed projects. Review the diff, build, then deploy through the existing Vercel workflow.`);
}else{
  const r=await get(id);
  if(command==='status'){
    if(!statuses.includes(value))throw new Error(usage);
    if(value==='featured'){
      if(!['approved','featured'].includes(r.status))throw new Error('Approve and review this project before featuring it.');
      for(const otherId of await ids()){if(otherId===id)continue;const other=await get(otherId);if(other.status==='featured'){other.status='approved';await put(other);}}
    }
    r.status=value;
    if(!['approved','featured'].includes(value))r.pick=false;
  }else if(command==='pick'){
    if(!['true','false'].includes(value)||!['approved','featured'].includes(r.status))throw new Error('Picks must be approved projects; use true or false.');
    r.pick=value==='true';
  }else{
    if(!safeUrl(value))throw new Error('Provide a full HTTP or HTTPS creator profile URL.');
    r.socialUrl=safeUrl(value);
  }
  r.reviewedAt=new Date().toISOString();await put(r);console.log('Review saved privately. Run export, review, build and deploy to update public pages.');
}
