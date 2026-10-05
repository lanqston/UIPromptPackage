# Existing site / protected purchase map

Inspected baseline: upstream `e5d1aa39a70e505b4946eda3413a14b1122045cf`.

- Stack: Astro 7 static output, vanilla browser JavaScript, npm/Node 24; Vercel Node functions in `api/`. No application database.
- Routes: `/`, `/about`, `/start`, `/library`, `/fixes`, `/builder`, `/workflows`, `/checklists`, `/learn`, `/toolkit`, `/access`, and 404.
- Product landing page: `src/pages/index.astro`. Preserve its exact contents in `src/pages/ui-ux-prompt-packet.astro` before changing the homepage.
- Flow: landing/Shell/access purchase links → `https://mccovery.gumroad.com/l/ui-prompt-package` → Gumroad checkout and receipt/license delivery → `/access` → POST `/api/activate` → live Gumroad license verification → encrypted HttpOnly session → GET `/api/edition` with renewed verification → paid tools. POST `/api/logout` signs out.
- Product ID: `ELdVVW1-tlMwQyuADA6C0A==`. Existing README/runbook price: USD 7.99 one-time, controlled on Gumroad. No local price calculation. The live Gumroad Product/Offer structured data checked October 5 lists USD 5.99; no price settings were changed.
- No local checkout success/cancel routes or webhooks. Gumroad handles payment confirmation/cancellation; local activation success is handled in `src/scripts/app.js`.
- Protected: `api/activate.js`, `api/edition.js`, `api/logout.js`, `server/access.mjs`, `server/handler.mjs`, `server/edition.enc.json`, `src/pages/[section].astro`, `src/scripts/app.js`, `src/layouts/Shell.astro`, existing CSS, `.env.example`, `astro.config.mjs`, `vercel.json`, package manifests/lockfile.
- Payment environment names: ACCESS_ENABLED, APP_ORIGIN, GUMROAD_PRODUCT_ID, SESSION_SECRET, EDITION_KEY, ALLOW_TEST_PURCHASES; VERCEL_ENV controls preview test purchases. No values changed or secrets retrieved.
- Analytics: hostname-scoped GA4 `G-BRXWQ313J5` in `public/analytics.js`; optional GA4 visitor-report API/component; privacy-filtered browser/server Sentry; Checkly monitoring. Retain original files and load existing analytics/monitoring on new pages.
- Reusable design: global typography/buttons/forms/panels in `global.css`; product overrides in `reference-design.css`; Shell includes product navigation, mobile menu, footer and purchase CTA; VisitorCard is reusable. New platform layout uses original global primitives plus its own scoped warm-neutral overrides, never loaded by the protected Shell.
- Responsive baseline: 1150/1100/1000/850/600px rules; mobile menu and full-width purchase button. Product mobile styles remain unchanged.
- Existing checks: npm test, check:syntax, build, Playwright/Sentry checks. verify:content requires a private decryption key which is not available here.

New submissions will use a separate Vercel function and dedicated Upstash Redis REST credentials. No payment configuration or entitlement storage is reused. Only owner-reviewed public projections are committed to the public project catalog. Pending records, email, consent and notes stay in private Redis storage.
