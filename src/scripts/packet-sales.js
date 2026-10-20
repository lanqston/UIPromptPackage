const copyButton = document.querySelector('[data-copy-packet-prompt]');
copyButton?.addEventListener('click',async()=>{
  const prompt=document.getElementById('packet-example-prompt');
  const status=document.querySelector('[data-packet-copy-status]');
  try {await navigator.clipboard.writeText(prompt.value);status.textContent='Copied. Paste it into your AI tool with a screenshot.';}
  catch {prompt.focus();prompt.select();status.textContent='Select Copy on your device to copy the highlighted prompt.';}
});

const form=document.querySelector('[data-packet-feedback]');
if(form){
 const button=form.querySelector('button[type="submit"]'),status=form.querySelector('[data-packet-feedback-status]');
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(!form.reportValidity())return;
  const values=new FormData(form);
  if(values.get('company'))return;
  const comment=[`Tried: ${String(values.get('task')).trim()}`,`Result: ${String(values.get('outcome')).trim()}`,values.get('difficulty')?`Still unclear: ${String(values.get('difficulty')).trim()}`:''].filter(Boolean).join('\n');
  button.disabled=true;status.textContent='Sending your feedback…';
  try {
   const response=await fetch('/api/card-interactions',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'feedback',type:'resource',id:'builtin-ui-ux-prompt-packet',name:String(values.get('name')||'').trim(),comment,quoteConsent:values.get('quoteConsent')==='on'}),signal:AbortSignal.timeout(15000)});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||'Feedback could not be saved. Your text is still here; try again later.');
   status.textContent=data.message;form.reset();
  } catch(error){status.textContent=error.name==='TimeoutError'?'The request timed out. Your text is still here. Wait before trying again because it may have arrived.':error.message||'Feedback could not be saved. Your text is still here; try again later.';}
  finally {button.disabled=false;}
 });
 button.disabled=false;
}

// Display only server-approved, explicitly consented feedback. Never invent placeholders.
const quotes=document.querySelector('[data-packet-quotes]');
if(quotes)fetch('/api/card-interactions?type=resource&id=builtin-ui-ux-prompt-packet',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000)}).then(async response=>{
 if(!response.ok)return;const data=await response.json();const approved=(data.comments||[]).filter(entry=>entry.quote===true).slice(0,3);
 const list=quotes.querySelector('[data-packet-quote-list]');
 for(const entry of approved){const figure=document.createElement('figure'),quote=document.createElement('blockquote'),name=document.createElement('figcaption');quote.textContent=entry.body;name.textContent=entry.name;figure.append(quote,name);list.append(figure);}
 quotes.hidden=!approved.length;
}).catch(()=>{});
