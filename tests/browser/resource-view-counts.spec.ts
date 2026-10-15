import { test, expect } from '@playwright/test';

test('published guides show stored counts before scrolling and update visible views', async ({ page }) => {
  const counts = new Map<string, number>();
  const writes = new Map<string, number>();
  await page.route('**/api/content?*', route => route.fulfill({ json: { items: [], next: null } }));
  await page.route('**/api/resource-views?*', async route => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'GET') {
      const views = Object.fromEntries(url.searchParams.getAll('id').map(id => [id, counts.get(id) ?? 17]));
      return route.fulfill({ json: { views } });
    }
    const id = url.searchParams.get('id')!;
    writes.set(id, (writes.get(id) ?? 0) + 1);
    const next = (counts.get(id) ?? 17) + 1;
    counts.set(id, next);
    return route.fulfill({ json: { views: next } });
  });
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto('http://127.0.0.1:4321/resources');
  const cards = page.locator('[data-builtin-resource][data-resource-view-id]');
  await expect(cards.first()).toBeVisible();
  const last = cards.last();
  const id = await last.getAttribute('data-resource-view-id');
  await expect(last.locator('[data-resource-views]')).toHaveText('17 views');
  expect(writes.get(id!)).toBeUndefined();
  await last.scrollIntoViewIfNeeded();
  await expect(last.locator('[data-resource-views]')).toHaveText('18 views');
  await page.reload();
  await expect(last.locator('[data-resource-views]')).toHaveText('18 views');
});
