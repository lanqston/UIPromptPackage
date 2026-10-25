import { accountSession } from './account-session.js';

const announcement=document.getElementById('account-announcement');
if(announcement){
 const keys={accounts:'digivated-accounts-announcement-v1',weekly:'digivated-weekly-announcement-v1'};
 let current='accounts';
 const dismissed=kind=>{try{return sessionStorage.getItem(keys[kind])==='dismissed';}catch{return false;}};
 const show=state=>{
  current=state==='signed-in'||dismissed('accounts')?'weekly':'accounts';
  if(dismissed(current))return;
  if(current==='weekly'){
   announcement.setAttribute('aria-label','Weekly email announcement');
   document.getElementById('announcement-title').textContent='Weekly project emails are live.';
   document.getElementById('announcement-description').textContent='Get a short email when new projects go live. Sign in and opt in from Your Projects. Unsubscribe anytime.';
   const link=document.getElementById('announcement-link');link.href='/account';link.firstChild.textContent='Manage weekly emails ';
  }
  announcement.hidden=false;
 };
 const close=()=>{
  announcement.hidden=true;
  try{sessionStorage.setItem(keys[current],'dismissed');}catch{}
 };
 document.getElementById('account-announcement-close')?.addEventListener('click',close);
 accountSession().then(({state})=>show(state)).catch(()=>show('signed-out'));
}
