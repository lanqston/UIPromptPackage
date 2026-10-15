// Each request requires a 30-second, single-use capability issued after owner auth.
Deno.serve(async (req: Request) => {
 const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 try {
  if(req.method!=='POST') return reply(405,{error:'Method not allowed.'});
  const reader=req.body?.getReader();let raw='';
  if(!reader) return reply(401,{error:'Invalid grant.'});
  while(true){const {done,value}=await reader.read();if(done)break;if(raw.length+value.length>200){await reader.cancel();return reply(400,{error:'Invalid grant.'});}raw+=new TextDecoder().decode(value);}
  const {ticket}=JSON.parse(raw);
  if(!/^[a-f0-9]{64}$/.test(ticket||'')) return reply(401,{error:'Invalid grant.'});
  const verified=await fetch('https://digivated.vercel.app/api/community?action=moderation-ticket',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket}),signal:AbortSignal.timeout(8000)});
  if(!verified.ok)return reply(401,{error:'Invalid or expired grant.'});
  const {operation,id}=await verified.json();
  const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  let path='',method='GET',body: string|undefined;const headers:Record<string,string>={apikey:service,Authorization:`Bearer ${service}`,'Content-Type':'application/json'};
  if(operation==='list')path='community_reports?resolved=eq.false&order=created_at.desc&limit=100&select=*,post:community_posts(id,body,author_id,hidden)';
  else {
   if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id||''))return reply(401,{error:'Invalid grant.'});
   if(operation==='hide'||operation==='restore'){path=`community_posts?id=eq.${id}`;method='PATCH';body=JSON.stringify({hidden:operation==='hide'});}
   else if(operation==='resolve'){path=`community_reports?id=eq.${id}`;method='PATCH';body=JSON.stringify({resolved:true});}
   else if(operation==='suspend'){path='community_suspensions';method='POST';headers.Prefer='resolution=merge-duplicates';body=JSON.stringify({user_id:id});}
   else if(operation==='unsuspend'){path=`community_suspensions?user_id=eq.${id}`;method='DELETE';}
   else return reply(401,{error:'Invalid grant.'});
  }
  const result=await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/${path}`,{method,headers,body,signal:AbortSignal.timeout(8000)});
  if(!result.ok)return reply(503,{error:'Moderation is temporarily unavailable.'});
  return reply(200,operation==='list'?{reports:await result.json()}:{ok:true});
 }catch{return reply(503,{error:'Moderation is temporarily unavailable.'});}
});
