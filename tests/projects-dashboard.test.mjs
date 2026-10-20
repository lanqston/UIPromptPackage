import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// A minimal event-driven DOM harness exercises the real directory script.
function setup(kind = 'projects', query = '') {
  const node = (dataset = {}, value = '') => ({dataset, value, hidden:false, textContent:'', attrs:{}, handlers:{}, options:[], setAttribute(k,v){this.attrs[k]=v;}, addEventListener(k,fn){this.handlers[k]=fn;}, fire(k){this.handlers[k]?.();}});
  const directory=node({directory:kind});
  const ids=Object.fromEntries(['search','category','view','sort','status','empty','heading'].map(id=>['directory-'+id,node()]));
  ids['directory-category'].options=[{value:''},{value:'AI'},{value:'SaaS'}];
  ids['directory-sort'].value=ids['directory-view'].value='newest';
  ids['directory-empty'].querySelector=()=>node();
  const cards=[
    node({search:'zebra ai maker',category:'AI',pick:'false',featured:'false',projectName:'Zebra',projectDate:'2026-10-16',projectViewsTotal:'0'}),
    node({search:'alpha saas maker',category:'SaaS',pick:'true',featured:'true',projectName:'Alpha',projectDate:'2026-10-01',projectViewsTotal:'63'}),
  ];
  for (const [index,card] of cards.entries()) Object.assign(card.dataset,{resourceName:card.dataset.projectName,resourceDate:card.dataset.projectDate,resourceReadingTime:String(index ? 2 : 4),learningGoal:index?'markets':'ai-tools',resourceOrder:String(index?1:2)});
  const clear=node();
  const list=node();list.order=[...cards];list.appendChild=card=>{list.order=list.order.filter(c=>c!==card);list.order.push(card);};
  const views=['newest','picks','featured'].map(value=>node({directoryView:value}));
  const layouts=['grid','list'].map(value=>node({directoryLayout:value}));
  const chips=['','AI','SaaS'].map(value=>node({categoryFilter:value}));
  const goals=['','ai-tools','markets'].map(value=>node({goalFilter:value}));
  const stats=Object.fromEntries(['total','picks','featured','categories'].map(key=>['data-project-'+key,node()]));
  const counts=['AI','SaaS'].map(value=>node({categoryCount:value}));
  const document=node();
  document.getElementById=id=>ids[id]||null;
  document.querySelector=selector=>selector==='[data-directory]'?directory:selector==='[data-directory-clear]'?clear:(selector==='[data-live-projects] [data-live-list]'||selector==='[data-live-resources] [data-live-list]')?list:null;
  document.querySelectorAll=selector=> {
    if(selector==='[data-project]'||selector==='[data-resource]')return cards;
    if(selector==='[data-directory-view]')return views;
    if(selector==='[data-directory-layout]')return layouts;
    if(selector==='[data-category-filter]')return chips;
    if(selector==='[data-goal-filter]')return kind==='resources'?goals:[];
    if(selector==='[data-category-count]')return counts;
    return stats[selector.slice(1,-1)]?[stats[selector.slice(1,-1)]]:[];
  };
  const location={href:`https://digivated.com/${kind==='resources'?'resources':'discover'}${query}`,search:query};
  const history={replaceState(_state,_title,url){location.href=url.href;location.search=url.search;}};
  runInNewContext(readFileSync('src/scripts/directory.js','utf8'),{document,location,history,URL,URLSearchParams});
  return {document,ids,cards,clear,list,views,layouts,chips,stats,counts,goals,location};
}
test('approved non-picks remain visible; collection/category filters and reset combine correctly',()=>{
  const h=setup();assert.equal(h.ids['directory-status'].textContent,'Loading projects…');
  h.document.fire('digivated:collection-updated');
  assert.deepEqual(h.cards.map(c=>c.hidden),[false,false]);
  assert.equal(h.stats['data-project-total'].textContent,'2');
  assert.equal(h.stats['data-project-categories'].textContent,'2');
  h.views[1].fire('click');assert.deepEqual(h.cards.map(c=>c.hidden),[true,false]);
  assert.equal(h.views[1].attrs['aria-pressed'],'true');
  h.chips[1].fire('click');assert.equal(h.ids['directory-status'].textContent,'0 projects found');
  assert.equal(h.clear.hidden,false);h.clear.fire('click');
  assert.deepEqual(h.cards.map(c=>c.hidden),[false,false]);assert.equal(h.clear.hidden,true);
});
test('sorts all cards by views, name, and date and switches list layout',()=>{
  const h=setup();h.document.fire('digivated:collection-updated');
  h.ids['directory-sort'].value='views';h.ids['directory-sort'].fire('change');assert.equal(h.list.order[0].dataset.projectName,'Alpha');
  h.ids['directory-sort'].value='name';h.ids['directory-sort'].fire('change');assert.equal(h.list.order[0].dataset.projectName,'Alpha');
  h.ids['directory-sort'].value='newest';h.ids['directory-sort'].fire('change');assert.equal(h.list.order[0].dataset.projectName,'Zebra');
  h.layouts[1].fire('click');assert.equal(h.list.dataset.layout,'list');assert.equal(h.layouts[1].attrs['aria-pressed'],'true');
  h.ids['directory-search'].value='zebra';h.ids['directory-search'].fire('input');assert.deepEqual(h.cards.map(c=>c.hidden),[false,true]);
});
test('resource directory retains search and category filtering',()=>{
  const h=setup('resources');h.ids['directory-search'].value='alpha';h.ids['directory-search'].fire('input');
  assert.equal(h.ids['directory-status'].textContent,'1 resource found');assert.deepEqual(h.cards.map(c=>c.hidden),[true,false]);
});

test('resources sort by reading time and title, reset topics, and switch layout',()=>{
  const h=setup('resources');
  h.ids['directory-sort'].value='quick';h.ids['directory-sort'].fire('change');
  assert.equal(h.list.order[0].dataset.resourceName,'Alpha');
  h.ids['directory-sort'].value='name';h.ids['directory-sort'].fire('change');
  assert.equal(h.list.order[0].dataset.resourceName,'Alpha');
  h.chips[1].fire('click');assert.equal(h.ids['directory-status'].textContent,'1 resource found');
  assert.equal(h.clear.hidden,false);h.clear.fire('click');assert.equal(h.clear.hidden,true);
  assert.equal(h.ids['directory-status'].textContent,'2 resources found');
  h.layouts[1].fire('click');assert.equal(h.list.dataset.layout,'list');
});

test('goal links load the right guides, category changes release the goal, and reset clears the URL',()=>{
 const h=setup('resources','?path=markets');
 assert.deepEqual(h.cards.map(c=>c.hidden),[true,false]);
 assert.equal(h.goals[2].attrs['aria-pressed'],'true');
 h.ids['directory-category'].value='AI';h.ids['directory-category'].fire('change');
 assert.deepEqual(h.cards.map(c=>c.hidden),[false,true]);
 assert.equal(h.goals[0].attrs['aria-pressed'],'true');
 assert.equal(new URL(h.location.href).searchParams.get('path'),null);
 h.goals[2].fire('click');assert.equal(h.ids['directory-category'].value,'');
 assert.deepEqual(h.cards.map(c=>c.hidden),[true,false]);
 assert.equal(new URL(h.location.href).searchParams.get('path'),'markets');
 h.ids['directory-search'].value='not here';h.ids['directory-search'].fire('input');
 assert.equal(h.ids['directory-status'].textContent,'0 resources found');
 h.clear.fire('click');assert.equal(h.ids['directory-status'].textContent,'2 resources found');
 assert.equal(h.location.search,'');
 h.ids['directory-sort'].value='recommended';h.ids['directory-sort'].fire('change');
 assert.equal(h.list.order[0].dataset.resourceName,'Alpha');
});
