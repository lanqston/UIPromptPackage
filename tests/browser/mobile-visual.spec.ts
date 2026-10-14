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
    for (const [name, path] of pages) {
      await page.goto(`http://127.0.0.1:4321${path}`);
      await page.locator('h1').waitFor();
      if (name === 'library') await expect(page.locator('#prompt-list .prompt-row')).toHaveCount(3);
      const metrics = await page.evaluate(() => ({
        body: getComputedStyle(document.body).backgroundColor,
        overflow: document.documentElement.scrollWidth > innerWidth,
      }));
      expect(metrics, `${name} at ${width}px`).toEqual({ body: 'rgb(17, 18, 19)', overflow: false });
      await page.screenshot({ path: `test-results/mobile/${name}-${width}.png`, fullPage: false });
      if (name === 'home') {
        await page.locator('.signal-stage').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `test-results/mobile/hero-card-${width}.png`, fullPage: false });
      }
    }
  });
}
