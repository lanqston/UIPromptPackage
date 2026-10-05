import { observeProjectViews, viewLabel } from './project-views.js';
import { safeUrl } from '../data/community.mjs';
const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
function link(text,url){const node=el('a',text);node.href=url.startsWith('/')?url:safeUrl(url);if(!url.startsWith('/')){node.target='_blank';node.rel='noopener noreferrer';}return node;}
function thumbnail(url,alt){const img=el('img');img.src=url;img.alt=alt;img.width=640;img.height=400;img.loading='lazy';return img;}
function projectCard(project){
 const card=el('article',undefined,'project-card');card.dataset.project='';card.dataset.projectId=project.id;card.dataset.category=project.category;card.dataset.featured=String(project.status==='featured');card.dataset.pick=String(project.pick===true);card.dataset.search=`${project.name} ${project.creator} ${project.description} ${project.category}`.toLowerCase();
 const image=el('div',undefined,'project-image');image.append(project.image?thumbnail(project.image,`${project.name} project preview`):el('span',project.category,'tiny'));
 const copy=el('div',undefined,'project-copy');copy.append(el('span',project.category,'tag'),el('h3',project.name),el('p',`By ${project.creator}`,'quiet'),el('p',project.description));
 const views=el('p',viewLabel(project.views),'quiet');views.dataset.projectViews=project.id;views.title='Approximate project card views on Digivated. Repeat views from the same network count once every 24 hours.';copy.append(views);
 const actions=el('div',undefined,'card-links');actions.append(link('Visit Project →',project.url));if(project.socialUrl)actions.append(link('Creator →',project.socialUrl));copy.append(actions);card.append(image,copy);return card;
}
function resourceCard(resource){
 const card=el('article',undefined,'resource-card');card.dataset.resource='';card.dataset.category=resource.category;card.dataset.search=`${resource.title} ${resource.description} ${resource.category}`.toLowerCase();
 if(resource.coverImage)card.append(thumbnail(resource.coverImage,''));card.append(el('span',resource.category,'tag'));const title=el('h3');title.append(link(resource.title,resource.url));card.append(title,el('p',resource.description),el('p',`${resource.date} · ${resource.readingTime} min read`,'quiet'));return card;
}
function productCard(product){
 const card=el('article',undefined,'product-feature');const art=el('div',undefined,'product-art');art.append(product.image?thumbnail(product.image,product.name):el('span','Made by Digivated','tiny'));
 const copy=el('div',undefined,'product-copy');copy.append(el('p','Made by Digivated','eyebrow'),el('h2',product.name),el('p',product.description,'lede'),el('p',product.label,'quiet'));const button=link(`View ${product.name} →`,product.url);button.className='button primary';copy.append(button);card.append(art,copy);return card;
}
async function collection(url){
 const items=[];let offset=0;
 do{const response=await fetch(`${url}${url.includes('?')?'&':'?'}offset=${offset}`,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('unavailable');const data=await response.json();items.push(...data.items);offset=data.next;}while(offset!==null);
 return items;
}
function renderShelf(node,items,renderer){const target=node.querySelector('[data-live-list]');const limit=Number(node.dataset.limit)||items.length;target.replaceChildren(...items.slice(0,limit).map(renderer));const empty=node.querySelector('[data-live-empty]');if(empty)empty.hidden=items.length>0;target.hidden=items.length===0;}
async function loadProjects(){
 const shelves=[...document.querySelectorAll('[data-live-projects]')];if(!shelves.length)return;
 try{
  const projects=await collection('/api/projects');
  for(const shelf of shelves){const mode=shelf.dataset.liveProjects;let selected=projects;if(mode==='featured')selected=projects.filter(p=>p.status==='featured');if(mode==='picks')selected=projects.filter(p=>p.pick);renderShelf(shelf,selected,projectCard);}
  document.dispatchEvent(new Event('digivated:collection-updated'));
  observeProjectViews();
 }catch{for(const shelf of shelves){const status=shelf.querySelector('[data-live-status]');if(status)status.textContent='Projects are temporarily unavailable. Please try again shortly.';}}
}
async function loadResources(){
 const shelves=[...document.querySelectorAll('[data-live-resources]')];if(!shelves.length)return;
 try{const resources=await collection('/api/content?type=resource');for(const shelf of shelves)renderShelf(shelf,resources,resourceCard);document.dispatchEvent(new Event('digivated:collection-updated'));}
 catch{for(const shelf of shelves){const status=shelf.querySelector('[data-live-status]');if(status)status.textContent='Resources are temporarily unavailable. Please try again shortly.';}}
}
async function loadProducts(){const target=document.querySelector('[data-live-products]');if(!target)return;try{const products=await collection('/api/content?type=product');target.replaceChildren(...products.map(productCard));}catch{document.getElementById('products-status').textContent='Additional products are temporarily unavailable. The UI/UX Prompt Packet is available above.';}}
async function loadArticle(){
 const root=document.getElementById('live-article');if(!root)return;
 const slug=new URLSearchParams(location.search).get('slug');const status=document.getElementById('article-status');
 if(!slug||!/^[a-z0-9][a-z0-9-]{0,99}$/.test(slug)){status.textContent='This article could not be found.';return;}
 try{
  const response=await fetch(`/api/content?type=resource&id=${encodeURIComponent(slug)}`,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(15000)});
  if(!response.ok){status.textContent=response.status===404?'This article is not available.':'This article is temporarily unavailable. Please try again shortly.';return;}
  const {item}=await response.json();document.title=`${item.title} · Digivated`;document.querySelector('link[rel="canonical"]').href=new URL(item.url,'https://digitalpromptpackage.vercel.app').href;document.querySelector('meta[name="description"]').content=item.description;document.getElementById('article-title').textContent=item.title;document.getElementById('article-category').textContent=item.category;document.getElementById('article-description').textContent=item.description;document.getElementById('article-meta').textContent=`${item.date} · ${item.readingTime} min read`;
  const body=document.getElementById('article-body');if(item.coverImage){const image=thumbnail(item.coverImage,'');image.className='article-cover';body.append(image);}
  item.content.split(/\n\s*\n/).filter(Boolean).forEach(block=>{const heading=block.startsWith('## ');body.append(el(heading?'h2':'p',heading?block.slice(3):block));});root.hidden=false;status.textContent='';
  if(item.related?.length){const all=await collection('/api/content?type=resource');const related=all.filter(r=>item.related.includes(r.id)&&r.id!==item.id);const section=document.getElementById('article-related');section.querySelector('.resource-grid').replaceChildren(...related.map(resourceCard));section.hidden=related.length===0;}
 }catch{status.textContent='This article is temporarily unavailable. Please try again shortly.';}
}
loadProjects();loadResources();loadProducts();loadArticle();
