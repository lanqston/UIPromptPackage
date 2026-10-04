import { expect, type Page } from '@playwright/test';

export async function assertPrivateSentryReporting(page: Page) {
  const envelopeUrl = '**/api/*/envelope/**';
  // Intercept synthetic errors: scheduled monitoring must not pollute Sentry.
  await page.route(envelopeUrl, route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: '{}',
  }));
  const request = page.waitForRequest(request => request.url().includes('.ingest.us.sentry.io/api/') && request.url().includes('/envelope/'), { timeout: 10000 });
  await page.evaluate(() => {
    window.dispatchEvent(new ErrorEvent('error', {
      message: 'PRIVATE_MONITORING_FIXTURE',
      error: new TypeError('PRIVATE_MONITORING_FIXTURE'),
    }));
  });
  const body = (await request).postData() || '';
  expect(body).not.toContain('PRIVATE_MONITORING_FIXTURE');
  const event = body.split('\n').map(line => {
    try { return JSON.parse(line); } catch { return {}; }
  }).find(item => item.exception);
  expect(event?.tags.source).toBe('browser');
  expect(event?.exception.values[0].type).toBe('TypeError');
  expect(event?.request).toBeUndefined();
  expect(event?.user).toBeUndefined();
  expect(event?.breadcrumbs).toBeUndefined();
}
