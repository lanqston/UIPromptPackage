import { test, expect } from '@playwright/test';
const base = 'http://127.0.0.1:4321';
const projects = Array.from({ length: 10 }, (_, index) => ({
  id: `home-${index}`, name: `Community build ${index}`, creator: 'Fixture maker',
  description: 'A reviewed community project.', category: 'Apps',
  url: `https://example.com/build-${index}`, status: index === 8 ? 'featured' : 'approved',
  pick: index === 9, views: index + 10,
}));
for (const width of [320, 375, 768, 820, 1024, 1440]) {
  test(`redesigned home, carousel, and live filters at ${width}px`, async ({ page }) => {
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
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Build. Share.');
    await expect(page.locator('.hero-copy').getByRole('link', { name: 'Submit Your Project (Free)' })).toHaveAttribute('href', '/submit-project');
    await expect(page.locator('.hero-copy').getByRole('link', { name: 'Explore Projects' })).toHaveAttribute('href', '/discover');
    await expect(page.locator('.platform-header')).toHaveCSS('position', 'fixed');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(3, 7, 18)');
    await expect(page.locator('.hero-copy .primary')).toHaveCSS('background-color', 'rgb(37, 99, 235)');
    const carousel = page.locator('[data-hero-carousel]');
    if (width >= 768) {
    await carousel.getByRole('button', { name: 'Next card' }).click();
    await expect(carousel.locator('[data-position="0"]')).toContainText('Find practical design prompts.');
    await expect(carousel.locator('[data-position="1"]')).toHaveAttribute('inert', '');
    await carousel.getByRole('button', { name: 'Previous card' }).focus();
    await page.keyboard.press('Enter');
    await expect(carousel.locator('[data-position="0"]')).toContainText('Discover independent projects.');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(carousel.locator('[data-position="0"]')).toHaveCSS('transition-duration', '0s');
    } else { await expect(carousel).toBeHidden(); }
    const shelf = page.locator('[data-project-filters]');
    const cards = shelf.locator('[data-project]:visible');
    await expect(cards).toHaveCount(4);
    await expect(shelf.locator('[data-demo-project]:visible')).toHaveCount(0);
    await shelf.getByRole('button', { name: 'Featured', exact: true }).click();
    await expect(cards).toHaveCount(1);
    await expect(cards).toContainText('Community build 8');
    await expect(cards.getByRole('link', { name: 'Visit Project' })).toHaveAttribute('href', 'https://example.com/build-8');
    await shelf.getByRole('button', { name: 'Digivated Picks', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(cards).toHaveCount(1);
    await expect(cards).toContainText('Community build 9');
    await shelf.getByRole('button', { name: 'All', exact: true }).click();
    await expect(cards).toHaveCount(4);
    await expect(page.locator('.idea-card')).toHaveCount(4);
    await expect(page.getByRole('navigation', { name: 'Legal footer links' }).getByRole('link', { name: 'Privacy & Data' })).toHaveAttribute('href', '/privacy');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => scrollTo(0, 0));
    await page.locator('.header-submit').click({ trial: true });
    const navigation = page.getByRole('navigation', { name: width < 1024 ? 'Mobile navigation' : 'Main navigation', exact: true });
    if (width < 1024) await page.locator('.mobile-menu summary').click();
    await navigation.getByRole('link', { name: 'About', exact: true }).click({ trial: true });
    await navigation.getByRole('link', { name: 'Prompt Packet', exact: true }).click({ trial: true });
    expect(errors).toEqual([]);
  });
}

test('empty and unavailable project feeds never display demo projects', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ json: { items: [], next: null } }));
  await page.goto(base);
  const shelf = page.locator('[data-project-filters]');
  await expect(shelf).toHaveAttribute('aria-busy', 'false');
  await expect(shelf.locator('[data-project-id], [data-demo-project]')).toHaveCount(0);
  await expect(shelf.locator('[data-live-empty]')).toContainText('No projects have been published yet.');
  await expect(shelf.getByRole('link', { name: 'Share what you’re building' })).toHaveAttribute('href', '/submit-project');
  await shelf.getByRole('button', { name: 'Featured', exact: true }).click();
  await expect(shelf.locator('[data-live-status]')).toHaveText('No projects in this collection yet.');
  await page.route('**/api/projects*', route => route.fulfill({ status: 503, json: { error: 'Unavailable' } }));
  await page.reload();
  await expect(shelf.locator('[data-live-status]')).toContainText('Projects are temporarily unavailable');
  await expect(shelf.locator('[data-project-id], [data-demo-project]')).toHaveCount(0);
  await expect(shelf.locator('[data-live-empty]')).toBeHidden();
  await expect(shelf).not.toHaveAttribute('aria-busy', 'true');
});
