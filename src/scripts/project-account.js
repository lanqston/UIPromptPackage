import { createClient } from '@supabase/supabase-js';
import { communityAuthOptions } from './community-auth.js';

const state=document.getElementById('account-state');
if(state){
 const form=document.getElementById('account-sign-in'),panel=document.getElementById('account-signed-in'),list=document.getElementById('account-submissions');
 const show=message=>{state.textContent=message;};
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 async function boot(){
  const config=await fetch('/api/project-account?action=config',{cache:'no-store'}).then(r=>r.json());
  if(!config.ready){show('Account sign-in is temporarily unavailable. Please try again later.');return;}
  const client=createClient(config.url,config.key,{auth:communityAuthOptions});
  const callback=new URLSearchParams(location.hash.slice(1));
  const error=callback.get('error_description');
  const arrivingFromEmail=callback.has('access_token');
  const {data:{session},error:sessionError}=await client.auth.getSession();
  if(location.hash)history.replaceState(null,'',location.pathname);
  if(error||sessionError)show('That link has expired or was already used. Request a new one below.');
  if(!session?.user?.email_confirmed_at){form.hidden=false;if(!error&&!sessionError)show('Sign in to view your projects.');}
  else {
   document.getElementById('account-email').textContent=session.user.email;
   panel.hidden=false;show('Your email is verified.');
   const response=await fetch('/api/project-account',{headers:{Authorization:`Bearer ${session.access_token}`},cache:'no-store'});
   const data=await response.json();
   if(!response.ok){panel.hidden=true;form.hidden=false;show(data.error||'Could not load your submissions. Request a new sign-in link.');}
   else if(arrivingFromEmail){location.replace('/discover?view=featured');return;}
   else list.innerHTML=data.submissions.length?data.submissions.map(item=>`<article class="account-item"><h3>${escape(item.name)}</h3><p class="quiet">Submitted ${escape(new Date(item.date).toLocaleDateString())} · ${escape(item.status==='featured'?'Featured':item.status==='approved'?'Published':item.status==='rejected'?'Not selected':item.status==='archived'?'Archived':'In review')}</p>${item.feedback?`<p class="review-feedback"><strong>Review feedback</strong><br>${escape(item.feedback)}</p>`:'<p>There is no review feedback yet.</p>'}</article>`).join(''):'<p>No submissions are linked to this account yet. Browse featured projects or submit with this verified email to track your work here.</p>';
  }
  form.onsubmit=async event=>{event.preventDefault();const button=event.submitter,email=form.elements.email.value.trim();button.disabled=true;show('Sending your sign-in link…');try{const {error:sendError}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:`${location.origin}/account`}});if(sendError)throw sendError;show(`If the address can receive mail, a sign-in link is on its way to ${email}.`);}catch(e){show(e.message||'Unable to send a link. Try again.');}finally{button.disabled=false;}};
  document.getElementById('account-sign-out').onclick=async()=>{await client.auth.signOut();location.href='/account';};
 }
 boot().catch(e=>{form.hidden=false;show(e.message||'Accounts are temporarily unavailable.');});
}
