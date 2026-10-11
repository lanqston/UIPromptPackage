const status = document.querySelector('[data-share-status]');
const url = location.origin + location.pathname;
document.querySelector('[data-copy-link]')?.addEventListener('click',async()=>{
  try { await navigator.clipboard.writeText(url); status.textContent='Link copied.'; }
  catch { status.replaceChildren(document.createTextNode('Copy this link: '));const input=document.createElement('input');input.value=url;input.readOnly=true;input.setAttribute('aria-label','Project link');status.append(input);input.focus();input.select(); }
});
const share=document.querySelector('[data-native-share]');
if(share && navigator.share){share.hidden=false;share.addEventListener('click',async()=>{try{await navigator.share({title:document.title,url});status.textContent='';}catch(error){if(error.name!=='AbortError')status.textContent='Sharing is unavailable. Use Copy link instead.';}});}
document.querySelectorAll('.launch-shot img').forEach(img=>img.addEventListener('error',()=>{const note=document.createElement('p');note.textContent='Screenshot currently unavailable.';img.replaceWith(note);},{once:true}));
