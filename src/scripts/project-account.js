import { accountSession } from './account-session.js';

const state=document.getElementById('account-state');
if(state){
 const form=document.getElementById('account-sign-in'),panel=document.getElementById('account-signed-in'),list=document.getElementById('account-submissions');
 const callback=new URLSearchParams(location.hash.slice(1));
 const arrivingFromEmail=callback.has('access_token');
 const callbackError=callback.get('error_description');
 const show=message=>{state.textContent=message;};
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 async function boot(){
  const {state:authState,client,session,email}=await accountSession();
  if(location.hash)history.replaceState(null,'',location.pathname+location.search);
  document.getElementById('account-sign-out').onclick=async()=>{const {error}=await client.auth.signOut();if(error){show('Could not sign out. Please try again.');return;}location.replace('/login');};
  if(authState==='signed-out'||authState==='unverified'){
   form.hidden=false;
   show(callbackError?'That link has expired or was already used. Request a new one below.':authState==='unverified'?'Use an emailed sign-in link to finish verifying this account.':'Sign in to view your projects. You can browse the site without an account.');
   return;
  }
  panel.hidden=false;
  document.getElementById('account-email').textContent=email||session?.user?.email||'';
  if(authState==='unavailable'){show('You have a session, but we could not verify your account right now. Please try again shortly.');list.textContent='Your submissions could not be loaded.';return;}
  if(arrivingFromEmail){location.replace('/discover?view=featured&signed_in=1');return;}
  show(`You're logged in as ${email}.`);
  try{
   const response=await fetch('/api/project-account',{headers:{Authorization:`Bearer ${session.access_token}`},cache:'no-store'});
   const data=await response.json();
   if(!response.ok){list.textContent=data.error||'Your submissions could not be loaded. Try again shortly.';return;}
   list.innerHTML=data.submissions.length?data.submissions.map(item=>`<article class="account-item"><h3>${escape(item.name)}</h3><p class="quiet">Submitted ${escape(new Date(item.date).toLocaleDateString())} · ${escape(item.status==='featured'?'Featured':item.status==='approved'?'Published':item.status==='rejected'?'Not selected':item.status==='archived'?'Archived':'In review')}</p>${item.feedback?`<p class="review-feedback"><strong>Review feedback</strong><br>${escape(item.feedback)}</p>`:'<p>There is no review feedback yet.</p>'}</article>`).join(''):'<p>No submissions are linked to this account yet. Browse featured projects or submit with this verified email to track your work here.</p>';
  }catch{list.textContent='Your submissions could not be loaded. Try again shortly.';}
 }
 boot().catch(error=>{if(location.hash)history.replaceState(null,'',location.pathname+location.search);form.hidden=false;show(error.message||'Accounts are temporarily unavailable.');});
}
