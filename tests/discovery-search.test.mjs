import test from 'node:test';
import assert from 'node:assert/strict';
import {rankDiscovery,safeSearchHref} from '../src/lib/discovery-search.mjs';
const records=[
 {type:'resource',title:'Read market claims clearly',description:'Evidence and investing',category:'Markets',href:'/resources/market-claims'},
 {type:'project',title:'Arvow',description:'AI agents for SEO and search',category:'AI',href:'/discover#project-arvow'},
 {type:'resource',title:'AI with better judgment',description:'Review AI results',category:'Technology & AI',href:'/resources/ai'},
];
test('unified search ranks title matches above incidental descriptions and combines query terms',()=>{
 assert.equal(rankDiscovery(records,'AI')[0].title,'AI with better judgment');
 assert.equal(rankDiscovery(records,'agents AI')[0].title,'Arvow');
 assert.equal(rankDiscovery(records,'unknown').length,0);
});
test('scope switches preserve the query and limit without leaking other content types',()=>{
 assert.deepEqual(rankDiscovery(records,'AI','project').map(r=>r.title),['Arvow']);
 assert.equal(rankDiscovery(records,'','resource',1).length,1);
 assert.equal(rankDiscovery(records,'','all').length,3);
});
test('destinations reject executable URLs, credentials, protocol-relative URLs and control-character bypasses',()=>{
 for(const value of ['javascript:alert(1)','data:text/html,test','//evil.example','/\n/evil.example','/\\evil.example','https://user:pass@example.com'])assert.equal(safeSearchHref(value),'',value);
 assert.equal(safeSearchHref('/discover#project-one'),'/discover#project-one');
 assert.equal(safeSearchHref('https://example.com'),'https://example.com/');
 assert.equal(rankDiscovery([{...records[0],href:'javascript:alert(1)'}],'').length,0);
});
