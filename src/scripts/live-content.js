import { observeProjectViews, viewLabel } from './project-views.js';
import { observeResourceViews } from './resource-views.js';
import { resourcePathInfo } from '../data/learning-paths.mjs';
import { safeUrl, normalizeResourceCategory } from '../data/community.mjs';
import { cardIcon } from './card-actions.js';
import { categoryIcon, resourceStats, formatCardDate } from '../lib/card-meta.mjs';
const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
function link(text,url){const node=el('a',text);node.href=url.startsWith('/')?url:safeUrl(url);if(!url.startsWith('/')){node.target='_blank';node.rel='noopener noreferrer';}return node;}
function thumbnail(url,alt){const img=el('img');img.src=url;img.alt=alt;img.width=640;img.height=400;img.loading='lazy';return img;}
function saveButton(type,id){const button=el('button','Save','button');button.type='button';button.dataset.saveType=type;button.dataset.saveId=id;return button;}
function cardButton(action,type,id,url,label){
 const button=el('button',undefined,'card-icon');button.type='button';button.dataset[action+'Type']=type;button.dataset[action+'Id']=id;
 if(url)button.dataset.shareUrl=url;button.setAttribute('aria-label',label);button.title=label;
 button.append(cardIcon(action),el('span',label,'sr-only'));return button;
}
function cardSave(type,id){const button=saveButton(type,id);button.className='card-icon card-save';button.textContent='';button.title='Save to collections';button.append(cardIcon('save'),el('span','Save','sr-only'));button.lastChild.dataset.saveLabel='';return button;}
function cardSocial(type,id,url){const row=el('div',undefined,'card-social');const feedback=cardButton('comment',type,id,null,type==='project'?'Give feedback on this project':'Read or leave a comment');if(type==='project'){feedback.classList.add('card-feedback-trigger');feedback.querySelector('.sr-only')?.remove();feedback.append(el('span','Feedback','card-feedback-label'),el('span','0','card-feedback-count'));}row.append(feedback,cardButton('share',type,id,url,'Share this '+type));const like=cardButton('like',type,id,null,'Like this '+type);const count=el('span',undefined,'card-count');count.dataset.likeCount='';like.append(count);row.append(like);return row;}
function cardActions(type,id,url){const row=cardSocial(type,id,url);row.className='card-actions';row.setAttribute('role','group');row.setAttribute('aria-label',type==='project'?'Feedback, share, like, and save':'Comment, share, like, and save');row.append(cardSave(type,id));return row;}
function statStrip(resource){
 const strip=el('div',undefined,'card-stats');strip.setAttribute('aria-label','Resource details');
 for(const stat of resourceStats(resource)){
  const item=el('span',undefined,'card-stat');item.title=stat.label;const icon=el('span',undefined,'stat-icon');icon.append(cardIcon(stat.icon));const value=el(stat.datetime?'time':'span',stat.text);
  if(stat.datetime)value.dateTime=stat.datetime;if(stat.viewId)value.dataset.resourceViews=stat.viewId;else value.setAttribute('aria-label',stat.label);
  item.append(icon,value);strip.append(item);
 }return strip;
}
function topicLabel(category){const topic=el('div',undefined,'card-topic');const icon=el('span',undefined,'topic-icon');icon.append(cardIcon(categoryIcon(category)));topic.append(icon,el('span',category,'tag'));return topic;}
function openLink(text,url,icon='arrow'){const anchor=link('',url);anchor.className='card-open';const arrow=el('span',undefined,'button-arrow');arrow.append(cardIcon(icon));anchor.append(el('span',text),arrow);return anchor;}
function projectCard(project){
 const card=el('article',undefined,'project-card');card.id=`project-${project.id}`;card.dataset.project='';card.dataset.projectId=project.id;card.dataset.projectDate=project.date||'';card.dataset.projectName=project.name;card.dataset.projectViewsTotal=String(project.views||0);card.dataset.category=project.category;card.dataset.featured=String(project.status==='featured');card.dataset.pick=String(project.pick===true);card.dataset.search=`${project.name} ${project.creator} ${project.description} ${project.category}`.toLowerCase();
 const image=el('div',undefined,'project-image card-visual');
 const fallback=()=>{image.querySelector('img')?.remove();image.prepend(el('span',project.name.slice(0,2).toUpperCase(),'project-monogram'));};
 if(project.image){const preview=thumbnail(project.image,`${project.name} project preview`);preview.decoding='async';preview.addEventListener('error',fallback,{once:true});image.append(preview);}else fallback();
 const copy=el('div',undefined,'project-copy');
 const heading=el('h3');heading.append(link(project.name,project.pageUrl||project.url));
 const meta=el('div',undefined,'project-meta');meta.append(topicLabel(project.category),project.socialUrl?link(`By ${project.creator}`,project.socialUrl):el('span',`By ${project.creator}`,'quiet'));
 if(project.sponsored)meta.append(el('span','Sponsored','tag sponsored-tag'));
 const description=el('p',project.description,'project-description');
 copy.append(heading,meta,description);
 if(project.description.length>100){const details=el('details',undefined,'project-details');details.append(el('summary','Read full description'),el('p',project.description));copy.append(details);}
 const stats=el('div',undefined,'card-stats project-stats');const viewStat=el('span',undefined,'card-stat');const eye=el('span',undefined,'stat-icon');eye.append(cardIcon('eye'));const views=el('span',viewLabel(project.views));views.dataset.projectViews=project.id;viewStat.title='Approximate project views. Repeat views from the same network count once every 24 hours.';viewStat.append(eye,views);stats.append(viewStat);
 if(formatCardDate(project.date)){const dateStat=el('span',undefined,'card-stat');dateStat.title=formatCardDate(project.date,true);dateStat.append(cardIcon('calendar'),el('span',formatCardDate(project.date)));stats.prepend(dateStat);}copy.append(stats);
 if(project.pageUrl){const detail=link('View project',project.pageUrl);detail.className='project-detail-link';detail.append(cardIcon('arrow'));copy.append(detail);}
 const actions=el('div',undefined,'card-links card-footer');const visit=openLink('Visit project',project.url,'external');visit.classList.add('button','primary');actions.append(cardActions('project',project.id,project.pageUrl||`/discover#project-${project.id}`),visit);copy.append(actions);
 if(document.body.classList.contains('projects-dashboard') || document.body.classList.contains('home-refresh')){
  const identity=el('div',undefined,'project-identity');
  identity.append(image,meta.querySelector('.card-topic'));
  const sponsored=meta.querySelector('.sponsored-tag');if(sponsored)identity.append(sponsored);
  copy.prepend(identity);card.append(copy);
 }else card.append(image,copy);
 return card;
}
function resourceCard(resource){
 const category=normalizeResourceCategory(resource.category);const learning=resourcePathInfo({...resource,category});const card=el('article',undefined,'resource-card');card.dataset.learningGoal=learning.path?.id||'';card.dataset.resourceOrder=String(learning.order);card.dataset.resource='';card.dataset.resourceName=resource.title;card.dataset.resourceDate=resource.date||'';card.dataset.resourceReadingTime=String(resource.readingTime||'');card.dataset.resourceKind='guide';card.dataset.resourceViewId=resource.id;card.dataset.category=category;card.dataset.search=`${resource.title} ${resource.description} ${category} ${learning.keywords}`.toLowerCase();
 const copy=el('div',undefined,'resource-copy');copy.append(topicLabel(category));const title=el('h3');title.append(link(resource.title,resource.url));copy.append(title,el('p',resource.description,'resource-description'),statStrip(resource));const footer=el('div',undefined,'card-footer');footer.append(cardActions('resource',resource.id,resource.url),openLink('Read the guide',resource.url));copy.append(footer);card.append(copy);return card;
}
function productCard(product){
 const card=el('article',undefined,'product-feature');const art=el('div',undefined,'product-art');art.append(product.image?thumbnail(product.image,product.name):el('span','Made by Digivated','tiny'));
 const copy=el('div',undefined,'product-copy');copy.append(el('p','Made by Digivated','eyebrow'),el('h2',product.name),el('p',product.description,'lede'),el('p',product.label,'quiet'));const button=link(`View ${product.name}`,product.url);button.className='button primary';copy.append(button);card.append(art,copy);return card;
}
async function collection(url){
 const items=[];let offset=0;
 do{const response=await fetch(`${url}${url.includes('?')?'&':'?'}offset=${offset}`,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('unavailable');const data=await response.json();items.push(...data.items);offset=data.next;}while(offset!==null);
 return items;
}
function renderShelf(node,items,renderer){const target=node.querySelector('[data-live-list]');const limit=Number(node.dataset.limit)||items.length;target.replaceChildren(...(node.hasAttribute('data-project-filters') ? items : items.slice(0,limit)).map(renderer));const empty=node.querySelector('[data-live-empty]');if(empty)empty.hidden=items.length>0;target.hidden=items.length===0;}
function setupProjectFilters(shelf) {
 const buttons = [...shelf.querySelectorAll('[data-project-filter]')];
 const cards = [...shelf.querySelectorAll('[data-project]')];
 const list = shelf.querySelector('[data-live-list]');
 const empty = shelf.querySelector('[data-live-empty]');
 const status = shelf.querySelector('[data-live-status]');
 const title = empty.querySelector('h3');
 const description = empty.querySelector('p');
 const original = { title: title.textContent, description: description.textContent };
 const limit = Number(shelf.dataset.limit) || cards.length;
 const update = mode => {
  let total = 0;
  for (const card of cards) {
   const matches = mode === 'all' || (mode === 'featured' && card.dataset.featured === 'true');
   card.hidden = !matches || total >= limit;
   if (matches) total++;
  }
  buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.projectFilter === mode)));
  list.hidden = total === 0;
  empty.hidden = total > 0;
  title.textContent = mode === 'all' ? original.title : 'Featured builds are on their way.';
  description.textContent = mode === 'all' ? original.description : 'Check back as more community projects are reviewed, or explore all builds.';
  shelf.querySelector('[data-filter-description]').textContent = mode === 'all' ? 'Browse the latest projects from independent creators.' : 'Projects in the community spotlight.';
  status.textContent = total ? (total > limit ? `Showing ${limit} of ${total} projects` : `${total} project${total === 1 ? '' : 's'}`) : 'No projects in this collection yet.';
 };
 for (const button of buttons) {
  button.disabled = false;
  button.addEventListener('click', () => update(button.dataset.projectFilter));
 }
 update('all');
 shelf.setAttribute('aria-busy', 'false');
}
async function loadProjects(){
 const shelves=[...document.querySelectorAll('[data-live-projects]')];if(!shelves.length)return;
 try{
  const projects=await collection('/api/projects');
  for(const shelf of shelves){const mode=shelf.dataset.liveProjects;const selected=mode==='featured'?projects.filter(p=>p.status==='featured'):projects;renderShelf(shelf,selected,projectCard);if(shelf.hasAttribute('data-project-filters'))setupProjectFilters(shelf);}
  document.dispatchEvent(new Event('digivated:collection-updated'));
  observeProjectViews();
 }catch{for(const shelf of shelves){shelf.removeAttribute('aria-busy');const empty=shelf.querySelector('[data-live-empty]');empty.hidden=true;const status=shelf.querySelector('[data-live-status]');if(status)status.textContent='Projects are temporarily unavailable. Please try again shortly.';}}
}
async function loadResources(){
 const shelves=[...document.querySelectorAll('[data-live-resources]')];if(!shelves.length)return;
 try{
  const resources=await collection('/api/content?type=resource');
  for(const shelf of shelves){
   const list=shelf.querySelector('[data-live-list]');
   const builtins=[...list.querySelectorAll('[data-builtin-resource]')];
   const builtinUrls=new Set(builtins.map(card=>new URL(card.dataset.resourceUrl,location.origin).href));
   const published=resources.filter(resource=>{try{return !builtinUrls.has(new URL(resource.url,location.origin).href);}catch{return true;}});
   list.replaceChildren(...builtins,...published.map(resourceCard));
   list.hidden=list.children.length===0;
   shelf.querySelector('[data-live-empty]').hidden=list.children.length>0;
  }
 }catch{for(const shelf of shelves){const status=shelf.querySelector('[data-live-status]');if(status)status.textContent=shelf.querySelector('[data-builtin-resource]')?'Additional resources are temporarily unavailable. The published guides above are still available.':'Resources are temporarily unavailable. Please try again shortly.';}}
 observeResourceViews();
 document.dispatchEvent(new Event('digivated:collection-updated'));
}
async function loadProducts(){const target=document.querySelector('[data-live-products]');if(!target)return;try{const products=await collection('/api/content?type=product');target.replaceChildren(...products.map(productCard));}catch{document.getElementById('products-status').textContent='Additional products are temporarily unavailable. The UI/UX Prompt Packet is available above.';}}
async function loadArticle(){
 const root=document.getElementById('live-article');if(!root)return;
 const slug=new URLSearchParams(location.search).get('slug');const status=document.getElementById('article-status');
 if(!slug||!/^[a-z0-9][a-z0-9-]{0,99}$/.test(slug)){status.textContent='This article could not be found.';return;}
 try{
  const response=await fetch(`/api/content?type=resource&id=${encodeURIComponent(slug)}`,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(15000)});
  if(!response.ok){status.textContent=response.status===404?'This article is not available.':'This article is temporarily unavailable. Please try again shortly.';return;}
  const {item}=await response.json();document.title=`${item.title} · Digivated`;document.querySelector('link[rel="canonical"]').href=new URL(item.url,'https://digivated.com').href;document.querySelector('meta[name="description"]').content=item.description;document.getElementById('article-title').textContent=item.title;document.getElementById('article-category').textContent=normalizeResourceCategory(item.category);document.getElementById('article-description').textContent=item.description;document.getElementById('article-meta').replaceChildren(statStrip({...item,fullDate:true}));
  const body=document.getElementById('article-body');if(item.coverImage){const image=thumbnail(item.coverImage,'');image.className='article-cover';body.append(image);}
  item.content.split(/\n\s*\n/).filter(Boolean).forEach(block=>{const heading=block.startsWith('## ');body.append(el(heading?'h2':'p',heading?block.slice(3):block));});document.querySelector('.page-intro').append(cardActions('resource',item.id,item.url));root.hidden=false;status.textContent='';const header=document.querySelector('.page-intro');header.dataset.resourceViewId=item.id;observeResourceViews();
  if(item.related?.length){const all=await collection('/api/content?type=resource');const related=all.filter(r=>item.related.includes(r.id)&&r.id!==item.id);const section=document.getElementById('article-related');section.querySelector('.resource-grid').replaceChildren(...related.map(resourceCard));section.hidden=related.length===0;observeResourceViews();}
  document.dispatchEvent(new Event('digivated:collection-updated'));
 }catch{status.textContent='This article is temporarily unavailable. Please try again shortly.';}
}
loadProjects();loadResources();loadProducts();loadArticle();


