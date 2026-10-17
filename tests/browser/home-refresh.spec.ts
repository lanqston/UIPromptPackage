import { test, expect } from '@playwright/test';
const base = 'http://127.0.0.1:4321';
const projects = Array.from({ length: 10 }, (_, index) => ({
  id: `home-${index}`, name: `Community build ${index}`, creator: 'Fixture maker',
  description: 'A reviewed community project.', category: 'Apps',
  url: `https://example.com/build-${index}`, status: index === 8 ? 'featured' : 'approved',
  pick: index === 9, views: index + 10,
}));
for (const width of [320, 375, 768, 820, 1024, 1440]) {
  test(`editorial home, topic navigation, and curated picks at ${width}px`, async ({ page }) => {
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
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Stay curious about what’s next.');
    await expect(page.locator('.hero-copy').getByRole('link', { name: 'Discover projects' })).toHaveAttribute('href', '/discover');
    await expect(page.locator('.hero-copy').getByRole('link', { name: 'Explore ideas' })).toHaveAttribute('href', '/resources');
    await expect(page.locator('.platform-header')).toHaveCSS('position', 'fixed');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(17, 17, 17)');
    await expect(page.locator('.hero-copy .primary')).toHaveCSS('background-color', 'rgb(245, 245, 245)');
    await expect(page.locator('.welcome-guide')).toBeVisible();
    await expect(page.locator('.welcome-guide > a')).toHaveCount(3);
    await expect(page.getByRole('navigation', { name: 'Explore Digivated topics' }).getByRole('link')).toHaveCount(4);
    await expect(page.getByRole('navigation', { name: 'Explore Digivated topics' }).getByRole('link', { name: /Markets & Investing/ })).toHaveAttribute('href', '/resources?category=Markets%20%26%20Investing');
    await expect(page.locator('.home-wayfinding, .discovery-guide')).toHaveCount(0);
    const shelf = page.locator('[data-live-projects=picks]');
    const cards = shelf.locator('[data-project]:visible');
    await expect(page.locator('.platform-header .x-brand-mark')).toBeVisible();
    await expect(cards).toHaveCount(1);
    await expect(cards).toContainText('Community build 9');
    await expect(cards.getByRole('link', { name: 'Visit Project' })).toHaveAttribute('href', 'https://example.com/build-9');
    await expect(shelf.locator('[data-project-filter]')).toHaveCount(0);
    await expect(shelf.locator('[data-demo-project]')).toHaveCount(0);
    await expect(page.locator('.idea-card')).toHaveCount(6);
    await expect(page.locator('.journey-steps li')).toHaveCount(3);
    await page.getByRole('heading', { name: 'Good to know.' }).scrollIntoViewIfNeeded();
    await page.getByText('Can I submit my project for free?').click();
    await expect(page.getByText('A submission does not guarantee')).toBeVisible();
    await page.locator('#projects').evaluate(el => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 100));
    await page.screenshot({path:test.info().outputPath(`project-browse-${width}.png`),fullPage:false});
    await expect(page.getByRole('navigation', { name: 'Legal footer links' }).getByRole('link', { name: 'Privacy & Data' })).toHaveAttribute('href', '/privacy');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => scrollTo(0, 0));
    if (width > 480) await page.locator('.header-submit').click({ trial: true });
    const navigation = page.getByRole('navigation', { name: width <= 1100 ? 'Mobile navigation' : 'Main navigation', exact: true });
    if (width <= 1100) await page.locator('.mobile-menu summary').click();
    await navigation.getByRole('link', { name: 'About', exact: true }).click({ trial: true });
    await navigation.getByRole('link', { name: 'Products', exact: true }).click({ trial: true });
    expect(errors).toEqual([]);
  });
}

test('empty and unavailable project feeds never display demo projects', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ json: { items: [], next: null } }));
  await page.goto(base);
  const shelf = page.locator('[data-live-projects=picks]');
  await expect(shelf.locator('[data-project-id], [data-demo-project]')).toHaveCount(0);
  await expect(shelf.locator('[data-live-empty]')).toContainText('Have something you’re building?');
  await expect(shelf.getByRole('link', { name: 'Submit your project' })).toHaveAttribute('href', '/submit-project');
  await page.route('**/api/projects*', route => route.fulfill({ status: 503, json: { error: 'Unavailable' } }));
  await page.reload();
  await expect(shelf.locator('[data-live-status]')).toContainText('Projects are temporarily unavailable');
  await expect(shelf.locator('[data-project-id], [data-demo-project]')).toHaveCount(0);
  await expect(shelf.locator('[data-live-empty]')).toBeHidden();
  await expect(shelf).not.toHaveAttribute('aria-busy', 'true');
});

