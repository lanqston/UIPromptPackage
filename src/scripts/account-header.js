import { accountSession } from './account-session.js';

const link=document.getElementById('header-account-link');
const menuAccount=document.getElementById('menu-account-link');
const menuLogin=document.getElementById('menu-login-link');
// Let an incoming email callback establish its session on the account page first.
if(link&&!(location.pathname.replace(/\/$/,'')==='/account'&&location.hash.includes('access_token='))){
 let request=0;
 const update=async(fresh=false)=>{
  const current=++request;
  try{
   const {state,email,session}=await accountSession({fresh});
   if(current!==request)return;
   const hasAccount=state==='signed-in'||state==='unavailable'&&!!session;
   link.textContent=hasAccount?'My account':'Log In';
   link.href=hasAccount?'/account':'/login';
   if(state==='signed-in')link.setAttribute('aria-label',`My account, signed in as ${email}`);
   else if(hasAccount)link.setAttribute('aria-label','My account, account connection needs attention');
   else link.removeAttribute('aria-label');
   if(location.pathname.replace(/\/$/,'')===link.getAttribute('href'))link.setAttribute('aria-current','page');
   else link.removeAttribute('aria-current');
   if(menuAccount)(menuAccount.querySelector('span')||menuAccount).textContent=hasAccount?'My account':'Your projects';
   if(menuLogin)menuLogin.hidden=hasAccount;
  }catch{
   // Keep the visible sign-in route available during a temporary outage.
  }
 };
 update();
 window.addEventListener('pageshow',event=>{if(event.persisted)update(true);});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)update(true);});
}
