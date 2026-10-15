import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  // Community is intentionally unpublished; community-paused.spec.ts verifies its replacement behavior.
  // Retain these feature suites for a future relaunch.
  testIgnore: ['**/community.spec.ts', '**/community-polish.spec.ts', '**/community-auth.spec.ts'],
  timeout: 30000,
  use: { headless: true, launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {} },
  webServer: [{
    command: 'npm run preview -- --host 127.0.0.1 --port 4321 --ignore-lock',
    url: 'http://127.0.0.1:4321',
    timeout: 30000,
    reuseExistingServer: !process.env.CI,
  }, ...(process.env.DIGIVATED_TEST_REDIS_PORT ? [{ command: 'node tests/launch-preview-server.mjs', url: 'http://127.0.0.1:4322', timeout: 30000, reuseExistingServer: !process.env.CI }] : [])],
});
