import { test, expect } from '@playwright/test';
const base = 'http://127.0.0.1:4321';
for (const width of [375, 768, 1440]) test(`connected public navigation and packet journey at ${width}px`, async ({ page }) => {
  const errors:string[]=[];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => {
    if(new URL(route.request().url()).pathname === '/api/edition') return route.fulfill({status:401,json:{code:'invalid_access'}});
    return route.fulfill({json:{items:[],next:null,status:'unconfigured'}});
  });
  await page.setViewportSize({width,height:900});
  await page.goto(base);
  await expect(page.locator('.welcome-guide')).toContainText('A good place to begin.');
  await expect(page.locator('.home-topics')).not.toContainText(/\b0[1-4]\b/);
  await page.locator('.home-topics').getByRole('link',{name:'Technology & AI'}).click();
  await expect(page.getByRole('combobox',{name:'Topic',exact:true})).toHaveValue('Technology & AI');
  await expect(page.locator('h1')).toHaveText('Explore what’s useful.');
  await expect(page.locator('body')).toHaveCSS('background-color','rgb(17, 17, 17)');
  await page.getByRole('navigation',{name:'Breadcrumb'}).getByRole('link',{name:'Home'}).click();
  await expect(page).toHaveURL(base+'/');
  const nav=page.getByRole('navigation',{name:width<=1100?'Mobile navigation':'Main navigation',exact:true});
  if(width<=1100) await page.locator('.mobile-menu summary').click();
  await nav.getByRole('link',{name:'Products',exact:true}).click();
  await expect(page.locator('.product-art-cover img')).toHaveAttribute('src','/digivated-mark.svg');
  await page.getByRole('link',{name:'View UI/UX Prompt Packet'}).click();
  await expect(page.locator('h1')).toHaveText('UI/UX Prompt Packet');
  await expect(page.locator('body')).toHaveCSS('background-color','rgb(17, 17, 17)');
  await page.getByRole('link',{name:'Try 3 free prompts'}).click();
  // The library normalizes the sample entry URL after initializing its filters.
  await expect(page).toHaveURL(/\/library\?show=available$/);
  await expect(page.locator('#availability')).toHaveValue('available');
  await expect(page.locator('#prompt-list .prompt-row')).toHaveCount(3);
  await expect(page.locator('.shell')).toHaveCSS('background-color','rgb(24, 24, 24)');
  await expect(page.locator('.brand')).toContainText('Digivated');
  await expect(page.locator('#site-navigation')).toHaveCSS('background-color','rgb(28, 28, 28)');
  await page.locator('[data-open="1"]').click();
  await expect(page.locator('#prompt-dialog')).toBeVisible();
  await expect(page.locator('#prompt-dialog .prompt-text')).not.toBeEmpty();
  await page.locator('#close-dialog').click();
  await expect(page.locator('body')).toHaveCSS('background-color','rgb(17, 17, 17)');
  await expect(page.locator('.packet-context')).toContainText('Prompt Packet');
  await expect(page.locator('.brand-logo-wrap')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  await expect(page.locator('.footer-logo-wrap')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  await expect(page.locator('.brand-logo')).toHaveAttribute('src','/digivated-mark.svg');
  if(width<=850){await page.locator('#menu-toggle').click();await expect(page.locator('#site-navigation')).toBeVisible();}
  await page.getByRole('navigation',{name:'Packet tools'}).getByRole('link',{name:'Start Here',exact:true}).click();
  await expect(page).toHaveURL(/\/start$/);
  await page.locator('.packet-context').getByRole('link',{name:'Home',exact:true}).click();
  await expect(page).toHaveURL(base+'/');
  for(const path of ['/discover','/submit-project','/products','/about','/access']){
    await page.goto(base+path);
    await expect(page.locator('body')).toHaveCSS('background-color','rgb(17, 17, 17)');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),path).toBe(true);
  }
  expect(errors).toEqual([]);
});

