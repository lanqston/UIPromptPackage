import { createClient } from '@supabase/supabase-js';
import { communityAuthOptions } from './community-auth.js';
const form = document.getElementById('project-form');
if (form) {
  let accountClient,accountVerified=false;
  fetch('/api/project-account?action=config',{cache:'no-store'}).then(r=>r.json()).then(async config=>{
    if(!config.ready)return;
    accountClient=createClient(config.url,config.key,{auth:communityAuthOptions});
    const {data:{session}}=await accountClient.auth.getSession();
    if(session?.user?.email_confirmed_at){
      const response=await fetch('/api/project-account',{headers:{Authorization:`Bearer ${session.access_token}`},cache:'no-store'});
      if(response.ok){accountVerified=true;form.elements.email.value=session.user.email;form.elements.email.readOnly=true;document.getElementById('submission-account-status').textContent=`Signed in as ${session.user.email}. This project will appear in your account.`;}
      else document.getElementById('submission-account-status').innerHTML='To track this project, <a href="/login">sign in with an emailed link</a> before submitting. You can still submit without an account.';
    }
  }).catch(()=>{});
  const button = form.querySelector('button[type=submit]');
  const status = document.getElementById('submission-status');
  const intent = document.getElementById('submission-type');
  const promotionFields = document.getElementById('promotion-fields');
  const membershipFields = document.getElementById('membership-fields');
  const syncIntent = () => {
    const promotion = intent.value === 'promotion';
    promotionFields.hidden = !promotion;
    if (membershipFields) membershipFields.hidden = intent.value !== 'founding-feature';
    for (const input of promotionFields.querySelectorAll('input')) { input.disabled = !promotion; input.required = promotion; }
  };
  const query = new URLSearchParams(location.search);
  if (query.get('promotion') === '1') intent.value = 'promotion';
  if (query.get('membership') === '1') intent.value = 'founding-feature';
  intent.addEventListener('change',syncIntent); syncIntent();
  button.disabled = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    button.disabled = true;
    status.textContent = 'Sending your project for review…';
    try {
      const values = new FormData(form);
      const payload = Object.fromEntries([...values].filter(([key])=>key!=='image'));
      payload.promotionPurchased = values.get('promotionPurchased') === 'on';
      payload.consent = values.get('consent') === 'on';
      const file = values.get('image');
      if (file?.size) {
        if (file.size > 500 * 1024 || !['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG, or WebP image smaller than 500 KB.');
        payload.image = await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('The image could not be read. Try another file.'));reader.readAsDataURL(file);});
      }
      const {data:{session}}=accountClient&&accountVerified?await accountClient.auth.getSession():{data:{session:null}};
      const response = await fetch('/api/submissions', {method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',...(session?.user?.email_confirmed_at?{Authorization:`Bearer ${session.access_token}`}:{})},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});
      const data = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(data.error || 'Your project could not be submitted. Your details are still here; please try again.');
      const promotion = intent.value === 'promotion';
      const membership = intent.value === 'founding-feature';
      form.reset();if(session?.user?.email_confirmed_at)form.elements.email.value=session.user.email;syncIntent();
      status.textContent = (membership ? 'Your included feature request has been received. It is not public yet. Review is required, and a feature is not guaranteed.' : promotion ? 'Your promotion request has been received. We will check your Gumroad purchase and review your project before preparing a feature. Keep your receipt and watch your email for any questions. Your project is not public yet.' : 'Thank you — your project has been received for review. It is not public yet. Submitting does not guarantee a feature or repost.') + (session ? ' View its status and private feedback in Your Projects.' : ' To track future submissions, sign in before submitting.');
      status.focus();
    } catch (error) {
      status.textContent = error.name === 'TimeoutError' ? 'The response took too long. Your submission may have been received; please wait before trying again.' : (error.message || 'Unable to submit. Please try again.');
    } finally { button.disabled = false; }
  });
}
