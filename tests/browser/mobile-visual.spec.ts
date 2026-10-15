import { test, expect } from '@playwright/test';

const pages = [
  ['home', '/'],
  ['products', '/products'],
  ['packet', '/ui-ux-prompt-packet'],
  ['library', '/library?show=available'],
  ['about', '/about'],
] as const;

for (const width of [320, 390, 768]) {
  test(`mobile presentation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.route('**/api/edition', route => route.fulfill({ status: 401, json: { code: 'invalid_access' } }));
    for (const [name, path] of pages) {
      await page.goto(`http://127.0.0.1:4321${path}`);
      await page.locator('h1').waitFor();
      if (name === 'library') await expect(page.locator('#prompt-list .prompt-row')).toHaveCount(3);
      const metrics = await page.evaluate(() => ({
        body: getComputedStyle(document.body).backgroundColor,
        overflow: document.documentElement.scrollWidth > innerWidth,
      }));
      expect(metrics, `${name} at ${width}px`).toEqual({ body: 'rgb(17, 18, 19)', overflow: false });
      if (name !== 'library') {
        const menu = page.locator('.mobile-menu summary');
        await expect(menu).toBeVisible();
        const box = await menu.boundingBox();
        expect(box, `${name} mobile menu bounds`).not.toBeNull();
        expect(box!.x + box!.width, `${name} mobile menu within viewport`).toBeLessThanOrEqual(width);
      }
      if (name === 'packet') {
        await expect(page.locator('.packet-intro .purchase-link')).toHaveAttribute('href', 'https://digivated.gumroad.com/l/ui-prompt-package');
        if (width <= 600) {
          const buttons = page.locator('.packet-intro .actions>.button');
          await expect(buttons).toHaveCount(2); // Sample and purchase are the two current packet actions.
          const boxes = await Promise.all((await buttons.all()).map(button => button.boundingBox()));
          expect(boxes.every(box => box && box.width >= width - 50), 'packet actions fill mobile column').toBe(true);
        }
      }
      if (name === 'library' && width <= 600) await expect(page.locator('.brand-caption')).toBeVisible();
      await page.screenshot({ path: `test-results/mobile/${name}-${width}.png`, fullPage: false });
      if (name === 'home') {
        await page.locator('.signal-stage').scrollIntoViewIfNeeded();
        const stage = await page.locator('.signal-display').boundingBox();
        const emblem = await page.locator('.signal-emblem').boundingBox();
        expect(stage && emblem, 'hero card and logo are visible').toBeTruthy();
        expect(Math.abs((emblem!.x + emblem!.width / 2) - (stage!.x + stage!.width / 2)), 'hero logo stays centered').toBeLessThan(18);
        const iconStyle = await page.locator('.journey-icon').first().evaluate(element => ({
          fontSize: getComputedStyle(element).fontSize,
          mask: getComputedStyle(element, '::before').maskImage,
        }));
        expect(iconStyle.fontSize).toBe('0px');
        expect(iconStyle.mask).toContain('signal-spark.svg');
        await page.screenshot({ path: `test-results/mobile/hero-card-${width}.png`, fullPage: false });
      }
    }
  });
}
