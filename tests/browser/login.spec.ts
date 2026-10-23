import { test, expect } from '@playwright/test';

test('login entry point exposes sign-in and sign-up email flows', async ({ page }) => {
  await page.route('**/api/project-account?action=config', route => route.fulfill({ json: { ready: false } }));
  await page.goto('http://127.0.0.1:4321/');
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
  await page.getByRole('link', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/login\/?$/);
  await expect(page.getByRole('heading', { name: 'Welcome to Digivated.' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sign in' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Sign up' }).click();
  await expect(page.getByRole('tab', { name: 'Sign up' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
  await expect(page.getByText('Account sign-in is temporarily unavailable.')).toBeVisible();
});
