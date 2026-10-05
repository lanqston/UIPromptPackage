# Dashboard validation

Verified locally on 2026-10-05. See [owner setup and operations](DIGIVATED-ADMIN.md).

## Results

- Production Astro build: passed (20 pages).
- Existing syntax checks, new setup/moderation script syntax, and `git diff --check`: passed.
- `DIGIVATED_TEST_REDIS_PORT=6387 npm test`: 38 passed, zero skipped. Includes original purchase access tests and dashboard integration against disposable Redis 7.4.2.
- Full Playwright suite: 10 passed. Chromium at 375, 768, and 1440 pixels; no horizontal overflow on tested routes. Dashboard screenshots inspected on mobile and desktop.
- Dashboard browser tests exercise the actual API handlers and real Redis through intercepted local browser requests: submit pending project, owner login, private review, approval, Pick, exclusive Featured Build, draft/published articles, safe article rendering, additional products, archiving, and sign-out. They do not test deployed Vercel routing or Upstash's REST transport.
- Security integration covers missing configuration, origin/CSRF checks, password failure, sign-in rate limiting, forged/expired sessions, rotation, logout, private-field exclusion, unpublished images/content, concurrent revision conflicts, and reserved product protection.

## Purchase regression scope

The original product page loads, its purchase control passes overlay/click hit-testing at all three widths, Products links to it, and the purchase URL remains `https://mccovery.gumroad.com/l/ui-prompt-package`. Browser navigation uses an intercepted destination fixture; no real payment was made. Existing activation/session/refund/outage tests pass using provider fixtures. No new local success/cancel routes were introduced; existing Gumroad behavior remains unchanged. Existing analytics/Sentry regression test passes.

Compared against production `origin/main`, these files are byte-for-byte untouched: `api/activate.js`, `api/edition.js`, `api/logout.js`, `server/access.mjs`, `server/handler.mjs`, `server/edition.enc.json`, `server/monitoring.mjs`, `src/pages/[section].astro`, `src/scripts/app.js`, `src/layouts/Shell.astro`, `src/styles/global.css`, `src/styles/reference-design.css`, `.env.example`, `astro.config.mjs`, `vercel.json`, `package.json`, and `package-lock.json`. The preserved product-page copy is unchanged by this dashboard update. No price, payment ID, payment variable, checkout logic, or buyer-session setting was edited.

## Changed files

- API/server: `api/{admin,content,projects}.js`, `server/{admin-auth,admin-handler,admin-store,public-community}.mjs`.
- Dashboard: `src/layouts/Admin.astro`, `src/pages/admin.astro`, `src/scripts/admin.js`, `src/styles/admin.css`.
- Live publishing: `src/components/LiveProjects.astro`, `src/scripts/live-content.js`, `src/pages/resources/read.astro`; updates to Home, Discover, Resources, Products, directory filtering, and platform styles.
- Operations: `scripts/setup-admin.mjs`, `scripts/moderate-projects.mjs`, this report and the owner guide; historical platform/validation guides now point to current instructions.
- Tests/CI: `tests/admin.test.mjs`, `tests/browser/admin.spec.ts`, `tests/helpers/redis.mjs`, `.github/workflows/admin-checks.yml`.

## Remaining live verification

Vercel environment metadata showed no submission-storage or admin variables at inspection. No database or live admin password was provisioned. Follow the owner guide to configure separate preview/production storage, credentials, and exact origins, then redeploy and run a real submission/approval/archive smoke test. Production submissions, live dashboard sign-in, and a real Gumroad transaction have **not** been verified. Chromium viewport tests are not physical iPhone/Safari testing. Live article bodies require JavaScript and have limited initial SEO metadata.
