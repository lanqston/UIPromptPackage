import { test, expect } from '@playwright/test';

for (const width of [375, 1440]) test(`Focus City appears alongside the Prompt Packet at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 850 });
  await page.route('**/api/content?*', route => route.fulfill({ json: { items: [], next: null } }));
  await page.goto('http://127.0.0.1:4321/products');
  const cards = page.locator('.product-feature');
  await expect(cards).toHaveCount(2);
  await expect(cards.first().getByRole('link', { name: 'View UI/UX Prompt Packet' })).toHaveAttribute('href', '/ui-ux-prompt-packet');
  const city = cards.last();
  await expect(city.getByRole('heading', { name: 'Focus City' })).toBeVisible();
  await expect(city.getByRole('img', { name: /Focus City skyline/ })).toBeVisible();
  await expect(city.getByRole('link', { name: /Open Focus City/ })).toHaveAttribute('href', 'https://focus-city-one.vercel.app/');
  await expect(city.getByRole('link', { name: /Open Focus City/ })).toHaveAttribute('rel', 'noopener noreferrer');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
