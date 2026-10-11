import {test,expect} from '@playwright/test';
const base='http://127.0.0.1:4321';
for(const width of [320,768,1440])test(`beginner collection navigation at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto(base+'/saved');
 await expect(page.getByRole('heading',{level:1})).toHaveText('Good finds, all together.');
 await expect(page.locator('#saved-empty-panel')).toBeVisible();await expect(page.locator('#saved-empty-panel').getByRole('link',{name:'Explore projects',exact:true})).toHaveAttribute('href','/discover');
 await expect(page.getByRole('button',{name:'Download backup'})).toBeHidden();
 await page.getByRole('button',{name:'New collection',exact:true}).click();await page.getByLabel('Name',{exact:true}).fill('Tools to try');await page.getByRole('button',{name:'Save collection'}).click();await expect(page.locator('#saved-heading')).toHaveText('Tools to try');
 await page.getByRole('button',{name:'Rename collection'}).click();await expect(page.getByRole('heading',{name:'Rename collection',exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Rename collection'})).toBeFocused();
 await page.getByText('Back up your collections',{exact:true}).focus();await page.keyboard.press('Enter');await expect(page.getByRole('button',{name:'Download backup'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:test.info().outputPath(`saved-empty-${width}.png`),fullPage:true});
 await page.goto(base);await expect(page.getByRole('region',{name:'Get started with Digivated'}).getByRole('link')).toHaveCount(3);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:test.info().outputPath(`home-polish-${width}.png`),fullPage:true});
});
test('saving waits for storage and refreshes an already-open Saved tab',async({page,context})=>{
 await context.route('**/api/saved-item?*',r=>r.fulfill({json:{item:{title:'UI/UX Prompt Packet',description:'Useful design prompts.',url:'/ui-ux-prompt-packet'}}}));
 const saved=await context.newPage();await saved.goto(base+'/saved');await page.goto(base+'/resources');
 await page.evaluate(()=>{(window as any).lockReady=new Promise<void>(resolve=>{navigator.locks.request('digivated-collections',()=>new Promise<void>(release=>{(window as any).releaseSave=release;resolve();}));});});await page.evaluate(()=>(window as any).lockReady);
 await page.locator('[data-builtin-resource]').getByRole('button',{name:'Save to collection'}).click();await page.getByRole('checkbox',{name:'Saved items (0)'}).check();
 await expect(page.getByRole('button',{name:'Done',exact:true})).toBeDisabled();await expect(page.getByRole('dialog')).toHaveAttribute('aria-busy','true');await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toBeVisible();
 await page.evaluate(()=>(window as any).releaseSave());await expect(page.getByRole('dialog').getByRole('status')).toHaveText('Saved in this browser.');await expect(page.getByRole('checkbox',{name:'Saved items (1)'})).toBeChecked();
 await page.getByRole('button',{name:'Done',exact:true}).click();await expect(saved.locator('#saved-items')).toContainText('UI/UX Prompt Packet');await expect(saved.locator('#saved-count')).toHaveText('1 saved item');
 await saved.getByLabel('Search saved items').fill('missing');await expect(saved.locator('#saved-empty-title')).toHaveText('No matches this time.');await saved.getByRole('button',{name:'Clear filters'}).click();await expect(saved.locator('#saved-items .saved-card')).toHaveCount(1);
});
