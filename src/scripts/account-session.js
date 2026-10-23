import { createClient } from '@supabase/supabase-js';
import { communityAuthOptions } from './community-auth.js';

let pending;
export function accountSession(){
 if(!pending)pending=(async()=>{
  const response=await fetch('/api/project-account?action=config',{cache:'no-store'});
  if(!response.ok)throw Error('Account sign-in is temporarily unavailable.');
  const config=await response.json();
  if(!config.ready)throw Error('Account sign-in is temporarily unavailable.');
  const client=createClient(config.url,config.key,{auth:communityAuthOptions});
  const {data:{session},error}=await client.auth.getSession();
  if(error)throw error;
  if(!session?.access_token)return {state:'signed-out',client,session:null};
  try{
   const check=await fetch('/api/project-account?action=me',{headers:{Authorization:`Bearer ${session.access_token}`},cache:'no-store'});
   if(check.ok){const data=await check.json();return {state:'signed-in',client,session,email:data.email};}
   return {state:check.status===401?'unverified':'unavailable',client,session};
  }catch{return {state:'unavailable',client,session};}
 })().catch(error=>{pending=null;throw error;});
 return pending;
}
