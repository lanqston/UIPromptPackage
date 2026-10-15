import {test,expect} from '@playwright/test';
for(const width of [390,1440])test(`Public site remains usable with Community paused at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 // API fixtures keep this check isolated from member and production data.
 await page.route('**/api/**',r=>r.fulfill({json:{items:[],next:null,count:0}}));
 for(const path of ['/','/resources','/discover','/products','/submit-project','/about','/saved']){
  await page.goto('http://127.0.0.1:4321'+path);
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('a[href="/community"]')).toHaveCount(0);
  await expect(page.locator('[data-community-view]')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await page.goto('http://127.0.0.1:4321/community');await expect(page).toHaveURL('http://127.0.0.1:4321/');
 expect(errors).toEqual([]);
});
