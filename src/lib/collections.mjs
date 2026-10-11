export const STORAGE_KEY = 'digivated.collections';
export const initialCollections = () => ({ version:1, collections:[{id:'saved',name:'Saved items',items:[]}] });
export const itemKey = item => `${item.type}:${item.id}`;
export function collectionName(value) {
  if(typeof value!=='string'||!value.trim()||value.trim().length>60||/[\u0000-\u001f]/.test(value))throw new Error('Use a collection name of 1–60 characters.');
  return value.trim();
}
export function validateCollections(data) {
  if(!data||data.version!==1||!Array.isArray(data.collections)||data.collections.length>100)throw new Error('This backup format is not supported. Your existing collections are unchanged.');
  const ids=new Set();let count=0;
  const collections=data.collections.map(c=>{
    if(!c||typeof c.id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(c.id)||ids.has(c.id)||!Array.isArray(c.items))throw new Error('Invalid collection in backup.');
    ids.add(c.id);const seen=new Set();const items=[];
    for(const item of c.items){
      if(!item||!['project','resource'].includes(item.type)||typeof item.id!=='string'||!/^[a-z0-9][a-z0-9-]{0,99}$/.test(item.id))throw new Error('Invalid saved item in backup.');
      const key=itemKey(item);if(!seen.has(key)){seen.add(key);items.push({type:item.type,id:item.id});count++;}
    }
    return {id:c.id,name:c.id==='saved'?'Saved items':collectionName(c.name),items};
  });
  if(count>5000)throw new Error('Collections can contain up to 5,000 saved entries.');
  if(!ids.has('saved'))collections.unshift(initialCollections().collections[0]);
  if(collections.length>100)throw new Error('You can have up to 100 collections.');
  return {version:1,collections};
}
export function mergeCollections(existing, incoming) {
  const result=structuredClone(validateCollections(existing));
  for(const collection of validateCollections(incoming).collections){
    const match=result.collections.find(c=>c.id===collection.id&&c.name===collection.name);
    if(match){const keys=new Set(match.items.map(itemKey));for(const item of collection.items)if(!keys.has(itemKey(item))){match.items.push(item);keys.add(itemKey(item));}}
    else result.collections.push({...collection,id:result.collections.some(c=>c.id===collection.id)?crypto.randomUUID():collection.id});
  }
  return validateCollections(result);
}
export function createCollectionStore(storage) {
  let raw, state;
  const read=()=>{let value;try{value=storage.getItem(STORAGE_KEY);}catch{throw new Error('Browser storage is unavailable. Enable site storage to save collections.');}let parsed;try{parsed=value===null?initialCollections():validateCollections(JSON.parse(value));}catch{throw new Error('Saved data could not be read. It has not been overwritten. Export a backup before resetting browser storage.');}return {value,parsed};};
  ({value:raw,parsed:state}=read());
  return {
    get:()=>structuredClone(state),
    refresh(){({value:raw,parsed:state}=read());return this.get();},
    update(change){
      const latest=read();if(latest.value!==raw){raw=latest.value;state=latest.parsed;}
      const next=structuredClone(state);change(next);const validated=validateCollections(next);const json=JSON.stringify(validated);
      try{storage.setItem(STORAGE_KEY,json);}catch{throw new Error('Could not save: browser storage is full or unavailable. Your previous collections are unchanged. Export a backup and try again.');}
      state=validated;raw=json;return this.get();
    }
  };
}
