# Validation report — October 5, 2026

Baseline: `e5d1aa39a70e505b4946eda3413a14b1122045cf` on the existing `lanqston/UIPromptPackage` repository. No production merge or deployment was performed during implementation.

## Passed

- Baseline production build and original unit tests before implementation.
- Updated Astro production build: 18 static pages. No framework, manifest, lockfile, deployment config, or payment environment edits.
- `npm test`: all five test files pass, including existing purchase/license/session/rate-limit/monitoring/visitor tests and new submission validation/privacy tests.
- `npm run check:syntax`, direct syntax checks for the new server/CLI modules, and `git diff --check`.
- Seven Playwright checks pass using installed Chromium. Existing Sentry browser privacy test passes with the real SDK and intercepted synthetic reporting.
- Nine routes tested at 375px, 768px and 1440px: Home, Discover, Resources, Products, Submit Project, About, preserved product page, Access, and Library. All load, no horizontal overflow, all images load after scrolling, no uncaught JavaScript errors.
- Product purchase CTA remains visible and passes browser click hit-testing at all three widths; no overlay blocks it. Products → preserved product page → exact existing Gumroad URL is checked with an intercepted provider destination. No new checkout exists.
- Mobile menu navigation and Discover search/category/pick controls tested. Empty-state directories contain no invented projects or articles.
- Submission UI → actual new validation handler → injected storage fixture tested. Missing consent prevents sending. Success confirms only a saved pending record. Test submissions never appear publicly. Storage failure preserves form inputs and displays an error.
- Server checks reject malformed/oversized requests, cross-origin requests, bad methods/content types, unsafe project URLs, invalid image signatures, and caller-supplied publishing flags. Public export excludes email, notes and consent evidence.
- Byte comparisons confirm the protected files below match the upstream baseline, and `ui-ux-prompt-packet.astro` exactly matches the original homepage. The original About page is retained exactly at `about-langston.astro`.
- Live read-only checks: production homepage HTTP 200; anonymous `/api/edition` HTTP 401 with the expected safe access-denied response; existing Gumroad product data is reachable and lists USD 5.99. The older source documentation's 7.99 value is not used in the new pages.

## Protected files intentionally untouched

```
api/activate.js
api/edition.js
api/logout.js
server/access.mjs
server/handler.mjs
server/edition.enc.json
server/monitoring.mjs
src/pages/[section].astro
src/scripts/app.js
src/layouts/Shell.astro
src/styles/global.css
src/styles/reference-design.css
.env.example
astro.config.mjs
vercel.json
package.json
package-lock.json
public/analytics.js
src/scripts/monitoring.js
src/lib/monitoring-privacy.mjs
```

Also unchanged: original analytics API/component, monitoring deployment scripts, original test files, product catalog/demo data, source images, and all product tool routes. The old product navigation/footer stays in its protected Shell; new platform pages use the new global Platform navigation/footer. Product price is managed on Gumroad and has not been changed. There are no repository-local success/cancel routes or payment webhooks to modify.

## Limits / launch requirements

- Upstash Redis has not been provisioned or connected. Configure the new server-only submission credentials, then verify a real submission, moderation/export, and deployment before accepting public submissions. Tests inject storage and do not establish real Redis persistence, Lua execution, or Vercel edge behavior.
- No real payment, seller test purchase, receipt delivery, valid production license activation, or live revocation was performed. Existing access unit fixtures cover successful activation/return/logout and failures; this is not an end-to-end paid-transaction confirmation.
- A real browser click toward Gumroad reached a certificate-authority warning in this proxied execution environment. The warning was not bypassed. Provider availability/price was checked separately over HTTPS using the environment's trusted command-line certificate configuration; a complete live browser checkout remains unverified.
- No payment settings, production environment values, success/cancel provider settings, or webhooks were inspected inside the seller account. They were not edited.
- Browser checks use Chromium with phone/tablet viewport dimensions, not physical iPhone Safari or tablet hardware.
- `verify:content` cannot run without the private edition decryption key. No private key was requested or accessed. No dedicated lint/typecheck scripts exist in the repository; existing syntax/build checks were used.
- Public directory/content changes require export/build/deploy; there is no live admin dashboard. Do not submit private information in project descriptions, which become public when approved.
- New resource-detail rendering and populated cards have not been exercised with real published content because the catalogs are intentionally empty. Review real content before its first publication.

## Changed-file map

- Replaced only `src/pages/index.astro` and `src/pages/about.astro` among existing source files.
- Added platform routes: `discover.astro`, `products.astro`, `submit-project.astro`, `resources/index.astro`, `resources/[slug].astro`; preserved originals as `ui-ux-prompt-packet.astro` and `about-langston.astro`.
- Added `src/layouts/Platform.astro`, `src/styles/platform.css`, and `src/components/{EmptyState,ProductCard,ProjectCard,ResourceCard}.astro`.
- Added `src/data/{community.mjs,products.json,projects.json,resources.json}` and `src/scripts/{directory,submission}.js`.
- Added `api/submissions.js`, `server/{submissions,community-publication}.mjs`, and `scripts/moderate-projects.mjs`.
- Added `tests/submissions.test.mjs` and `tests/browser/platform.spec.ts`.
- Added `docs/DIGIVATED-{INSPECTION,PLATFORM,VALIDATION}.md` for the inspection map, owner guide and this report.
