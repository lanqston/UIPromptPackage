import { accountSession } from './account-session.js';

const announcement=document.getElementById('account-announcement');
const storageKey='digivated-accounts-announcement-v1';
if(announcement){
 const dismissed=()=>{try{return sessionStorage.getItem(storageKey)==='dismissed';}catch{return false;}};
 const close=()=>{
  announcement.hidden=true;
  try{sessionStorage.setItem(storageKey,'dismissed');}catch{}
 };
 document.getElementById('account-announcement-close')?.addEventListener('click',close);
 if(!dismissed())accountSession().then(({state})=>{
  if(state!=='signed-in'&&!dismissed())announcement.hidden=false;
 }).catch(()=>{if(!dismissed())announcement.hidden=false;});
}
