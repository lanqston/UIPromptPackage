import { createClient } from '@supabase/supabase-js';
import { communityAuthOptions } from './community-auth.js';
const form = document.getElementById('project-form');
if (form) {
  let accountClient,accountVerified=false;
  const accountStatus=document.getElementById('submission-account-status');
  fetch('/api/project-account?action=config',{cache:'no-store'}).then(r=>r.json()).then(async config=>{
    if(!config.ready)return;
    accountClient=createClient(config.url,config.key,{auth:communityAuthOptions});
    const {data:{session}}=await accountClient.auth.getSession();
    if(session?.user?.email_confirmed_at){
      const response=await fetch('/api/project-account',{headers:{Authorization:`Bearer ${session.access_token}`},cache:'no-store'});
      if(response.ok){accountVerified=true;form.elements.email.value=session.user.email;form.elements.email.readOnly=true;document.getElementById('submission-account-callout').hidden=true;accountStatus.hidden=false;accountStatus.textContent=`Signed in as ${session.user.email}. This project will appear in your account.`;updateButton();}
      else {accountStatus.hidden=false;accountStatus.innerHTML='To submit a project, <a href="/login">sign in or create an account</a> first.';}
    }
  }).catch(()=>{accountStatus.hidden=false;accountStatus.textContent='Accounts are temporarily unavailable. Please try again shortly.';});
  const button = form.querySelector('button[type=submit]');
  const status = document.getElementById('submission-status');
  const intent = document.getElementById('submission-type');
  const promotionFields = document.getElementById('promotion-fields');
  const membershipFields = document.getElementById('membership-fields');
  const imageInput = document.getElementById('project-image');
  const imagePreview = document.getElementById('project-image-preview');
  const imagePreviewPicture = imagePreview?.querySelector('img');
  const imageName = document.getElementById('project-image-name');
  let imagePreviewUrl;
  const updateImagePreview = () => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    imagePreviewUrl = undefined;
    const file = imageInput?.files?.[0];
    imagePreview.hidden = !file;
    if (!file) { imagePreviewPicture.removeAttribute('src'); imageName.textContent = ''; return; }
    imageName.textContent = file.name;
    imagePreviewUrl = URL.createObjectURL(file);
    imagePreviewPicture.src = imagePreviewUrl;
  };
  imageInput?.addEventListener('change', updateImagePreview);
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
  const updateButton = () => { button.disabled = !accountVerified; button.textContent=accountVerified?'Submit Your Project':'Sign in to submit your project'; };
  updateButton();
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!accountVerified) { status.innerHTML='Please <a href="/login">sign in or create an account</a> before submitting.'; return; }
    if (!form.reportValidity()) return;
    button.disabled = true;
    status.textContent = 'Sending your project for review…';
    try {
      const values = new FormData(form);
      const payload = Object.fromEntries([...values].filter(([key])=>key!=='image'));
      payload.promotionPurchased = values.get('promotionPurchased') === 'on';
      payload.consent = values.get('consent') === 'on';
      payload.emailOutreachConsent = values.get('emailOutreachConsent') === 'on';
      const file = values.get('image');
      if (!file?.size) throw new Error('Add at least one project image.');
      if (file?.size) {
        if (file.size > 500 * 1024 || !['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG, or WebP image smaller than 500 KB.');
        payload.image = await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('The image could not be read. Try another file.'));reader.readAsDataURL(file);});
      }
      const {data:{session}}=await accountClient.auth.getSession();
      if(!session?.user?.email_confirmed_at)throw new Error('Your session expired. Sign in again before submitting.');
      const response = await fetch('/api/submissions', {method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',...(session?.user?.email_confirmed_at?{Authorization:`Bearer ${session.access_token}`}:{})},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});
      const data = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(data.error || 'Your project could not be submitted. Your details are still here; please try again.');
      const promotion = intent.value === 'promotion';
      const membership = intent.value === 'founding-feature';
      form.reset();if(session?.user?.email_confirmed_at)form.elements.email.value=session.user.email;syncIntent();updateImagePreview();
      status.textContent = (membership ? 'Your included feature request has been received. It is not public yet. Review is required, and a feature is not guaranteed.' : promotion ? 'Your promotion request has been received. We will check your Gumroad purchase and review your project before preparing a feature. Keep your receipt and watch your email for any questions. Your project is not public yet.' : 'Thank you — your project has been received for review. It is not public yet. Submitting does not guarantee a feature or repost.') + (session ? ' View its status and private feedback in Your Projects.' : ' To track future submissions, sign in before submitting.');
      status.focus();
    } catch (error) {
      status.textContent = error.name === 'TimeoutError' ? 'The response took too long. Your submission may have been received; please wait before trying again.' : (error.message || 'Unable to submit. Please try again.');
    } finally { updateButton(); }
  });
}
