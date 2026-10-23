import { accountSession } from './account-session.js';

const form=document.getElementById('login-email-form');
if(form){
 const tabs=[document.getElementById('login-tab-signin'),document.getElementById('login-tab-signup')];
 const status=document.getElementById('login-status'),submit=document.getElementById('login-submit'),explanation=document.getElementById('login-explanation');
 let mode=new URLSearchParams(location.search).get('mode')==='signup'?'signup':'signin';
 const render=()=>{
  tabs.forEach((tab,index)=>{const selected=(index===0?'signin':'signup')===mode;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;});
  document.getElementById('login-form-panel').setAttribute('aria-labelledby',mode==='signin'?'login-tab-signin':'login-tab-signup');
  explanation.textContent=mode==='signin'?'Enter your email and we’ll send you a one-click sign-in link. No password needed.':'Create an account with your email. Follow the link we send to verify your address.';
  submit.textContent=mode==='signin'?'Email me a sign-in link':'Create account';
  status.textContent='';
 };
 tabs.forEach((tab,index)=>{tab.onclick=()=>{mode=index===0?'signin':'signup';render();};tab.onkeydown=event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const next=tabs[index===0?1:0];next.click();next.focus();};});
 render();
 async function boot(){
  const {state:authState,client}=await accountSession();
  if(authState==='signed-in'){location.replace('/discover?view=featured&signed_in=1');return;}
  if(authState==='unverified')status.textContent='Finish verifying your account with an emailed sign-in link.';
  if(authState==='unavailable')status.textContent='Account verification is temporarily unavailable. You can request a fresh email link.';
  form.onsubmit=async event=>{
   event.preventDefault();const email=form.elements.email.value.trim();submit.disabled=true;status.textContent='Sending your email link…';
   try{
    const {error}=await client.auth.signInWithOtp({email,options:{shouldCreateUser:mode==='signup',emailRedirectTo:`${location.origin}/account`}});
    if(error)throw error;
    status.textContent=`Check ${email} for a sign-in link. Open it to finish ${mode==='signup'?'creating your account':'signing in'}.`;
   }catch(error){status.textContent=error.message||'Could not send the link. Please try again.';}
   finally{submit.disabled=false;}
  };
 }
 boot().catch(error=>{status.textContent=error.message||'Account sign-in is temporarily unavailable.';submit.disabled=true;});
}
