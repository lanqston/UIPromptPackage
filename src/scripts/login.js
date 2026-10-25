import { accountSession } from './account-session.js';

const form=document.getElementById('login-email-form');
if(form){
 const tabs=[document.getElementById('login-tab-signin'),document.getElementById('login-tab-signup')];
 const status=document.getElementById('login-status'),submit=document.getElementById('login-submit'),explanation=document.getElementById('login-explanation'),password=form.elements.password;
 let mode=new URLSearchParams(location.search).get('mode')==='signup'?'signup':'signin';
 let pendingSignup=null;const confirmed=document.getElementById('login-confirmed');
 const render=()=>{
  tabs.forEach((tab,index)=>{const selected=(index===0?'signin':'signup')===mode;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;});
  document.getElementById('login-form-panel').setAttribute('aria-labelledby',mode==='signin'?'login-tab-signin':'login-tab-signup');
  explanation.textContent=mode==='signin'?'Enter your email and password to sign in. If you joined with an email link, set a password below.':'Create an account with an email and password. Confirm your email using the link we send.';
  submit.textContent=mode==='signin'?'Sign in':'Create account';
  password.autocomplete=mode==='signin'?'current-password':'new-password';password.minLength=mode==='signin'?1:8;
  status.textContent='';
 };
 tabs.forEach((tab,index)=>{tab.onclick=()=>{mode=index===0?'signin':'signup';pendingSignup=null;confirmed.hidden=true;render();};tab.onkeydown=event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const next=tabs[index===0?1:0];next.click();next.focus();};});
 render();
 async function boot(){
  const {state:authState,client}=await accountSession();
  if(authState==='signed-in'){location.replace('/discover?view=featured&signed_in=1');return;}
  if(authState==='unverified')status.textContent='Finish verifying your email with the link we sent.';
  if(authState==='unavailable')status.textContent='Account verification is temporarily unavailable. You can request a fresh email link.';
  async function action(button,work){const email=form.elements.email.value.trim();if(!form.elements.email.reportValidity())return;button.disabled=true;status.textContent='Working…';try{await work(email);}catch(error){status.textContent=error.code==='invalid_credentials'?'Email or password is incorrect. If you joined with an email link, set a password below.':error.code==='email_not_confirmed'?'Confirm your email with the verification link first.':error.message||'Please try again.';}finally{button.disabled=false;}}
  form.onsubmit=async event=>{
   event.preventDefault();await action(submit,async email=>{
   try{
    const {data,error}=mode==='signup'?await client.auth.signUp({email,password:password.value,options:{emailRedirectTo:`${location.origin}/account`}}):await client.auth.signInWithPassword({email,password:password.value});
    if(error)throw error;
    if(data.session){password.value='';location.replace('/account');return;}
    if(mode==='signup'){pendingSignup={email,password:password.value};confirmed.hidden=false;password.value='';status.textContent=`Check ${email} for a verification link. After opening it, return to this tab and select “I verified my email — continue here.” Keep this tab open.`;}
    else status.textContent='Please check your email and try again.';
   }catch(error){throw error;}
   });
  };
  confirmed.onclick=event=>action(event.currentTarget,async()=>{if(!pendingSignup)return;const {data,error}=await client.auth.signInWithPassword(pendingSignup);if(error){if(error.code==='email_not_confirmed'){status.textContent='Your email is not verified yet. Open the verification link, then try again here.';return;}throw error;}pendingSignup=null;confirmed.hidden=true;if(data.session)location.replace('/account');});
  document.getElementById('login-email-link').onclick=event=>action(event.currentTarget,async email=>{const {error}=await client.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:`${location.origin}/account`}});if(error)throw error;status.textContent=`If ${email} has an account, a sign-in link is on its way.`;});
  document.getElementById('login-reset').onclick=event=>action(event.currentTarget,async email=>{const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:`${location.origin}/community/settings`});if(error)throw error;status.textContent=`If ${email} has an account, a password setup link is on its way.`;});
 }
 boot().catch(error=>{status.textContent=error.message||'Account sign-in is temporarily unavailable.';submit.disabled=true;});
}
