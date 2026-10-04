import { test, expect } from '@playwright/test';
import { assertPrivateSentryReporting } from '../../monitoring/assert-sentry';

test('browser exceptions pass through the real SDK with private data removed', async ({ page }) => {
  await page.goto('http://127.0.0.1:4321/access');
  await expect(page.getByRole('button', { name: 'Open full edition' })).toBeEnabled();
  await assertPrivateSentryReporting(page);
});
