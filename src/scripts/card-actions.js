import { cardIconMarkup } from '../lib/card-icons.mjs';

export function cardIcon(name){const template=document.createElement('template');template.innerHTML=cardIconMarkup(name);return template.content.firstElementChild;}
const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
const key=(type,id)=>`${type}:${id}`;
const likedKey=(type,id)=>`digivated:liked:${key(type,id)}`;
const loaded=new Set();
const likeCounts=new Map();
const toast=el('p',undefined,'card-toast');toast.hidden=true;toast.setAttribute('role','status');document.body.append(toast);
let toastTimer;
function notice(message){toast.textContent=message;toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.hidden=true,3500);}
function localLiked(type,id){try{return localStorage.getItem(likedKey(type,id))==='1';}catch{return false;}}
function markLiked(type,id,liked){try{if(liked)localStorage.setItem(likedKey(type,id),'1');else localStorage.removeItem(likedKey(type,id));}catch{/* The server still records the preference. */}}
function refreshLikes(type,id,count,liked=localLiked(type,id)){likeCounts.set(key(type,id),count);document.querySelectorAll('[data-like-id]').forEach(button=>{if(button.dataset.likeType!==type||button.dataset.likeId!==id)return;button.setAttribute('aria-pressed',String(liked));button.querySelector('[data-like-count]').textContent=count>0?String(count):'';});}
async function request(type,id,body){const url=`/api/card-interactions?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`;const response=await fetch(body?'/api/card-interactions':url,{method:body?'POST':'GET',cache:'no-store',credentials:'omit',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify({type,id,...body})}:{}),signal:AbortSignal.timeout(12000)});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Try again in a moment.');return data;}
function loadCount(button){const type=button.dataset.likeType,id=button.dataset.likeId,item=key(type,id);if(loaded.has(item))return;loaded.add(item);request(type,id).then(data=>refreshLikes(type,id,data.likes)).catch(()=>{});}
const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;observer.unobserve(entry.target);loadCount(entry.target);}}, {rootMargin:'160px'}):null;
function scan(){document.querySelectorAll('[data-like-id]').forEach(button=>{const type=button.dataset.likeType,id=button.dataset.likeId,item=key(type,id);button.setAttribute('aria-pressed',String(localLiked(type,id)));if(likeCounts.has(item))button.querySelector('[data-like-count]').textContent=likeCounts.get(item)>0?String(likeCounts.get(item)):'';if(!button.dataset.observed){button.dataset.observed='true';if(observer)observer.observe(button);else loadCount(button);}});}
scan();document.addEventListener('digivated:collection-updated',scan);

const dialog=el('dialog',undefined,'comment-dialog');dialog.setAttribute('aria-labelledby','comment-dialog-title');
const head=el('div',undefined,'comment-dialog-header'),title=el('h2','Join the conversation');title.id='comment-dialog-title';
const close=el('button','×');close.type='button';close.setAttribute('aria-label','Close comments');close.addEventListener('click',()=>dialog.close());head.append(title,close);
const body=el('div',undefined,'comment-dialog-body');const list=el('ul',undefined,'comment-list');
const empty=el('p','Loading comments…','quiet');const form=el('form',undefined,'comment-form');
const nameLabel=el('label','Name (optional)'),name=el('input');name.name='name';name.maxLength=40;name.placeholder='Guest';nameLabel.append(name);
const commentLabel=el('label','Your comment'),comment=el('textarea');comment.name='comment';comment.required=true;comment.minLength=4;comment.maxLength=500;comment.placeholder='What stood out to you?';commentLabel.append(comment);
const helper=el('p','Comments are reviewed before they appear. Please keep them helpful and respectful.','quiet');
const submit=el('button','Post comment','button primary');submit.type='submit';const feedback=el('p',undefined,'comment-status');feedback.setAttribute('role','status');
form.append(nameLabel,commentLabel,helper,submit,feedback);body.append(empty,list,form);dialog.append(head,body);document.body.append(dialog);
let current=null,returnFocus=null,dialogRequest=0;
dialog.addEventListener('close',()=>returnFocus?.focus());
function renderComments(comments){list.replaceChildren();for(const entry of comments){const row=el('li');row.append(el('strong',entry.name),el('p',entry.body));list.append(row);}empty.textContent=comments.length?'': 'No comments yet. You can start the conversation.';}
async function openComments(type,id,trigger){current={type,id};returnFocus=trigger;const generation=++dialogRequest;feedback.textContent='';renderComments([]);empty.textContent='Loading comments…';dialog.showModal();try{const data=await request(type,id);if(generation===dialogRequest)renderComments(data.comments||[]);}catch(error){if(generation===dialogRequest)empty.textContent=error.message;}}
form.addEventListener('submit',async event=>{event.preventDefault();if(!current)return;submit.disabled=true;feedback.textContent='Sending your comment…';try{const data=await request(current.type,current.id,{action:'comment',name:name.value,comment:comment.value});feedback.textContent=data.message;comment.value='';}catch(error){feedback.textContent=error.message;}finally{submit.disabled=false;}});

document.addEventListener('click',async event=>{
 const target=event.target.closest('button');if(!target)return;
 if(target.matches('[data-comment-id]')){openComments(target.dataset.commentType,target.dataset.commentId,target);return;}
 if(target.matches('[data-share-url]')){
  const url=new URL(target.dataset.shareUrl,location.origin).href;
  try{if(navigator.share)await navigator.share({url});else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);notice('Link copied.');}else notice('Share this link: '+url);}catch(error){if(error.name!=='AbortError')notice('Could not share this link. Try again.');}return;
 }
 if(target.matches('[data-like-id]')){
  const type=target.dataset.likeType,id=target.dataset.likeId;const action=localLiked(type,id)?'unlike':'like';
  target.disabled=true;try{const data=await request(type,id,{action});markLiked(type,id,data.liked);refreshLikes(type,id,data.likes,data.liked);}catch(error){notice(error.message);}finally{target.disabled=false;}
 }
});
