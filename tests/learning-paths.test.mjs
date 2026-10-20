import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {learningPaths,resourcePathInfo} from '../src/data/learning-paths.mjs';
import {rankDiscovery} from '../src/lib/discovery-search.mjs';
const resources=JSON.parse(readFileSync(new URL('../docs/archive/resources-2026-10-20.json',import.meta.url),'utf8')).filter(r=>r.status==='published');
test('every published guide belongs to one complete, nonduplicated learning sequence',()=>{
 const assigned=learningPaths.flatMap(p=>p.slugs);
 assert.equal(new Set(assigned).size,assigned.length);
 assert.deepEqual([...assigned].sort(),resources.map(r=>r.slug).sort());
 for(const r of resources){const info=resourcePathInfo(r);assert.ok(info.path);assert.ok(info.step>=1);assert.equal(info.total,info.path.slugs.length);}
});
test('next-guide links finish each path without cycles or leaving that path',()=>{
 for(const path of learningPaths){let slug=path.slugs[0];const seen=[];while(slug){assert.ok(!seen.includes(slug));seen.push(slug);slug=resourcePathInfo(resources.find(r=>r.slug===slug)).next;}assert.deepEqual(seen,path.slugs);}
});
test('additional API guides retain category filtering and optional toolkit follows the free guides',()=>{
 const extra={id:'extra',url:'https://example.com/guide',category:'Markets & Investing'};
 assert.equal(resourcePathInfo(extra).path.id,'markets');assert.equal(resourcePathInfo(extra).step,null);
 assert.equal(resourcePathInfo({id:'unknown',category:'Other'}).path,undefined);
 const paid=resourcePathInfo({id:'builtin-ui-ux-prompt-packet',category:'Design & UX',packet:true});
 assert.ok(resources.every(r=>resourcePathInfo(r).order<paid.order));
 assert.equal(resourcePathInfo({url:'/resources/tech-career-starter-linkbook?from=saved',category:'Technology & AI'}).path.id,'it-skills');
});
test('beginner search terms find career and game guides without changing their titles',()=>{
 const records=resources.map(r=>({type:'resource',title:r.title,description:r.description,category:r.category,keywords:resourcePathInfo(r).keywords,href:`/resources/${r.slug}`}));
 assert.ok(rankDiscovery(records,'certifications')[0].href.endsWith('/tech-career-starter-linkbook'));
 assert.ok(!rankDiscovery(records,'certifications').some(r=>r.href.endsWith('/a-gentle-security-reset-for-your-accounts')));
 assert.ok(rankDiscovery(records,'Roblox').some(r=>r.href.endsWith('/build-a-small-game-you-can-finish')));
});
