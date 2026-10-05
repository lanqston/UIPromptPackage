const form = document.getElementById('project-form');
if (form) {
  const button = form.querySelector('button[type=submit]');
  const status = document.getElementById('submission-status');
  button.disabled = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    button.disabled = true;
    status.textContent = 'Sending your project for review…';
    try {
      const values = new FormData(form);
      const payload = Object.fromEntries([...values].filter(([key])=>key!=='image'));
      payload.consent = values.get('consent') === 'on';
      const file = values.get('image');
      if (file?.size) {
        if (file.size > 500 * 1024 || !['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG, or WebP image smaller than 500 KB.');
        payload.image = await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('The image could not be read. Try another file.'));reader.readAsDataURL(file);});
      }
      const response = await fetch('/api/submissions', {method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});
      const data = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(data.error || 'Your project could not be submitted. Your details are still here; please try again.');
      form.reset();
      status.textContent = 'Thank you — your project has been received for review. It is not public yet. Submitting does not guarantee a feature or repost.';
      status.focus();
    } catch (error) {
      status.textContent = error.name === 'TimeoutError' ? 'The response took too long. Your submission may have been received; please wait before trying again.' : (error.message || 'Unable to submit. Please try again.');
    } finally { button.disabled = false; }
  });
}
