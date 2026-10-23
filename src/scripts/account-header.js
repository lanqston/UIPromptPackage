import { accountSession } from './account-session.js';

const link=document.getElementById('header-account-link');
// Let the account callback consume the email link before another client can process it.
if(link&&!(location.pathname.replace(/\/$/,'')==='/account'&&location.hash.includes('access_token='))){
 accountSession().then(({state,email,session})=>{
  if(state==='signed-in'){
   link.textContent='My account';link.href='/account';link.setAttribute('aria-label',`My account, signed in as ${email}`);if(location.pathname.replace(/\/$/,'')==='/account')link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
  }else if(session){
   link.textContent='Account';link.href='/account';link.setAttribute('aria-label','Account sign-in needs attention');link.removeAttribute('aria-current');
  }else{
   link.textContent='Log in';link.href='/login';link.removeAttribute('aria-label');
  }
 }).catch(()=>{});
}
