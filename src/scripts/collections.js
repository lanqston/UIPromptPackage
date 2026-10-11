import { createCollectionStore, initialCollections, collectionName, itemKey, mergeCollections, validateCollections, STORAGE_KEY } from '../lib/collections.mjs';
const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
let store, problem='';
try{store=createCollectionStore(localStorage);}catch(error){problem=error.message;}
const snapshot=()=>store?.get()||initialCollections();
const saved=item=>snapshot().collections.some(c=>c.items.some(i=>itemKey(i)===itemKey(item)));
const buttonItem=button=>({type:button.dataset.saveType,id:button.dataset.saveId});
function refreshButtons(){document.querySelectorAll('[data-save-id]').forEach(button=>{const yes=saved(buttonItem(button));if(button.textContent!==(yes?'Saved':'Save'))button.textContent=yes?'Saved':'Save';button.setAttribute('aria-label',yes?'Saved — choose collections':'Save to collection');button.setAttribute('aria-haspopup','dialog');});}
function updateButtons(){refreshButtons();}
const additions=new MutationObserver(updateButtons);additions.observe(document.body,{childList:true,subtree:true});
// Labels only change when necessary, so observer callbacks settle immediately.
function message(text){const node=document.getElementById('saved-status');if(node)node.textContent=text;}
async function change(fn){
  const run=()=>{if(!store)throw new Error(problem);store.update(fn);updateButtons();};
  if(navigator.locks)await navigator.locks.request('digivated-collections',run);else run();
}
const dialog=el('dialog',undefined,'collection-dialog');dialog.setAttribute('aria-labelledby','collection-title');document.body.append(dialog);
let selectedItem, returnFocus;
function picker(item,trigger){
 selectedItem=item;returnFocus=trigger;renderPicker();dialog.showModal();
}
function renderPicker(){
 dialog.replaceChildren();const title=el('h2','Save to collections');title.id='collection-title';dialog.append(title,el('p','Private to this browser. No account or cross-device sync.','quiet'));
 const status=el('p',problem);status.setAttribute('role','status');
 const group=el('div',undefined,'collection-options');
 for(const c of snapshot().collections){const label=el('label');const input=el('input');input.type='checkbox';input.checked=c.items.some(i=>itemKey(i)===itemKey(selectedItem));input.disabled=!store;label.append(input,document.createTextNode(`${c.name} (${c.items.length})`));group.append(label);
 input.addEventListener('change',async()=>{const checked=input.checked;input.disabled=true;try{await change(data=>{const target=data.collections.find(x=>x.id===c.id);if(!target)throw new Error('This collection was removed in another tab. Reopen the picker.');target.items=target.items.filter(i=>itemKey(i)!==itemKey(selectedItem));if(checked)target.items.push(selectedItem);});status.textContent='Saved in this browser.';await renderSaved();}catch(error){input.checked=!checked;status.textContent=error.message;}finally{input.disabled=false;}});}
 dialog.append(group);
 const form=el('form');const label=el('label','New collection');const input=el('input');input.name='name';input.maxLength=60;input.required=true;label.append(input);const create=el('button','Create collection','button');create.type='submit';create.disabled=!store;form.append(label,create);
 form.addEventListener('submit',async event=>{event.preventDefault();try{const name=collectionName(input.value);await change(data=>{if(data.collections.some(c=>c.name.toLowerCase()===name.toLowerCase()))throw new Error('A collection with this name already exists.');data.collections.push({id:crypto.randomUUID(),name,items:[selectedItem]});});renderPicker();await renderSaved();}catch(error){status.textContent=error.message;}});
 const done=el('button','Done','button');done.type='button';done.addEventListener('click',()=>dialog.close());dialog.append(form,status,done);
}
dialog.addEventListener('close',()=>returnFocus?.focus());
document.addEventListener('click',event=>{const trigger=event.target.closest('[data-save-id]');if(!trigger)return;event.preventDefault();event.stopPropagation();picker(buttonItem(trigger),trigger);});
window.addEventListener('storage',event=>{if(event.key!==STORAGE_KEY)return;try{store?.refresh();updateButtons();renderSaved();}catch(error){message(error.message);}});
const root=document.getElementById('saved-root');let active='saved', resolved=new Map(), loadGeneration=0;
async function resolveItems(){
 if(!root)return;const generation=++loadGeneration;resolved=new Map();const items=new Map(snapshot().collections.flatMap(c=>c.items).map(i=>[itemKey(i),i]));
 await Promise.all(Array.from({length:Math.min(6,items.size)},async()=>{while(items.size){const [key,item]=items.entries().next().value;items.delete(key);try{const response=await fetch(`/api/saved-item?type=${item.type}&id=${encodeURIComponent(item.id)}`,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(10000)});if(generation!==loadGeneration)return;resolved.set(key,response.ok?(await response.json()).item:{unavailable:response.status===404,error:response.status!==404});}catch{resolved.set(key,{error:true});}}}));
 if(generation===loadGeneration)await renderSaved();
}
async function renderSaved(){
 if(!root)return;
 const data=snapshot();if(!data.collections.some(c=>c.id===active))active='saved';const current=data.collections.find(c=>c.id===active);
 const nav=document.getElementById('saved-folders');nav.replaceChildren();
 for(const c of data.collections){const button=el('button',`${c.name} (${c.items.length})`,'button');button.type='button';button.setAttribute('aria-pressed',String(c.id===active));button.addEventListener('click',()=>{active=c.id;renderSaved();});nav.append(button);}
 document.getElementById('saved-heading').textContent=current.name;
 document.getElementById('rename-collection').hidden=active==='saved';document.getElementById('delete-collection').hidden=active==='saved';
 const query=document.getElementById('saved-search').value.toLowerCase().trim(), type=document.getElementById('saved-type').value;
 const list=document.getElementById('saved-items');list.replaceChildren();let shown=0;
 for(const item of current.items){const detail=resolved.get(itemKey(item));if(type&&item.type!==type)continue;if(query&&!(detail?.title||'Unavailable item').toLowerCase().includes(query))continue;shown++;
 const card=el('article',undefined,'saved-card');card.append(el('span',item.type,'tag'));const heading=el('h3');
 if(detail?.title){const link=el('a',detail.title);link.href=detail.url;heading.append(link);card.append(heading,el('p',detail.description));}
 else card.append(el('h3',detail?.error?'Could not load item':detail?.unavailable?'Item no longer available':'Loading saved item…'),el('p',detail?.error?'Try refreshing. Your saved reference is safe.':'Unpublished or deleted content is not stored in your collections.'));
 const remove=el('button','Remove from this collection','button');remove.type='button';remove.addEventListener('click',async()=>{try{await change(data=>{const c=data.collections.find(c=>c.id===active);c.items=c.items.filter(i=>itemKey(i)!==itemKey(item));});await renderSaved();message('Removed from this collection.');document.getElementById('saved-heading').focus();}catch(error){message(error.message);}});card.append(remove);list.append(card);
 }
 document.getElementById('saved-empty').hidden=shown>0;document.getElementById('saved-empty').textContent=current.items.length?'No saved items match these filters.':'Nothing saved here yet. Explore projects and resources, then choose Save.';
 if(problem)message(problem);
}
if(root){
 for(const id of ['saved-search','saved-type'])document.getElementById(id).addEventListener('input',renderSaved);
 const manage=document.getElementById('collection-manager'),form=document.getElementById('collection-manager-form'),name=document.getElementById('collection-name');let mode='create';
 document.getElementById('new-collection').addEventListener('click',()=>{mode='create';name.value='';manage.showModal();});
 document.getElementById('rename-collection').addEventListener('click',()=>{mode='rename';name.value=snapshot().collections.find(c=>c.id===active).name;manage.showModal();});
 document.getElementById('cancel-collection').addEventListener('click',()=>manage.close());
 form.addEventListener('submit',async event=>{event.preventDefault();try{const value=collectionName(name.value);await change(data=>{if(data.collections.some(c=>c.name.toLowerCase()===value.toLowerCase()&&(mode==='create'||c.id!==active)))throw new Error('A collection with this name already exists.');if(mode==='create'){active=crypto.randomUUID();data.collections.push({id:active,name:value,items:[]});}else data.collections.find(c=>c.id===active).name=value;});manage.close();renderSaved();message('Collection saved.');}catch(error){document.getElementById('collection-manager-status').textContent=error.message;}});
 document.getElementById('delete-collection').addEventListener('click',async()=>{if(!confirm('Delete this collection? The original projects and resources will remain.'))return;try{await change(data=>{data.collections=data.collections.filter(c=>c.id!==active);});renderSaved();message('Collection deleted. Original content is unchanged.');}catch(error){message(error.message);}});
 document.getElementById('export-collections').addEventListener('click',()=>{try{const raw=store?JSON.stringify(snapshot(),null,2):localStorage.getItem(STORAGE_KEY);if(!raw)throw new Error('No readable collection data is available to export.');const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));const a=el('a');a.href=url;a.download='digivated-collections.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('Backup exported. It contains folder names and item references only.');}catch(error){message(error.message);}});
 document.getElementById('import-collections').addEventListener('change',async event=>{try{const file=event.target.files[0];if(!file)return;if(file.size>1000000)throw new Error('Choose a JSON backup smaller than 1 MB.');const incoming=validateCollections(JSON.parse(await file.text()));await change(data=>{Object.assign(data,mergeCollections(data,incoming));});message('Backup merged. Existing collections are preserved.');renderSaved();await resolveItems();}catch(error){message(error instanceof SyntaxError?'Invalid JSON backup. Existing collections are unchanged.':error.message);}finally{event.target.value='';}});
 document.getElementById('refresh-saved').addEventListener('click',resolveItems);
 renderSaved();resolveItems();
}
updateButtons();
