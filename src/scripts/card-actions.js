import { cardFeedback } from './motion.js';
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
function refreshLikes(type,id,count,liked=localLiked(type,id)){likeCounts.set(key(type,id),count);document.querySelectorAll('[data-like-id]').forEach(button=>{if(button.dataset.likeType!==type||button.dataset.likeId!==id)return;button.setAttribute('aria-pressed',String(liked));button.setAttribute('aria-label',liked?'Unlike this project or resource':'Like this project or resource');button.querySelector('[data-like-count]').textContent=count>0?String(count):'';});}
async function request(type,id,body){const url=`/api/card-interactions?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`;const response=await fetch(body?'/api/card-interactions':url,{method:body?'POST':'GET',cache:'no-store',credentials:'omit',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify({type,id,...body})}:{}),signal:AbortSignal.timeout(12000)});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Try again in a moment.');return data;}
function loadCount(button){const type=button.dataset.likeType,id=button.dataset.likeId,item=key(type,id);if(loaded.has(item))return;loaded.add(item);request(type,id).then(data=>refreshLikes(type,id,data.likes)).catch(()=>{});}
const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;observer.unobserve(entry.target);loadCount(entry.target);}}, {rootMargin:'160px'}):null;
function scan(){document.querySelectorAll('[data-like-id]').forEach(button=>{const type=button.dataset.likeType,id=button.dataset.likeId,item=key(type,id);button.setAttribute('aria-pressed',String(localLiked(type,id)));if(likeCounts.has(item))button.querySelector('[data-like-count]').textContent=likeCounts.get(item)>0?String(likeCounts.get(item)):'';if(!button.dataset.observed){button.dataset.observed='true';if(observer)observer.observe(button);else loadCount(button);}});}
scan();document.addEventListener('digivated:collection-updated',scan);

const dialog=el('dialog',undefined,'comment-dialog');dialog.setAttribute('aria-labelledby','comment-dialog-title');
const head=el('div',undefined,'comment-dialog-header');const heading=el('div',undefined,'feedback-heading');const eyebrow=el('span','PROJECT FEEDBACK','feedback-eyebrow');const title=el('h2','Share feedback');title.id='comment-dialog-title';const introduction=el('p','What worked well? What could be clearer?','feedback-intro');heading.append(eyebrow,title,introduction);
const close=el('button','×');close.type='button';close.setAttribute('aria-label','Close feedback');close.addEventListener('click',()=>dialog.close());head.append(heading,close);
const body=el('div',undefined,'comment-dialog-body');const form=el('form',undefined,'comment-form');
const commentLabel=el('label','Your feedback'),comment=el('textarea');comment.name='comment';comment.required=true;comment.minLength=4;comment.maxLength=500;comment.placeholder='I liked… One thing I would improve is…';comment.id='project-feedback-text';commentLabel.htmlFor=comment.id;
const counter=el('span','0 / 500','feedback-counter');counter.id='feedback-counter';comment.setAttribute('aria-describedby',counter.id);comment.addEventListener('input',()=>{counter.textContent=`${comment.value.length} / 500`;});
const nameLabel=el('label','Your name (optional)'),name=el('input');name.name='name';name.maxLength=40;name.placeholder='Guest';name.id='project-feedback-name';nameLabel.htmlFor=name.id;
const helper=el('p','Feedback is reviewed before it appears on the project. Be specific and kind.','feedback-note');
const submit=el('button','Send feedback','button primary');submit.type='submit';const feedback=el('p',undefined,'comment-status');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
const formActions=el('div',undefined,'feedback-form-actions');formActions.append(helper,submit);form.append(commentLabel,comment,counter,nameLabel,name,formActions,feedback);
const responses=el('section',undefined,'feedback-responses');const responsesTitle=el('h3','Community feedback');const empty=el('p','Loading feedback…','feedback-empty');const list=el('ul',undefined,'comment-list');responses.append(responsesTitle,empty,list);
body.append(form,responses);dialog.append(head,body);document.body.append(dialog);
let current=null,returnFocus=null,dialogRequest=0;
dialog.addEventListener('close',()=>returnFocus?.focus());
function renderComments(comments){list.replaceChildren();for(const entry of comments){const row=el('li');row.append(el('strong',entry.name),el('p',entry.body));list.append(row);}empty.textContent=comments.length?'':current?.type==='project'?'No feedback yet. You can be the first to help this project grow.':'No comments yet. You can start the conversation.';}
async function openComments(type,id,trigger){if(current && key(current.type,current.id)!==key(type,id)){comment.value='';counter.textContent='0 / 500';name.value='';}current={type,id};returnFocus=trigger;const generation=++dialogRequest;const isProject=type==='project';const projectName=trigger.closest('[data-project]')?.dataset.projectName||trigger.closest('article')?.querySelector('h1,h2,h3')?.textContent?.trim();dialog.classList.toggle('is-project-feedback',isProject);eyebrow.textContent=isProject?'PROJECT FEEDBACK':'COMMUNITY COMMENTS';title.textContent=isProject?`Feedback for ${projectName||'this project'}`:'Join the conversation';introduction.textContent=isProject?'A thoughtful note can help the creator improve.':'Share a thought about this resource.';close.setAttribute('aria-label',isProject?'Close feedback':'Close comments');commentLabel.textContent=isProject?'Your feedback':'Your comment';comment.placeholder=isProject?'I liked… One thing I would improve is…':'What stood out to you?';helper.textContent=isProject?'Feedback is reviewed before it appears on the project. Be specific and kind.':'Comments are reviewed before they appear. Please keep them helpful and respectful.';submit.textContent=isProject?'Send feedback':'Post comment';responsesTitle.textContent=isProject?'Community feedback':'Comments';feedback.textContent='';renderComments([]);empty.textContent=isProject?'Loading feedback…':'Loading comments…';dialog.showModal();comment.focus();try{const data=await request(type,id);if(generation===dialogRequest)renderComments(data.comments||[]);}catch(error){if(generation===dialogRequest)empty.textContent=error.message;}}
form.addEventListener('submit',async event=>{event.preventDefault();if(!current)return;submit.disabled=true;submit.setAttribute('aria-busy','true');feedback.textContent=current.type==='project'?'Sending your feedback…':'Sending your comment…';try{const data=await request(current.type,current.id,{action:current.type==='project'?'project-feedback':'comment',name:name.value,comment:comment.value});feedback.textContent=data.message;comment.value='';counter.textContent='0 / 500';}catch(error){feedback.textContent=error.message;}finally{submit.disabled=false;submit.removeAttribute('aria-busy');}});

document.addEventListener('click',async event=>{
 const target=event.target.closest('button');if(!target)return;
 if(target.matches('[data-comment-id]')){openComments(target.dataset.commentType,target.dataset.commentId,target);return;}
 if(target.matches('[data-share-url]')){
  const url=new URL(target.dataset.shareUrl,location.origin).href;
  try{if(navigator.share)await navigator.share({url});else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);notice('Link copied.');}else notice('Share this link: '+url);}catch(error){if(error.name!=='AbortError')notice('Could not share this link. Try again.');}return;
 }
 if(target.matches('[data-like-id]')){
  const type=target.dataset.likeType,id=target.dataset.likeId;const action=localLiked(type,id)?'unlike':'like';
  target.disabled=true;target.setAttribute('aria-busy','true');try{const data=await request(type,id,{action});markLiked(type,id,data.liked);refreshLikes(type,id,data.likes,data.liked);cardFeedback(target,data.liked?'Liked.':'Like removed.',data.liked);}catch(error){notice(error.message);}finally{target.disabled=false;target.removeAttribute('aria-busy');}
 }
});
