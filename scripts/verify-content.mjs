import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createDecipheriv} from 'node:crypto';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const catalog=read('src/data/catalog.json'),demo=read('src/data/demo.json');
assert.equal(catalog.prompts.length,75);assert.equal(catalog.workflows.length,8);assert.equal(catalog.checklists.length,8);
assert.deepEqual(demo.prompts.map(p=>p.id),[1,14,46]);
const bundle=read('server/edition.enc.json'),key=Buffer.from(readFileSync('.private/owner-key.txt','utf8').trim(),'hex');
const decode=(k)=>{const encrypted=Buffer.from(bundle.data,'base64'),decipher=createDecipheriv('aes-256-gcm',k,Buffer.from(bundle.iv,'base64'));decipher.setAuthTag(encrypted.subarray(-16));return JSON.parse(Buffer.concat([decipher.update(encrypted.subarray(0,-16)),decipher.final()]));};
const full=decode(key);assert.equal(full.prompts.length,75);assert.equal(full.workflows.length,8);assert.equal(full.checklists.length,8);assert.throws(()=>decode(Buffer.alloc(32)));
const walk=p=>readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${p}/${e.name}`):[`${p}/${e.name}`]);
assert(!walk('dist').some(p=>p.endsWith('edition.enc.json')), 'Encrypted edition must not be publicly served');
const publicFiles=walk('dist').map(p=>readFileSync(p,'utf8')).join('\n');
assert(!publicFiles.includes(key.toString('hex')),'Edition key leaked into output');
for(const p of full.prompts){assert(p.prompt.length>300);if(!demo.prompts.some(d=>d.id===p.id)){assert(!publicFiles.includes(p.prompt),'Paid prompt leaked into output');assert(!publicFiles.includes(JSON.stringify(p.prompt).slice(1,-1)),'Encoded paid prompt leaked into output');}}
for(const w of full.workflows)assert(w.steps.every(id=>full.prompts.some(p=>p.id===id)));
console.log('PASS: complete content, correct demo, successful authenticated decryption, invalid key rejected, and no paid prompt or key in public output.');
