import { projectCategories, resourceCategories } from '../data/community.mjs';
const $ = id => document.getElementById(id);
const state = { csrf: '', kind: 'submission', items: [], next: null, record: null, dirty: false, busy: false, request: 0, editorRequest: 0 };
const labels = { submission: 'Submissions', resource: 'Articles', product: 'Products' };
const statusOptions = { submission: ['pending','approved','featured','rejected','archived'], resource: ['draft','published','archived'], product: ['draft','published','archived'] };
const element = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; };
function message(text, editor = false) { const node = $(editor ? 'owner-editor-status' : 'owner-status'); node.textContent = text; }
function signedOut() { state.csrf = ''; state.items = []; state.record = null; state.dirty = false; $('owner-editor').close(); $('owner-fields').replaceChildren(); $('owner-private-details').replaceChildren(); $('owner-list').replaceChildren(); $('owner-dashboard').hidden = true; $('owner-login').hidden = false; $('owner-logout').hidden = true; }
async function api(path = '', body) {
  const response = await fetch(`/api/admin${path}`, { method: body ? 'POST' : 'GET', cache: 'no-store', credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json', 'X-Admin-CSRF': state.csrf } : {}, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { if (response.status === 401 && body?.action !== 'login') signedOut(); throw new Error(data.error || 'The request could not be completed. Try again.'); }
  return data;
}
function errorText(error) { return error.name === 'TimeoutError' ? 'The request timed out. Refresh to check whether your change was saved before trying again.' : error.message || 'Something went wrong. Please try again.'; }
function filters() {
  const select = $('owner-filter'); select.replaceChildren(new Option('All statuses',''));
  statusOptions[state.kind].forEach(status => select.add(new Option(status[0].toUpperCase()+status.slice(1),status)));
  $('owner-create').hidden = state.kind === 'submission';
  $('owner-create').textContent = state.kind === 'resource' ? 'New article' : 'New product';
  $('owner-protected').hidden = state.kind !== 'product';
}
function renderList() {
  const query = $('owner-search').value.trim().toLowerCase(); const status = $('owner-filter').value;
  const items = state.items.filter(r => (!status || r.status === status) && `${r.title || r.name} ${r.creator || ''}`.toLowerCase().includes(query));
  const list = $('owner-list'); list.replaceChildren();
  for (const record of items) {
    const row = element('article', undefined, 'owner-row'); const copy = element('div');
    copy.append(element('span', record.status, 'tag')); if (record.pick) copy.append(element('span','Digivated Pick','tag'));
    copy.append(element('h2', record.title || record.name)); copy.append(element('p', [record.creator,record.category,record.date?.slice(0,10)].filter(Boolean).join(' · '),'quiet'));
    const edit = element('button', state.kind === 'submission' ? 'Review project' : 'Edit', 'button'); edit.type = 'button'; edit.addEventListener('click', () => openRecord(record.id));
    row.append(copy,edit); list.append(row);
  }
  $('owner-count').textContent = `${items.length} shown · ${state.items.length} ${labels[state.kind].toLowerCase()} loaded`;
  $('owner-empty').hidden = items.length > 0; $('owner-more').hidden = state.next === null;
}
async function load(more = false) {
  const request = ++state.request; const kind = state.kind;
  message('Loading your content…'); $('owner-more').disabled = true;
  try {
    const data = await api(`?action=list&kind=${kind}&offset=${more ? state.next : 0}`);
    if (request !== state.request) return;
    state.items = more ? [...state.items,...data.items] : data.items; state.next = data.next; renderList(); message('');
  } catch (error) { message(errorText(error)); }
  finally { $('owner-more').disabled = false; }
}
function signedIn(csrf) { state.csrf = csrf; $('owner-password').value = ''; $('owner-login').hidden = true; $('owner-dashboard').hidden = false; $('owner-logout').hidden = false; filters(); return load(); }
const form = $('owner-login-form'); form.querySelector('button').disabled = false;
form.addEventListener('submit', async event => {
  event.preventDefault(); const button = form.querySelector('button'); button.disabled = true; message('Signing in…');
  try { const data = await api('',{ action:'login',password:$('owner-password').value }); await signedIn(data.csrf); }
  catch (error) { message(errorText(error)); } finally { $('owner-password').value = ''; button.disabled = false; }
});
$('owner-logout').addEventListener('click', async () => {
  if (state.busy || (state.dirty && !confirm('Discard unsaved changes and sign out?'))) return;
  try { await api('',{action:'logout'}); signedOut(); message('You have signed out.'); } catch (error) { message(errorText(error)); }
});
document.querySelectorAll('[data-kind]').forEach(button => button.addEventListener('click', () => {
  state.kind = button.dataset.kind; state.items = []; state.next = null; $('owner-search').value = '';
  document.querySelectorAll('[data-kind]').forEach(b => b.setAttribute('aria-pressed',String(b===button))); filters(); renderList(); load();
}));
$('owner-search').addEventListener('input',renderList); $('owner-filter').addEventListener('change',renderList); $('owner-refresh').addEventListener('click',()=>load()); $('owner-more').addEventListener('click',()=>load(true));
function field(name,label,value,options={}) {
  const wrapper=element('label',label); let input;
  if(options.choices){input=element('select');options.choices.forEach(choice=>input.add(new Option(choice,choice)));}
  else input=element(options.rows?'textarea':'input');
  input.name=name; input.id=`edit-${name}`; if(input.tagName==='INPUT')input.type=options.type||'text';
  if(options.rows)input.rows=options.rows;if(options.max)input.maxLength=options.max;if(options.min)input.min=options.min;if(options.maxNumber)input.max=options.maxNumber;
  input.required=options.required!==false; input.value=value??''; input.readOnly=options.readonly||false;
  if(options.type==='checkbox'){wrapper.className='owner-inline-check';input.required=false;input.value='on';input.checked=value===true;}
  if(options.type==='file'){input.required=false;input.accept='image/png,image/jpeg,image/webp';}
  wrapper.append(input);if(options.help)wrapper.append(element('span',options.help,'field-help'));$('owner-fields').append(wrapper);return input;
}
function renderEditor(record) {
  state.record=record; state.dirty=false; $('owner-fields').replaceChildren(); $('owner-private-details').replaceChildren(); $('owner-editor-actions').replaceChildren(); message('',true);
  $('owner-editor-title').textContent=state.kind==='submission'?'Review project':record.revision?`Edit ${state.kind==='resource'?'article':'product'}`:`New ${state.kind==='resource'?'article':'product'}`;
  if(state.kind==='submission'){
    const details=element('section',undefined,'owner-private');details.append(element('p','Private review details','eyebrow'));
    for(const [label,value] of [['Email',record.email],['Social handle',record.social],['Notes',record.notes],['Permission',record.consent?'Confirmed':'Not confirmed'],['Submitted',record.date]])if(value)details.append(element('p',`${label}: ${value}`));
    const link=element('a','Visit submitted project →');link.href=record.url;link.target='_blank';link.rel='noopener noreferrer';details.append(link);$('owner-private-details').append(details);
    field('name','Project name',record.name,{max:120});field('creator','Creator name',record.creator,{max:100});field('url','Project URL',record.url,{type:'url',max:500});field('description','Public description',record.description,{rows:4,max:600});field('category','Category',record.category,{choices:projectCategories});field('socialUrl','Creator profile URL',record.socialUrl,{type:'url',max:500,required:false,help:'Use the complete profile link after verifying the submitted handle.'});
    field('pick','Digivated Pick',record.pick,{type:'checkbox'});
  }else{
    field('id',state.kind==='resource'?'Article URL slug':'Product identifier',record.id,{max:100,readonly:!!record.revision,help:'Lowercase letters, numbers and hyphens. This stays fixed after the first save.'});
    field(state.kind==='resource'?'title':'name',state.kind==='resource'?'Article title':'Product name',record.title||record.name,{max:160});field('description','Short description',record.description,{rows:3,max:600});
    if(state.kind==='resource'){
      field('category','Category',record.category||'Tech',{choices:resourceCategories});field('publishedDate','Publication date',record.publishedDate||new Date().toISOString().slice(0,10),{type:'date'});field('readingTime','Reading time (minutes)',record.readingTime||3,{type:'number',min:1,maxNumber:180});field('content','Article content',record.content,{rows:14,max:50000,help:'Use blank lines between paragraphs. Start a line with ## for a section heading. HTML is displayed as text.'});field('related','Related article slugs',(record.related||[]).join(', '),{required:false,max:1200,help:'Optional, comma-separated slugs of published articles.'});
    }else{field('url','Existing product page URL',record.url,{type:'url',max:500,help:'Link to the product’s existing page. This does not create or change a checkout.'});field('label','Short product label',record.label,{required:false,max:160});}
    field('upload','Cover image (optional)','',{type:'file',required:false,help:'JPG, PNG, or WebP, up to 500 KB.'});
  }
  if(record.image){const image=element('img',undefined,'owner-editor-image');image.src=record.image;image.alt='Submitted image preview';$('owner-fields').append(image);field('removeImage','Remove image',false,{type:'checkbox'});}
  field('status','Status',record.status,{choices:statusOptions[state.kind]});
  const save=element('button','Save changes','button primary');save.type='submit';save.value='save';$('owner-editor-actions').append(save);
  if(state.kind==='submission')for(const [status,label] of [['approved','Approve & publish'],['featured','Make Featured Build'],['rejected','Reject'],['archived','Archive']]){
    const button=element('button',label,'button');button.type='submit';button.value=status;button.disabled=status==='featured'&&!['approved','featured'].includes(record.status);$('owner-editor-actions').append(button);
  }
  else {const button=element('button','Publish','button');button.type='submit';button.value='published';$('owner-editor-actions').append(button);}
  $('owner-editor-actions').append(element('p','Saving an approved or published item updates the public site. Drafts, pending, rejected, and archived items stay private.','quiet'));
}
async function openRecord(id){const kind=state.kind;const request=++state.editorRequest;message('Opening item…');try{const data=await api(`?action=detail&kind=${kind}&id=${encodeURIComponent(id)}`);if(kind!==state.kind||request!==state.editorRequest||!state.csrf)return;renderEditor(data.record);$('owner-editor').showModal();message('');}catch(error){message(errorText(error));}}
$('owner-create').addEventListener('click',()=>{renderEditor({id:'',revision:0,status:'draft'});$('owner-editor').showModal();});
$('owner-editor-form').addEventListener('input',()=>state.dirty=true);
function closeEditor(event){if(state.busy){event?.preventDefault();return;}if(state.dirty&&!confirm('Discard unsaved changes?')){event?.preventDefault();return;}$('owner-editor').close();state.dirty=false;state.record=null;$('owner-fields').replaceChildren();$('owner-private-details').replaceChildren();}
$('owner-close').addEventListener('click',closeEditor);$('owner-editor').addEventListener('cancel',event=>{event.preventDefault();closeEditor(event);});
window.addEventListener('beforeunload',event=>{if(state.dirty){event.preventDefault();event.returnValue='';}});
$('owner-editor-form').addEventListener('submit',async event=>{
  event.preventDefault();if(state.busy)return;state.busy=true;const buttons=[...$('owner-editor-actions').querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);message('Saving…',true);
  try{
    const formData=new FormData(event.currentTarget);const record=Object.fromEntries([...formData].filter(([name])=>name!=='upload'));
    record.id=state.kind==='submission'?state.record.id:record.id;record.revision=state.record.revision||0;record.pick=formData.get('pick')==='on';record.removeImage=formData.get('removeImage')==='on';
    if(event.submitter?.value&&event.submitter.value!=='save')record.status=event.submitter.value;
    const file=formData.get('upload');if(file?.size){if(file.size>500*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Use a JPG, PNG, or WebP image up to 500 KB.');record.image=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Could not read image.'));reader.readAsDataURL(file);});}
    const data=await api('',{action:'save',kind:state.kind,record});renderEditor(data.record);state.dirty=false;message(['approved','featured','published'].includes(data.record.status)?'Saved. This item is now public.':'Saved. This item is not public.',true);await load();
  }catch(error){message(errorText(error),true);if(!state.csrf)message(errorText(error));}
  finally{state.busy=false;$('owner-editor-actions').querySelectorAll('button').forEach(button=>button.disabled=button.value==='featured'&&!['approved','featured'].includes(state.record?.status));}
});
api().then(data=>signedIn(data.csrf)).catch(error=>{signedOut();message(error.message.includes('Sign in')?'':errorText(error));});
