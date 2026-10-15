import { test, expect } from '@playwright/test';
for (const width of [390,1440]) {
 test(`Community public flow at ${width}`,async({page})=>{
  await page.setViewportSize({width,height:1000});
  await page.route('**/api/community?action=config',route=>route.fulfill({json:{ready:true,url:'https://cglkjclolglwizwepvmy.supabase.co',key:'sb_publishable_chCrnjYTnkxTUT89LN6qHA_ze-gN_w3',google:false}}));
  await page.goto('http://127.0.0.1:4321/community');
  await expect(page.locator('#community-welcome')).toBeVisible();
  await page.getByRole('button',{name:'Skip intro'}).click();
  await expect(page.locator('#community-feed')).toContainText('There is room for your first idea.');
  await expect(page.locator('[data-community-view]')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.screenshot({path:`test-results/community-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'Join the community',exact:false}).click();
  await expect(page.locator('#community-auth')).toBeVisible();
  await page.getByRole('button',{name:'Close sign in'}).click();
  await expect(page.locator('#community-auth')).not.toBeVisible();
  await page.getByRole('button',{name:'Following',exact:true}).click();
  await expect(page.locator('#community-auth')).toBeVisible();
  await page.getByRole('button',{name:'Close sign in'}).click();
  await page.getByRole('navigation',{name:'Community',exact:true}).getByRole('link',{name:'Global chat'}).click();
  await expect(page.locator('#community-chat')).toContainText('Pull up a chair.');
  await page.screenshot({path:`test-results/community-chat-${width}.png`,fullPage:true});
  await page.goto('http://127.0.0.1:4321/community');
  await expect(page.locator('#community-welcome')).not.toBeVisible();
 });
}
