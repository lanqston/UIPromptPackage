import { test, expect } from '@playwright/test';
const base='http://127.0.0.1:4321';
const projects=[{id:'design-fixture',name:'A considered project',creator:'Fixture creator',category:'Design',description:'A local test fixture for checking image framing, readable descriptions, and the existing project actions.',url:'https://example.com',socialUrl:'https://example.com/creator',image:'/digivated-mark.svg',status:'featured',pick:true,views:12},{id:'app-fixture',name:'Useful app',creator:'Fixture builder',category:'Apps',description:'A second local fixture for verifying category and search controls.',url:'https://example.com/app',status:'approved',pick:false,views:3}];
const resources=[{id:'design',title:'A clearer starting point',description:'A local resource fixture to check editorial hierarchy.',category:'UI/UX',date:'2026-10-05',readingTime:3,url:'/resources/read?slug=design',content:'## Begin with the user\n\nA useful local test.',coverImage:'/digivated-mark.svg'},{id:'tools',title:'Tools for a thoughtful workflow',description:'A second local resource fixture.',category:'Useful Tools',date:'2026-10-05',readingTime:2,url:'/resources/read?slug=tools',content:'A local test.'}];
for(const width of [390,430,1280])test(`refined controls and layouts at ${width}px`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',async route=>{const url=new URL(route.request().url());if(url.pathname==='/api/projects')return route.fulfill({json:{items:projects,next:null}});if(url.pathname==='/api/project-views'||url.pathname==='/api/resource-views')return route.fulfill({json:{views:12}});if(url.pathname==='/api/card-interactions'){const action=route.request().postDataJSON()?.action;return route.fulfill({json:{likes:action==='like'?1:0,liked:action==='like',comments:[],commentCount:0}});}if(url.pathname==='/api/content')return route.fulfill({json:url.searchParams.has('id')?{item:resources.find(r=>r.id===url.searchParams.get('id'))}:{items:resources,next:null}});return route.fulfill({json:{status:'unconfigured'}});});
 await page.setViewportSize({width,height:900});await page.goto(base);
 const submit=page.locator('.journey-steps').getByRole('link',{name:'Submit a project',exact:true});await expect(submit).toHaveAttribute('href','/submit-project');await submit.click({trial:true});
 await expect(page.locator('[data-project-filters] [data-project-id=design-fixture] .card-links a.button')).toHaveAttribute('href','https://example.com/');
 await page.screenshot({path:test.info().outputPath(`home-${width}.png`),fullPage:true});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:test.info().outputPath(`hero-${width}.png`)});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(width<1024){const menu=page.locator('.mobile-menu');const trigger=menu.locator('summary');await trigger.click();await expect(menu).toHaveAttribute('open','');await page.keyboard.press('Escape');await expect(menu).not.toHaveAttribute('open','');await expect(trigger).toBeFocused();await trigger.click();await page.mouse.click(5,200);await expect(menu).not.toHaveAttribute('open','');await trigger.click();await menu.getByRole('link',{name:'Projects',exact:true}).click();}
 else await page.getByRole('navigation',{name:'Main navigation',exact:true}).getByRole('link',{name:'Projects',exact:true}).click();
 await expect(page).toHaveURL(/\/discover/);await page.getByLabel('Search projects').fill('Useful');await expect(page.locator('[data-project]:visible')).toHaveCount(1);await expect(page.locator('#directory-status')).toHaveText('1 project found');
 const project=page.locator('[data-project]:visible');await expect(project.locator('.project-image button')).toHaveCount(0);await expect(project.locator('.card-actions button')).toHaveCount(4);await project.scrollIntoViewIfNeeded();await project.screenshot({path:test.info().outputPath(`project-card-${width}.png`)});
 await page.getByLabel('Search projects').fill('');await page.getByRole('combobox',{name:'Category',exact:true}).selectOption('Design');await expect(page.locator('[data-project]:visible')).toHaveCount(1);
 await page.goto(base+'/resources?category=Design%20%26%20UX');await expect(page.getByRole('combobox',{name:'Topic',exact:true})).toHaveValue('Design & UX');await expect(page.locator('[data-resource]:visible')).toHaveCount(3);await expect(page.locator('[data-builtin-resource]').filter({hasText:'UI/UX Prompt Packet'})).toBeVisible();
 await page.getByRole('combobox',{name:'Topic',exact:true}).selectOption('Tools & Security');await expect(page.getByRole('combobox',{name:'Topic',exact:true})).toHaveValue('Tools & Security');await expect(page.locator('[data-resource]:visible').filter({hasText:'Tools for a thoughtful workflow'})).toBeVisible();
 await page.getByRole('combobox',{name:'Topic',exact:true}).selectOption('');await expect(page.locator('[data-resource]:visible')).toHaveCount(15);
 const guide=page.locator('[data-resource-view-id="make-sense-of-new-tech"]');await expect(guide.locator('time')).toHaveText('Oct 14');await expect(guide.locator('.card-stat')).toHaveCount(3);await expect(guide.locator('.card-footer .card-actions button')).toHaveCount(4);await guide.scrollIntoViewIfNeeded();
 const like=guide.locator('[data-like-id]');await like.click();await expect(like).toHaveAttribute('aria-pressed','true');await like.click();await expect(like).toHaveAttribute('aria-pressed','false');
 await guide.locator('[data-save-id]').click();await expect(page.locator('.collection-dialog')).toBeVisible();await page.locator('.collection-dialog').getByRole('button',{name:'Done',exact:true}).click();await expect(page.locator('.collection-dialog')).not.toBeVisible();
 await guide.screenshot({path:test.info().outputPath(`resource-card-${width}.png`)});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:test.info().outputPath(`resources-${width}.png`),fullPage:true});
 await page.locator('[data-resource]').filter({hasText:'A clearer starting point'}).getByRole('link',{name:'Read the guide'}).click();await expect(page.locator('#article-body')).toContainText('Begin with the user');
 await expect(page.locator('.desktop-nav a[href="/resources"]')).toHaveAttribute('aria-current','page');
 await page.goto(base+'/submit-project');await expect(page.getByRole('group',{name:'About you'})).toBeVisible();await expect(page.getByRole('group',{name:'Your project'})).toBeVisible();
 await page.screenshot({path:test.info().outputPath(`submit-${width}.png`),fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.emulateMedia({reducedMotion:'reduce'});expect(await page.locator('.button.primary').first().evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');
 expect(errors).toEqual([]);
});

test('Prompt Packet stays searchable in Design & UX when the resource feed fails', async({page})=>{
 await page.route('**/api/content*',route=>route.fulfill({status:503,json:{error:'Unavailable'}}));
 await page.goto(base+'/resources?category=Design%20%26%20UX');
 await expect(page.locator('[data-live-status]')).toContainText('Additional resources are temporarily unavailable');
 await expect(page.locator('[data-resource]:visible')).toHaveCount(2);
 await page.getByLabel('Search resources').fill('promptpackage');
 await expect(page.locator('#directory-status')).toHaveText('1 resource found');
 await page.getByRole('combobox',{name:'Topic',exact:true}).selectOption('Technology & AI');
 await expect(page.locator('[data-resource]:visible')).toHaveCount(0);
 await expect(page.locator('#directory-empty')).toBeVisible();
 await page.getByRole('combobox',{name:'Topic',exact:true}).selectOption('Design & UX');
 await page.getByRole('link',{name:'Explore the packet'}).click();
 await expect(page).toHaveURL(/\/ui-ux-prompt-packet/);
 await expect(page.getByRole('heading',{name:'UI/UX Prompt Packet',exact:true})).toBeVisible();
});

test('published Prompt Packet links do not duplicate the built-in resource', async({page})=>{
 await page.route('**/api/content*',route=>route.fulfill({json:{items:[{...resources[0],url:'/ui-ux-prompt-packet',title:'UI/UX Prompt Packet'}],next:null}}));
 await page.goto(base+'/resources');
 await expect(page.locator('#directory-status')).toHaveText('13 resources found');
 await expect(page.locator('[data-resource]')).toHaveCount(13);
});


