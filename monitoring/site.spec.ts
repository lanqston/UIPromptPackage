import { test, expect } from '@playwright/test';
import { assertPrivateSentryReporting } from './assert-sentry';

// Public production flows only: never submit a license, purchase, or creator key.
test('PromptCove homepage, free prompt, and purchase access', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.name));
  const response = await page.goto('https://digivated.vercel.app/');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Better prompts.');
  await page.getByRole('link', { name: 'Try 3 free prompts', exact: true }).click();
  await expect(page.locator('#prompt-list .prompt-row')).toHaveCount(3);
  await page.locator('[data-open="1"]').click();
  await expect(page.locator('#prompt-dialog')).toBeVisible();
  await expect(page.locator('#prompt-dialog .prompt-text')).not.toBeEmpty();
  await page.goto('https://digivated.vercel.app/access');
  await expect(page.getByLabel('Gumroad license key')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open full edition' })).toBeEnabled();
  await expect(page.locator('#unlock-form')).toHaveAttribute('action', '/api/activate');
  expect(errors).toEqual([]);
  await assertPrivateSentryReporting(page);
});
