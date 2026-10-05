import { test, expect } from '@playwright/test';
import { makeSubmissionHandler } from '../../server/submissions.mjs';
const base='http://127.0.0.1:4321';
const routes=['/','/discover','/resources','/products','/submit-project','/about','/ui-ux-prompt-packet','/access','/library'];
for(const width of [375,768,1440]){
 test(`platform and protected purchase pages fit ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/edition',r=>r.fulfill({status:401,contentType:'application/json',body:'{"code":"invalid_access","error":"Please activate your purchase."}'}));
  await page.route('**/api/visitors',r=>r.fulfill({contentType:'application/json',body:'{"status":"unconfigured"}'}));
  for(const route of routes){
   const response=await page.goto(base+route);expect(response?.status()).toBe(200);
   await expect(page.locator('h1')).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route).toBe(true);
   for(const image of await page.locator('img').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(()=>image.evaluate(i=>(i as HTMLImageElement).complete&&(i as HTMLImageElement).naturalWidth>0)).toBe(true);
   }
   if(route==='/ui-ux-prompt-packet'){
    const buy=page.locator('.purchase-link');await expect(buy).toBeVisible();
    await expect(buy).toHaveAttribute('href','https://mccovery.gumroad.com/l/ui-prompt-package');
    await buy.click({trial:true}); // Visibility, position, and overlay hit-testing.
   }
  }
  expect(errors).toEqual([]);
 });
}
test('mobile navigation, directory filters, and preserved product link',async({page})=>{
 await page.setViewportSize({width:375,height:812});await page.goto(base);
 await page.locator('.mobile-menu summary').click();
 await page.getByRole('navigation',{name:'Mobile navigation',exact:true}).getByRole('link',{name:'Discover',exact:true}).click();
 await expect(page).toHaveURL(/\/discover/);await page.getByLabel('Search projects').fill('nonexistent');await page.getByRole('combobox',{name:'Category',exact:true}).selectOption('AI');await page.getByRole('combobox',{name:'Browse',exact:true}).selectOption('picks');await expect(page.locator('#directory-empty')).toBeVisible();
 await page.goto(base+'/products');await page.getByRole('link',{name:/View UI\/UX Prompt Packet/}).click();await expect(page).toHaveURL(/ui-ux-prompt-packet/);
 await page.route('https://mccovery.gumroad.com/l/ui-prompt-package',r=>r.fulfill({contentType:'text/html',body:'<h1>Checkout destination fixture</h1>'}));
 await page.locator('.purchase-link').click();await expect(page).toHaveURL('https://mccovery.gumroad.com/l/ui-prompt-package');
});
test('submission UI reaches real validation handler and only confirms a stored pending record',async({page})=>{
 let saved:any;
 const handler=makeSubmissionHandler({env:{SUBMISSIONS_ORIGIN:base},redis:async(command:any[])=>{saved=JSON.parse(command[6]);return 1;}});
 await page.route('**/api/submissions',async route=>{
  const request={method:route.request().method(),headers:route.request().headers(),body:route.request().postData()};let status=200,body='';const headers:Record<string,string>={};
  const response={set statusCode(value:number){status=value;},setHeader:(k:string,v:string)=>headers[k]=v,end:(value:string)=>body=value};
  await handler(request,response);await route.fulfill({status,headers,body});
 });
 await page.goto(base+'/submit-project');
 await page.getByLabel('Creator Name').fill('Browser fixture');await page.getByLabel('Email',{exact:false}).fill('fixture@example.com');await page.getByLabel('Project Name',{exact:true}).fill('Test fixture only');await page.getByLabel('Project URL').fill('https://example.com');await page.getByLabel('Project Description').fill('A test-only project used to verify private review submission.');await page.getByRole('combobox',{name:'Category',exact:true}).selectOption('Apps');
 await page.getByRole('button',{name:/Submit Your Project/}).click();expect(saved).toBeUndefined();
 await page.getByRole('checkbox').check();await page.getByRole('button',{name:/Submit Your Project/}).click();await expect(page.locator('#submission-status')).toContainText('received for review');expect(saved.status).toBe('pending');expect(saved.email).toBe('fixture@example.com');
 await page.goto(base+'/discover');await expect(page.locator('[data-project]').filter({hasText:'Test fixture only'})).toHaveCount(0);
});
test('storage unavailable retains entered details and does not claim success',async({page})=>{
 await page.route('**/api/submissions',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Submissions are not open yet. Please check back soon.'})}));
 await page.goto(base+'/submit-project');
 await page.getByLabel('Creator Name').fill('Browser fixture');await page.getByLabel('Email',{exact:false}).fill('fixture@example.com');await page.getByLabel('Project Name',{exact:true}).fill('Retain my project');await page.getByLabel('Project URL').fill('https://example.com');await page.getByLabel('Project Description').fill('A test-only description for the unavailable storage response.');await page.getByRole('combobox',{name:'Category',exact:true}).selectOption('Apps');await page.getByRole('checkbox').check();await page.getByRole('button',{name:/Submit Your Project/}).click();await expect(page.locator('#submission-status')).toContainText('not open yet');await expect(page.getByLabel('Project Name',{exact:true})).toHaveValue('Retain my project');
});
