import { test, expect } from '@playwright/test';
test.skip(!process.env.DIGIVATED_TEST_REDIS_PORT,'Requires isolated local Redis.');
const base='http://127.0.0.1:4322';
for(const width of [375,1440])test(`launch page and browser collections at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/discover');const card=page.locator('[data-project]').first();
 await card.getByRole('button',{name:'Save to collection'}).focus();await page.keyboard.press('Enter');
 await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('checkbox',{name:'Saved items (0)'}).check();
 await page.getByRole('textbox',{name:'New collection'}).fill('Portfolio inspiration');await page.getByRole('button',{name:'Create collection',exact:true}).click();await expect(page.getByRole('checkbox',{name:'Portfolio inspiration (1)'})).toBeChecked();await page.getByRole('button',{name:'Done',exact:true}).click();
 await expect(page).toHaveURL(base+'/discover');
 await page.goto(base+'/resources');await page.locator('.resource-card').filter({hasText:'Sketch before you build'}).getByRole('button',{name:'Save to collection'}).click();await page.getByRole('checkbox',{name:'Saved items (1)'}).check();await expect(page.getByRole('dialog').getByRole('status')).toHaveText('Saved in this browser.');await page.keyboard.press('Escape');
 await page.goto(base+'/saved');await expect(page.locator('#saved-items')).toContainText('Fieldnotes');await expect(page.locator('#saved-items')).toContainText('Sketch before you build');await page.reload();await expect(page.locator('#saved-items .saved-card')).toHaveCount(2);
 await page.locator('#saved-items .saved-card').filter({hasText:'Fieldnotes'}).getByRole('button',{name:'Remove from this collection'}).click();await expect(page.locator('#saved-items .saved-card')).toHaveCount(1);await page.getByRole('button',{name:'Portfolio inspiration (1)',exact:true}).click();await expect(page.locator('#saved-items')).toContainText('Fieldnotes');
 await page.getByRole('button',{name:'Rename collection'}).click();await page.getByLabel('Name',{exact:true}).fill('Tools to try');await page.getByRole('button',{name:'Save collection'}).click();await expect(page.getByRole('heading',{name:'Tools to try'})).toBeVisible();
 await page.getByText('Back up your collections',{exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download backup'}).click();const backup=await download;const path=await backup.path();expect(path).toBeTruthy();await page.locator('#import-collections').setInputFiles(path!);await expect(page.locator('#saved-status')).toContainText('Backup merged');await expect(page.locator('#saved-items .saved-card')).toHaveCount(1);
 await page.getByLabel('Search saved items').fill('nothing');await expect(page.locator('#saved-empty')).toContainText('No saved items');await page.getByLabel('Search saved items').clear();
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:test.info().outputPath(`saved-${width}.png`),fullPage:true});
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Delete collection'}).click();await expect(page.getByRole('heading',{name:'Saved items',exact:true})).toBeVisible();
 await page.goto(base+'/projects/fieldnotes-fixture-project');await expect(page.getByRole('heading',{level:1})).toHaveText('Fieldnotes');expect(await page.locator('h1').count()).toBe(1);await expect(page.locator('.desktop-nav a[href="/discover"]')).toHaveAttribute('aria-current','page');await expect(page.getByRole('navigation',{name:'Breadcrumb'}).getByRole('link',{name:'Projects'})).toHaveAttribute('href','/discover');await expect(page.getByRole('heading',{name:'Meet the creator'})).toBeVisible();await expect(page.getByRole('link',{name:'Try the app'})).toHaveAttribute('href','https://example.com/');expect(await page.locator('body').innerText()).not.toContain('PRIVATE REVIEW NOTE');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Copy link'}).click();await expect(page.locator('[data-share-status]')).toContainText(/Link copied|Copy this link/);
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:test.info().outputPath(`launch-${width}.png`),fullPage:true});
 await page.goto(base);await expect(page.getByRole('heading',{level:1})).toHaveText('Stay curious about what’s next.');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:test.info().outputPath(`homepage-${width}.png`),fullPage:true});expect(errors).toEqual([]);
});
test('storage failure, invalid import, unavailable item and native sharing',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(navigator,'share',{value:async data=>{window['sharedData']=data;}});});
 await page.goto(base+'/projects/fieldnotes-fixture-project');await page.getByRole('button',{name:'Share',exact:true}).click();expect(await page.evaluate(()=>window['sharedData'].url)).toBe(base+'/projects/fieldnotes-fixture-project');
 await page.evaluate(()=>localStorage.setItem('digivated.collections',JSON.stringify({version:1,collections:[{id:'saved',name:'Saved items',items:[{type:'project',id:'missing'}]}]})));
 await page.goto(base+'/saved');await expect(page.locator('#saved-items')).toContainText('Item no longer available');
 await page.locator('#import-collections').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{bad')});await expect(page.locator('#saved-status')).toContainText('Invalid JSON');await expect(page.locator('#saved-items .saved-card')).toHaveCount(1);
 await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('QuotaExceededError');};});
 await page.getByRole('button',{name:'New collection',exact:true}).click();await page.getByLabel('Name',{exact:true}).fill('Cannot save');await page.getByRole('button',{name:'Save collection'}).click();await expect(page.locator('#collection-manager-status')).toContainText('previous collections are unchanged');
 await page.addInitScript(()=>{Storage.prototype.getItem=function(){throw new Error('disabled');};});await page.goto(base+'/saved');await expect(page.locator('#saved-status')).toContainText('Browser storage is unavailable');
});
test('authenticated launch editor saves a draft, previews privately, publishes and unpublishes',async({page,request})=>{
 await page.goto(base);const fixtureImage={name:'fixture.png',mimeType:'image/png',buffer:await page.locator('.hero-copy').screenshot()};
 await page.goto(base+'/admin');await page.getByLabel('Owner password').fill('Local fixture password only!');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('button',{name:'Review project',exact:true}).click();
 await page.getByLabel('Replace primary screenshot (optional)',{exact:false}).setInputFiles(fixtureImage);
 await page.getByLabel('Primary screenshot description',{exact:true}).fill('A fixture screenshot of the existing project preview artwork.');
 await page.getByLabel('Gallery screenshot 1 (optional)',{exact:false}).setInputFiles(fixtureImage);await page.getByLabel('Gallery screenshot 1 description',{exact:true}).fill('A second fixture view of the project.');
 await page.getByLabel('Creator bio (optional)',{exact:false}).fill('A biography explicitly approved for this fixture page.');await page.getByRole('button',{name:'Save launch draft',exact:true}).click();await expect(page.locator('#owner-editor-status')).toContainText('Launch page is private');
 expect((await request.get(base+'/projects/fieldnotes-fixture-project')).status()).toBe(404);
 const href=await page.getByRole('link',{name:'Preview saved draft'}).getAttribute('href');expect((await request.get(base+href)).status()).toBe(401);
 const preview=await page.evaluate(async href=>{const response=await fetch(href);return {status:response.status,body:await response.text()};},href);expect(preview.status).toBe(200);expect(preview.body).toContain('Private draft preview');expect(preview.body).not.toContain('private@example.test');
 await page.getByRole('button',{name:'Publish launch page',exact:true}).click();await expect(page.locator('#owner-editor-status')).toContainText('Launch page is published');
 const published=await request.get(base+'/projects/fieldnotes-fixture-project');expect(published.status()).toBe(200);expect(await published.text()).toContain('A biography explicitly approved');
 await page.getByRole('button',{name:'Unpublish launch page',exact:true}).click();await expect(page.locator('#owner-editor-status')).toContainText('Launch page is private');expect((await request.get(base+'/projects/fieldnotes-fixture-project')).status()).toBe(404);
 await page.getByRole('button',{name:'Publish launch page',exact:true}).click();await expect(page.locator('#owner-editor-status')).toContainText('Launch page is published');
 for(const width of [375,1440]){await page.setViewportSize({width,height:900});await page.goto(base+'/projects/fieldnotes-fixture-project');await expect(page.locator('.launch-shot img')).toHaveCount(2);expect(await page.locator('.launch-shot img').evaluateAll(images=>images.every(image=>image.complete&&image.naturalWidth>0))).toBe(true);await page.screenshot({path:test.info().outputPath(`launch-gallery-${width}.png`),fullPage:true});}
});

