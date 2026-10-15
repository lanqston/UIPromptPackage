import {test,expect} from '@playwright/test';
const uid='e0000000-0000-4000-8000-000000000001',other='e0000000-0000-4000-8000-000000000002',postId='e0000000-0000-4000-8000-000000000010';
const url='https://cglkjclolglwizwepvmy.supabase.co';
const me={id:uid,handle:'test_builder',name:'Alex Morgan',bio:'Building useful things. Exploring AI, design, and everything in between.',website:'https://example.com',interests:['AI','Building'],avatar:'',cover:'',cover_theme:'sky'};
const peer={...me,id:other,handle:'test_creator',name:'Jordan Lee',cover_theme:'violet'};
// Isolated browser fixtures. No synthetic accounts or posts are sent to the real service.
for(const width of [390,1440])test(`Community member interactions and visual review ${width}`,async({page})=>{
 await page.setViewportSize({width,height:1000});
 const token=[{alg:'HS256',typ:'JWT'},{sub:uid,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600},'fixture'].map(v=>typeof v==='string'?v:Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');
 await page.addInitScript(({token,uid})=>{localStorage.setItem('digivated-community-welcome','seen');localStorage.setItem('sb-cglkjclolglwizwepvmy-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id:uid,email:'fixture@example.invalid',aud:'authenticated',role:'authenticated'}}));},{token,uid});
 let liked=false,saved=false,following=false,body='A small experiment turned into something useful. What have you been building this week?',edited=false,report=false,profileSaved:any=null;
 const post=()=>({id:postId,author_id:uid,author:me,body,kind:'post',image:'',project_url:'',created_at:'2026-10-15T00:00:00Z'});
 await page.route('**/api/community?action=config',r=>r.fulfill({json:{ready:true,url,key:'fixture-publishable',google:false}}));
 await page.route(`${url}/auth/v1/**`,r=>r.fulfill({json:{id:uid,email:'fixture@example.invalid',email_confirmed_at:'2026-10-15',aud:'authenticated',role:'authenticated'}}));
 await page.route(`${url}/rest/v1/**`,async r=>{
  const req=r.request(),u=new URL(req.url()),table=u.pathname.split('/').pop(),method=req.method();let data:any=[];
  if(table==='community_profiles'){
   if(method==='PATCH'||method==='POST'){profileSaved=req.postDataJSON();data=[];}
   else if(u.searchParams.get('id')?.startsWith('eq.'))data=me;
   else if(u.searchParams.has('handle'))data=peer;
   else data=[peer];
  }
  if(table==='community_posts'){
   if(method==='PATCH'){body=req.postDataJSON().body;edited=true;}
   else if(method==='HEAD')data=[];
   else if(u.searchParams.has('parent_id'))data=[];
   else if(u.searchParams.get('kind')==='eq.chat')data=[];
   else data=[post()];
  }
  if(table==='community_post_counts')data=[{post_id:postId,likes:liked?1:0,replies:0}];
  if(table==='community_likes'){if(method==='POST')liked=true;if(method==='DELETE')liked=false;data=liked?[{post_id:postId}]:[];}
  if(table==='community_bookmarks'){if(method==='POST')saved=true;if(method==='DELETE')saved=false;data=saved?[{post_id:postId}]:[];}
  if(table==='community_follows'){if(method==='POST')following=true;if(method==='DELETE')following=false;data=following?[{target_id:other}]:[];}
  if(table==='community_reports'&&method==='POST')report=true;
  await r.fulfill({status:200,json:data,headers:{'content-range':'0-0/1'}});
 });
 await page.goto('http://127.0.0.1:4321/community');
 await expect(page.locator('.community-post')).toHaveCount(1);
 await page.getByRole('button',{name:'Like post',exact:true}).click();await expect(page.getByRole('button',{name:'Unlike post',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Save post',exact:true}).click();await expect(page.getByRole('button',{name:'Unsave post',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.locator('.post-menu summary').click();await page.getByRole('button',{name:'Edit post',exact:true}).click();await page.locator('#edit-post-form textarea').fill('Edited with a clearer idea.');await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.locator('#community-feed')).toContainText('Edited with a clearer idea.');expect(edited).toBe(true);
 await page.getByRole('button',{name:'Read and add replies'}).click();await expect(page.locator('#reply-parent')).toContainText('Edited with a clearer idea.');await page.getByRole('button',{name:'Close replies'}).click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`test-results/community-feed-polished-${width}.png`,fullPage:true});
 await page.goto('http://127.0.0.1:4321/community/profile?handle=test_creator');await expect(page.locator('#community-profile')).toContainText('Jordan Lee');await page.getByRole('button',{name:'Follow',exact:true}).click();await expect(page.getByRole('button',{name:'Following · Unfollow'})).toBeVisible();
 await page.getByRole('button',{name:'Projects',exact:true}).click();await expect(page.locator('[data-profile-filter=project]')).toHaveAttribute('aria-pressed','true');
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`test-results/community-profile-polished-${width}.png`,fullPage:true});
 await page.goto('http://127.0.0.1:4321/community/members');await expect(page.locator('#member-results')).toContainText('Jordan Lee');await page.getByRole('searchbox',{name:'Search members'}).fill('Jordan');await page.getByRole('button',{name:'Search',exact:true}).click();await expect(page.locator('#member-results')).toContainText('Jordan Lee');
 await page.goto('http://127.0.0.1:4321/community/settings');await expect(page.locator('#settings-name')).toHaveText('Alex Morgan');await page.locator('.cover-choice[data-theme=sunset]').click();await page.getByRole('textbox',{name:'Display name',exact:true}).fill('Alex Creates');await expect(page.locator('#settings-name')).toHaveText('Alex Creates');await expect(page.locator('#settings-preview .member-cover')).toHaveAttribute('data-theme','sunset');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`test-results/community-settings-polished-${width}.png`,fullPage:true});
 await page.getByRole('button',{name:'Save profile',exact:true}).click();await expect.poll(()=>profileSaved?.cover_theme).toBe('sunset');
});
