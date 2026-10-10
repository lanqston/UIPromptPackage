import { test, expect } from '@playwright/test';

const base = 'http://127.0.0.1:4321';
const projects = Array.from({ length: 6 }, (_, index) => ({
  id: `home-${index}`, name: `Community build ${index}`, creator: 'Fixture maker',
  description: 'A reviewed community project.', category: 'Apps',
  url: `https://example.com/build-${index}`, status: index === 4 ? 'featured' : 'approved',
  pick: index === 5, views: index + 10,
}));

for (const width of [320, 375, 768, 820, 1024, 1440]) {
  test(`home navigation and live collection filters at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/projects') return route.fulfill({ json: { items: projects, next: null } });
      if (url.pathname === '/api/project-views') return route.fulfill({ json: { views: 15 } });
      return route.fulfill({ json: { items: [], next: null, status: 'unconfigured' } });
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Build. Share. Connect.');
    await expect(page.locator('.hero-copy').getByRole('link', { name: 'Submit Your Project (Free)' })).toHaveAttribute('href', '/submit-project');
    await expect(page.locator('.hero-copy').getByRole('link', { name: 'Explore Builds' })).toHaveAttribute('href', '/discover');
    const shelf = page.locator('[data-project-filters]');
    const cards = shelf.locator('[data-project]:visible');
    await expect(cards).toHaveCount(4);
    await shelf.getByRole('button', { name: 'Featured', exact: true }).click();
    await expect(cards).toHaveCount(1);
    await expect(cards).toContainText('Community build 4'); // Filter before the four-card limit.
    await expect(shelf.getByRole('button', { name: 'Featured', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(cards.getByRole('link', { name: 'Visit Project' })).toHaveAttribute('href', 'https://example.com/build-4');
    await shelf.getByRole('button', { name: 'Digivated Picks', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(cards).toHaveCount(1);
    await expect(cards).toContainText('Community build 5');
    await shelf.getByRole('button', { name: 'All', exact: true }).click();
    await expect(cards).toHaveCount(4);
    await expect(shelf.locator('[data-live-status]')).toContainText('Showing 4 of 6 projects');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => scrollTo(0, 0));
    await page.locator('.header-submit').click({ trial: true });
    const navigation = page.getByRole('navigation', { name: width <= 780 ? 'Mobile navigation' : 'Main navigation', exact: true });
    if (width <= 780) await page.locator('.mobile-menu summary').click();
    await navigation.getByRole('link', { name: 'Prompt Packet', exact: true }).click({ trial: true });
    if (width <= 780) await expect(navigation.getByRole('link', { name: 'Sign In', exact: true })).toHaveAttribute('href', '/access');
    else await expect(page.locator('.header-sign-in')).toHaveAttribute('href', '/access');
    expect(errors).toEqual([]);
  });
}

test('empty filters stay usable and failed loading is announced', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ json: { items: [], next: null } }));
  await page.goto(base);
  const shelf = page.locator('[data-project-filters]');
  await expect(shelf.locator('[data-live-empty]')).toBeVisible();
  await shelf.getByRole('button', { name: 'Featured', exact: true }).click();
  await expect(shelf.locator('[data-live-empty]')).toContainText('Featured builds are on their way.');
  await shelf.getByRole('button', { name: 'All', exact: true }).click();
  await expect(shelf.locator('[data-live-empty]')).toContainText('Good things start somewhere.');
  await page.route('**/api/projects*', route => route.fulfill({ status: 503, json: { error: 'Unavailable' } }));
  await page.reload();
  await expect(shelf.locator('[data-live-status]')).toContainText('Projects are temporarily unavailable');
  await expect(shelf).not.toHaveAttribute('aria-busy', 'true');
  await expect(shelf.getByRole('button', { name: 'All', exact: true })).toBeDisabled();
  await expect(shelf.getByRole('link', { name: 'Share what you’re building' })).toHaveAttribute('href', '/submit-project');
});
