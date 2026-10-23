import { accountSession } from './account-session.js';

const banner=document.getElementById('account-welcome');
if(banner&&new URLSearchParams(location.search).has('signed_in')){
 accountSession().then(({state,email})=>{
  if(state==='signed-in'){
   document.getElementById('account-welcome-message').textContent=`You're logged in as ${email}.`;
   banner.hidden=false;
   const url=new URL(location.href);url.searchParams.delete('signed_in');history.replaceState(null,'',url);
  }
 }).catch(()=>{});
}
