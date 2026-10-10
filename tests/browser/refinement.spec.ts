import { test, expect } from '@playwright/test';
const base='http://127.0.0.1:4321';
const projects=[{id:'design-fixture',name:'A considered project',creator:'Fixture creator',category:'Design',description:'A local test fixture for checking image framing, readable descriptions, and the existing project actions.',url:'https://example.com',socialUrl:'https://example.com/creator',image:'/digivated-logo-site.jpg',status:'featured',pick:true,views:12},{id:'app-fixture',name:'Useful app',creator:'Fixture builder',category:'Apps',description:'A second local fixture for verifying category and search controls.',url:'https://example.com/app',status:'approved',pick:false,views:3}];
const resources=[{id:'design',title:'A clearer starting point',description:'A local resource fixture to check editorial hierarchy.',category:'UI/UX',date:'2026-10-05',readingTime:3,url:'/resources/read?slug=design',content:'## Begin with the user\n\nA useful local test.',coverImage:'/digivated-logo-site.jpg'},{id:'tools',title:'Tools for a thoughtful workflow',description:'A second local resource fixture.',category:'Useful Tools',date:'2026-10-05',readingTime:2,url:'/resources/read?slug=tools',content:'A local test.'}];
for(const width of [390,430,1280])test(`refined controls and layouts at ${width}px`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',async route=>{const url=new URL(route.request().url());if(url.pathname==='/api/projects')return route.fulfill({json:{items:projects,next:null}});if(url.pathname==='/api/project-views')return route.fulfill({json:{views:12}});if(url.pathname==='/api/content')return route.fulfill({json:url.searchParams.has('id')?{item:resources.find(r=>r.id===url.searchParams.get('id'))}:{items:resources,next:null}});return route.fulfill({json:{status:'unconfigured'}});});
 await page.setViewportSize({width,height:900});await page.goto(base);
 const submit=page.locator('.hero-copy').getByRole('link',{name:'Submit Your Project (Free)',exact:true});await expect(submit).toHaveAttribute('href','/submit-project');await submit.click({trial:true});
 await expect(page.locator('[data-live-projects=featured] .card-links .button')).toHaveAttribute('href','https://example.com/');
 await page.screenshot({path:test.info().outputPath(`home-${width}.png`),fullPage:true});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:test.info().outputPath(`hero-${width}.png`)});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(width<781){const menu=page.locator('.mobile-menu');const trigger=menu.locator('summary');await trigger.click();await expect(menu).toHaveAttribute('open','');await page.keyboard.press('Escape');await expect(menu).not.toHaveAttribute('open','');await expect(trigger).toBeFocused();await trigger.click();await page.mouse.click(5,200);await expect(menu).not.toHaveAttribute('open','');await trigger.click();await menu.getByRole('link',{name:'Explore',exact:true}).click();}
 else await page.getByRole('navigation',{name:'Main navigation',exact:true}).getByRole('link',{name:'Explore',exact:true}).click();
 await expect(page).toHaveURL(/\/discover/);await page.getByLabel('Search projects').fill('Useful');await expect(page.locator('[data-project]:visible')).toHaveCount(1);await expect(page.locator('#directory-status')).toHaveText('1 project found');
 await page.getByLabel('Search projects').fill('');await page.getByRole('combobox',{name:'Category',exact:true}).selectOption('Design');await expect(page.locator('[data-project]:visible')).toHaveCount(1);
 await page.goto(base+'/resources?category=UI%2FUX');await expect(page.getByRole('button',{name:'UI/UX',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.locator('[data-resource]:visible')).toHaveCount(1);
 await page.getByRole('button',{name:'Useful Tools',exact:true}).click();await expect(page.getByRole('combobox',{name:'Category',exact:true})).toHaveValue('Useful Tools');await expect(page.locator('[data-resource]:visible')).toContainText('Tools for a thoughtful workflow');
 await page.getByRole('button',{name:'All topics',exact:true}).click();await expect(page.locator('[data-resource]:visible')).toHaveCount(2);
 await page.screenshot({path:test.info().outputPath(`resources-${width}.png`),fullPage:true});
 await page.locator('[data-resource]').first().getByRole('link',{name:'Read Resource'}).click();await expect(page.locator('#article-body')).toContainText('Begin with the user');
 await expect(page.locator('.desktop-nav a[href="/resources"]')).toHaveAttribute('aria-current','page');
 await page.goto(base+'/submit-project');await expect(page.getByRole('group',{name:'01 About you'})).toBeVisible();await expect(page.getByRole('group',{name:'02 Your project'})).toBeVisible();
 await page.screenshot({path:test.info().outputPath(`submit-${width}.png`),fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.emulateMedia({reducedMotion:'reduce'});expect(await page.locator('.button.primary').first().evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');
 expect(errors).toEqual([]);
});

