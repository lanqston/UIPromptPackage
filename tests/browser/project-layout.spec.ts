import {test,expect} from '@playwright/test';
const description='A useful product with a detailed explanation. '.repeat(12);
const projects=[{id:'wide',name:'Wide preview',image:'/fixture-wide.svg'},{id:'portrait',name:'Portrait preview',image:'/fixture-portrait.svg'},{id:'broken',name:'Broken preview',image:'/fixture-missing.png'},{id:'none',name:'No preview'}].map(p=>({...p,description,creator:'Maker',category:'Apps',url:'https://example.com',status:'approved',pick:false,views:12}));
for(const width of [320,375,768,1440])test(`compact projects and resilient image previews at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.route('**/api/**',r=>r.fulfill({json:{items:projects,next:null}}));
 await page.route('**/fixture-*.svg',r=>r.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="${r.request().url().includes('wide')?1200:200}" height="${r.request().url().includes('wide')?200:1200}"><rect width="100%" height="100%" fill="blue"/></svg>`}));
 await page.route('**/fixture-missing.png',r=>r.fulfill({status:404,body:''}));
 for(const path of ['/','/discover']){
  await page.goto('http://127.0.0.1:4321'+path);
  const cards=page.locator('[data-project-id]');await expect(cards).toHaveCount(4);
  for(const id of ['wide','portrait']){
   const card=page.locator(`[data-project-id="${id}"]`);const img=card.locator('img');
   await img.scrollIntoViewIfNeeded();await expect.poll(()=>img.evaluate(i=>(i as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
   await expect(img).toHaveCSS('object-fit','contain');
   expect((await card.boundingBox())!.height).toBeLessThan(310);
   expect((await card.locator('.project-image').boundingBox())!.height).toBeLessThanOrEqual(104);
  }
  await page.locator('[data-project-id="broken"]').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-project-id="broken"] .project-monogram')).toHaveText('BR');
  await expect(page.locator('[data-project-id="broken"] img')).toHaveCount(0);
  await expect(page.locator('[data-project-id="none"] .project-monogram')).toHaveText('NO');
  const card=cards.first();await card.locator('summary').click();await expect(card.locator('.project-details')).toHaveAttribute('open','');
  await expect(card.locator('.project-image .card-save')).toHaveCount(0);
  await expect(card.locator('.card-links .card-actions .card-save')).toHaveCount(1);
  await expect(card.locator('.card-links [data-like-type]')).toHaveCount(1);
  await expect(card.locator('.project-details p')).toHaveText(description.trim());
  await card.locator('summary').click();await expect(card.locator('.project-details')).not.toHaveAttribute('open','');
  await expect(card.getByRole('link',{name:'Visit Project'})).toHaveAttribute('href','https://example.com/');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});
