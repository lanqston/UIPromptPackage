import {test,expect} from '@playwright/test';
const base='http://127.0.0.1:4321';
for(const width of [375,1440])test(`clear promotion path and private submission at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});let payload:any;
 await page.route('**/api/submissions',async route=>{payload=route.request().postDataJSON();await route.fulfill({status:201,json:{ok:true,status:'pending',id:'promo-fixture'}});});
 await page.goto(base+'/promote');await expect(page.locator('h1')).toHaveCount(1);
 await expect(page.getByRole('link',{name:'View promo offer on Gumroad'})).toHaveAttribute('href','https://mccovery.gumroad.com/l/digivated-promo');
 await page.screenshot({path:test.info().outputPath(`promotion-${width}.png`),fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('link',{name:'Already purchased? Submit your project'}).click();await expect(page.locator('#submission-type')).toHaveValue('promotion');await expect(page.locator('#promotion-fields')).toBeVisible();
 await page.getByLabel('Gumroad order reference').fill('ORDER-PRIVATE-TEST');await page.locator('#promotion-purchased').check();
 await page.getByLabel('Creator Name',{exact:true}).fill('Creator');await page.locator('input[name=email]').fill('checkout@example.com');await page.getByLabel('Project Name',{exact:true}).fill('A useful project');await page.getByLabel('Project URL',{exact:true}).fill('https://example.com');await page.locator('textarea[name=description]').fill('An independent project with a clear useful purpose.');await page.getByRole('combobox',{name:'Category',exact:true}).selectOption('Apps');await page.locator('input[name=consent]').check();
 await page.screenshot({path:test.info().outputPath(`promotion-form-${width}.png`),fullPage:true});await page.getByRole('button',{name:'Submit Your Project',exact:true}).click();await expect(page.locator('#submission-status')).toContainText('check your Gumroad purchase');expect(payload.submissionType).toBe('promotion');expect(payload.promotionReceipt).toBe('ORDER-PRIVATE-TEST');expect(payload.promotionPurchased).toBe(true);expect(payload.promotionVerified).toBeUndefined();
 await page.goto(base+'/submit-project');await expect(page.locator('#promotion-fields')).toBeHidden();await expect(page.locator('#promotion-receipt')).toBeDisabled();
 await page.goto(base+'/ui-ux-prompt-packet');await expect(page.getByRole('link',{name:'Buy the full packet'})).toHaveAttribute('href','https://mccovery.gumroad.com/l/ui-prompt-package');await page.getByRole('link',{name:'Try 3 free prompts'}).click();await expect(page.locator('#prompt-list .prompt-row')).toHaveCount(3);
});
