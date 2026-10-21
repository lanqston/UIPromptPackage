import {rankDiscovery,safeSearchHref} from '../lib/discovery-search.mjs';
const $ = selector => document.querySelector(selector);
const make = (tag,text,cls) => {const node=document.createElement(tag);if(text)node.textContent=text;if(cls)node.className=cls;return node;};
const search = $('#discovery-search'), input = $('#unified-search-input'), results = $('#unified-results');
let records = JSON.parse($('#discovery-index').textContent), scope='all', searchTrigger, loading, projectsUnavailable=false;
const dedupe = entries => [...new Map(entries.map(record => [record.href,record])).values()];
function renderSearch() {
  const found = rankDiscovery(records,input.value,scope);
  results.replaceChildren(...found.map(record => {
    const a=make('a',undefined,'unified-result');a.href=safeSearchHref(record.href);if(new URL(a.href).origin!==location.origin){a.target='_blank';a.rel='noopener noreferrer';}
    const mark=make('span',record.type==='project'?record.title.slice(0,2).toUpperCase():'↗','unified-result-mark');mark.setAttribute('aria-hidden','true');
    const copy=make('span',undefined,'unified-result-copy');copy.append(make('strong',record.title),make('small',`${record.type==='project'?'Project':'Resource'} · ${record.category}`));
    const arrow=make('span','↗','unified-result-arrow');arrow.setAttribute('aria-hidden','true');a.append(mark,copy,arrow);return a;
  }));
  $('#unified-search-empty').hidden=found.length>0;
  $('#unified-search-status').textContent=(input.value.trim()?`${found.length} result${found.length===1?'':'s'}${found.length===8?' shown':''}`:'Start somewhere interesting')+(loading?' · Loading content…':projectsUnavailable?' · Additional content is temporarily unavailable.':'');
  for(const button of search.querySelectorAll('[data-search-type]'))button.setAttribute('aria-pressed',String(button.dataset.searchType===scope));
}
async function collection(url) {
  const items=[];let offset=0;
  do {const response=await fetch(`${url}${url.includes('?')?'&':'?'}offset=${offset}`,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error('Unavailable');const data=await response.json();items.push(...data.items);offset=data.next;}while(offset!==null && offset!==undefined);
  return items;
}
let requested=false;
async function enrichSearch() {
  if(requested)return;requested=true;loading=true;renderSearch();
  const [projects,resources,carousels] = await Promise.allSettled([collection('/api/projects'),collection('/api/content?type=resource'),collection('/api/carousels')]);
  const extra=[];
  if(projects.status==='fulfilled')for(const p of projects.value)if(p.id&&p.name)extra.push({type:'project',title:p.name,description:p.description,category:p.category||'Independent project',href:safeSearchHref(p.pageUrl)||safeSearchHref(p.url)});
  if(resources.status==='fulfilled')for(const r of resources.value)if(safeSearchHref(r.url))extra.push({type:'resource',title:r.title,description:r.description,category:r.category,href:r.url});
  if(carousels.status==='fulfilled')for(const item of carousels.value)if(item.slug&&item.title)extra.push({type:'resource',title:item.title,description:item.summary,category:'Educational carousel',href:`/carousels/${encodeURIComponent(item.slug)}`});
  projectsUnavailable=[projects,resources,carousels].some(result=>result.status==='rejected');records=dedupe([...extra,...records]);loading=false;renderSearch();
}
function openSearch(trigger) {if(document.querySelector('dialog[open]'))return;searchTrigger=trigger||document.activeElement;search.showModal();input.focus();renderSearch();enrichSearch();}
document.querySelectorAll('[data-open-search]').forEach(button=>button.addEventListener('click',()=>openSearch(button)));
search.querySelector('[data-close-search]').addEventListener('click',()=>search.close());
search.addEventListener('close',()=>searchTrigger?.focus());
input.addEventListener('input',renderSearch);
input.addEventListener('keydown',event=>{if(event.key==='ArrowDown'){const first=results.querySelector('a');if(first){event.preventDefault();first.focus();}}if(event.key==='Enter'){const first=results.querySelector('a');if(first){event.preventDefault();first.click();}}});
results.addEventListener('keydown',event=>{const links=[...results.querySelectorAll('a')],index=links.indexOf(document.activeElement);if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();const next=index+(event.key==='ArrowDown'?1:-1);if(next<0)input.focus();else links[Math.min(next,links.length-1)]?.focus();}});
search.querySelectorAll('[data-search-type]').forEach(button=>button.addEventListener('click',()=>{scope=button.dataset.searchType;renderSearch();}));
document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();openSearch();}});

const preview=$('#project-preview');let previewCards=[],previewIndex=0,previewTrigger;
function renderPreview() {
  const card=previewCards[previewIndex];if(!card)return;
  const name=card.querySelector('h3')?.textContent.trim()||'Project';
  $('#project-preview-title').textContent=name;
  $('#preview-category').textContent=card.dataset.category||'Independent project';
  $('#preview-creator').textContent=card.querySelector('.project-meta')?.textContent.trim()||'';
  $('#preview-description').textContent=card.querySelector('.project-details p')?.textContent||card.querySelector('.project-description')?.textContent||'';
  $('#preview-meta').textContent=[...card.querySelectorAll('.project-stats .card-stat')].map(node=>node.textContent.trim()).join(' · ')||'Reviewed by Digivated';
  const visit=$('#preview-visit'),href=safeSearchHref(card.querySelector('.card-open')?.href);if(href)visit.href=href;else visit.removeAttribute('href');
  const identity=$('#preview-identity'),original=card.querySelector('.project-image img');identity.replaceChildren();
  if(original){const img=make('img');img.src=original.currentSrc||original.src;img.alt='';img.width=64;img.height=64;img.addEventListener('error',()=>identity.replaceChildren(make('span',name.slice(0,2).toUpperCase())),{once:true});identity.append(img);}else identity.append(make('span',name.slice(0,2).toUpperCase()));
  $('#preview-position').textContent=`${previewIndex+1} of ${previewCards.length}`;
  $('#preview-previous').disabled=previewIndex===0;$('#preview-next').disabled=previewIndex===previewCards.length-1;
  const body=preview.querySelector('.preview-copy');if(!matchMedia('(prefers-reduced-motion: reduce)').matches)body.animate([{opacity:.5,translate:'0 5px'},{opacity:1,translate:'0 0'}],{duration:180,easing:'ease-out'});
}
function scanPreviews() {
  document.querySelectorAll('[data-project]').forEach(card=>{
    if(card.querySelector('[data-preview-trigger]'))return;
    let trigger=card.querySelector('.project-details summary');
    if(trigger)trigger.textContent='Quick view';
    else{trigger=make('button','Quick view','project-preview-trigger');trigger.type='button';card.querySelector('.project-copy').insertBefore(trigger,card.querySelector('.project-stats'));}
    trigger.dataset.previewTrigger='';trigger.setAttribute('aria-haspopup','dialog');
  });
}
scanPreviews();document.addEventListener('digivated:collection-updated',scanPreviews);
document.addEventListener('click',event=>{const trigger=event.target.closest('[data-preview-trigger]');if(!trigger)return;event.preventDefault();const card=trigger.closest('[data-project]');previewCards=[...card.parentElement.querySelectorAll('[data-project]')].filter(node=>!node.hidden);previewIndex=previewCards.indexOf(card);previewTrigger=trigger;renderPreview();preview.showModal();preview.querySelector('[data-close-preview]').focus();});
preview.querySelector('[data-close-preview]').addEventListener('click',()=>preview.close());
preview.addEventListener('close',()=>previewTrigger?.focus());
$('#preview-previous').addEventListener('click',()=>{if(previewIndex>0){previewIndex--;renderPreview();}});
$('#preview-next').addEventListener('click',()=>{if(previewIndex<previewCards.length-1){previewIndex++;renderPreview();}});
preview.addEventListener('keydown',event=>{if(event.altKey||event.ctrlKey||event.metaKey)return;if(event.key==='ArrowLeft'&&previewIndex>0){event.preventDefault();previewIndex--;renderPreview();}if(event.key==='ArrowRight'&&previewIndex<previewCards.length-1){event.preventDefault();previewIndex++;renderPreview();}});
for(const dialog of [search,preview])dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
