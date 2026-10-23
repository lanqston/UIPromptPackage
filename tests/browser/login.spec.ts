import { test, expect } from '@playwright/test';

test('login entry point exposes sign-in and sign-up email flows', async ({ page }) => {
  await page.route('**/api/project-account?action=config', route => route.fulfill({ json: { ready: false } }));
  await page.goto('http://127.0.0.1:4321/');
  await expect(page.getByRole('link', { name: 'Account', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Account', exact: true }).click();
  await expect(page).toHaveURL(/\/login\/?$/);
  await expect(page.getByRole('heading', { name: 'Welcome to Digivated.' })).toBeVisible();
  await page.getByRole('link', { name: 'Browse featured projects' }).click();
  await expect(page).toHaveURL(/\/discover\?view=featured$/);
  await expect(page.getByRole('button', { name: /Featured/ })).toHaveAttribute('aria-pressed', 'true');
  await page.goto('http://127.0.0.1:4321/login');
  await expect(page.getByRole('tab', { name: 'Sign in' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Sign up' }).click();
  await expect(page.getByRole('tab', { name: 'Sign up' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
  await expect(page.getByText('Account sign-in is temporarily unavailable.')).toBeVisible();
});

test('verified account shows a signed-in header, welcome, account, and sign-out', async ({ page }) => {
  const email = 'verified@example.invalid';
  const user = { id: '4ad90c9b-5666-482d-899c-d0d3ef41ee46', email, email_confirmed_at: '2026-10-23T00:00:00Z', role: 'authenticated', aud: 'authenticated' };
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const token = [Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, email, exp: expires, amr: [{ method: 'magiclink' }] })).toString('base64url'), 'fixture'].join('.');
  await page.addInitScript(({ token, user, expires }) => {
    localStorage.setItem('sb-fixture-auth-token', JSON.stringify({ access_token: token, refresh_token: 'fixture', expires_at: expires, expires_in: 3600, token_type: 'bearer', user }));
  }, { token, user, expires });
  await page.route('**/api/project-account?action=config', route => route.fulfill({ json: { ready: true, url: 'https://fixture.supabase.co', key: 'sb_publishable_fixture' } }));
  await page.route('**/api/project-account?action=me', route => route.fulfill({ json: { email } }));
  let submissionsAvailable = false;
  await page.route('**/api/project-account', route => submissionsAvailable ? route.fulfill({ json: { email, submissions: [] } }) : route.fulfill({ status: 503, json: { error: 'Submissions unavailable.' } }));
  await page.route('https://fixture.supabase.co/auth/v1/**', route => route.fulfill({ json: user }));
  await page.goto('http://127.0.0.1:4321/discover?view=featured&signed_in=1');
  await expect(page.getByRole('link', { name: /My account, signed in as/ })).toBeVisible();
  await expect(page.locator('#account-welcome')).toContainText(`You're logged in as ${email}.`);
  await expect(page).toHaveURL(/\/discover\?view=featured$/);
  await page.getByRole('link', { name: /My account, signed in as/ }).click();
  await expect(page.locator('#account-state')).toContainText(`You're logged in as ${email}.`);
  await expect(page.locator('#account-submissions')).toContainText('Submissions unavailable.');
  submissionsAvailable = true;
  await page.reload();
  await expect(page.getByText('No submissions are linked to this account yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login\/?$/);
  await expect(page.getByRole('link', { name: 'Log in', exact: true })).toBeVisible();
});
