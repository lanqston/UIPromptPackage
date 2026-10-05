# Digivated UI refinement

## Inspection and protected map

Baseline: production `2dedc53` (project views release). Astro 7 static pages with
vanilla browser scripts and Vercel Node API functions. Existing warm-white, cream,
taupe and charcoal tokens remain. Platform and Admin load platform.css; the original
product Shell loads its own global/reference styles and is visually isolated.

Routes remain: Home, Discover, Resources and resource detail URLs, Products, About,
Submit Project, Admin, UI/UX Prompt Packet, About Langston, Start, Access, Library,
Fixes, Builder, Workflows, Checklists, Learn, Toolkit and 404.

- Discover: approved/featured public Redis projections; search, category, newest,
  featured and Picks filters. View counters are independent Redis keys and use the
  existing one-second visibility/24-hour deduplication behavior.
- Submissions: unchanged form field names, native constraints, image validation and
  submission.js POST to /api/submissions. Upstash stores private pending records.
  Admin approval controls public visibility; email and notes remain private.
- Resources: published content API and existing read?slug= detail pages; related
  resources and legacy static article routes remain. All categories are retained.
- Products: existing packet card links to /ui-ux-prompt-packet, then existing Gumroad
  checkout at https://mccovery.gumroad.com/l/ui-prompt-package. Gumroad controls price,
  receipt, license delivery and payment confirmation/cancellation. No local checkout
  success, cancel or webhook routes exist. /access -> /api/activate -> encrypted
  buyer cookie -> /api/edition re-verifies access; /api/logout clears buyer access.
- Payment variables remain ACCESS_ENABLED, APP_ORIGIN, GUMROAD_PRODUCT_ID,
  SESSION_SECRET, EDITION_KEY, ALLOW_TEST_PURCHASES. No environment changes.
- GA4, visitor analytics, Sentry and Checkly are retained unchanged.

## Presentation changes

- Stronger hero typography and a layered composition with real destinations only.
- Shared SectionHeader and IconLink components; HeroComposition isolates the hero
  presentation. Existing EmptyState/ProductCard/ProjectCard/ResourceCard reused.
- Featured Build uses a wide image/copy treatment; Picks uses a warmer container;
  the resource library uses a larger leading card. Empty states stay intentional.
- Important section, project, resource and empty-state CTAs now use proper button
  styling on semantic links. Product and form actions retain their destinations.
- Decorative empty-state plus signs replaced with a noninteractive document motif.
  The hero's 50px circular plus links to Submit Project with an accessible label.
  The mobile Menu plus became a two-line menu/close icon inside native details.
- Native mobile menu gains Escape, outside-click and focus-leaving dismissal;
  Escape returns focus. Nested resource routes now show the Resources active state.
- Resource category chips are real buttons synchronized with the existing select;
  homepage category links open the matching resource filter. Singular result counts
  fixed ("1 project found"). No storage or API changes.
- Submission fields grouped with fieldset/legend; private/help text and all input
  constraints retained. Larger controls and visually distinct status messages.
- Reduced-motion support, visible focus, 44–50px targets and safe-area padding.
  Only tiny decorative footer arrow glyphs were removed; social URLs remain.

## Protected files intentionally untouched

`api/activate.js`, `api/edition.js`, `api/logout.js`, `server/access.mjs`,
`server/handler.mjs`, `server/edition.enc.json`, `server/monitoring.mjs`,
`src/pages/ui-ux-prompt-packet.astro`, `src/pages/[section].astro`,
`src/layouts/Shell.astro`, `src/scripts/app.js`, `src/styles/global.css`,
`src/styles/reference-design.css`, `.env.example`, `astro.config.mjs`, `vercel.json`,
`package.json`, `package-lock.json`. All backend/API files, submission.js,
project-views.js, admin.js and analytics files are also unchanged in this pass.

## Files changed

- `src/styles/platform.css`, `src/layouts/Platform.astro`
- `src/components/EmptyState.astro`, `ProductCard.astro`, `ProjectCard.astro`,
  `ResourceCard.astro`, new `HeroComposition.astro`, `IconLink.astro`, `SectionHeader.astro`
- `src/pages/index.astro`, `about.astro`, `submit-project.astro`, `resources/index.astro`
- `src/scripts/live-content.js`, `directory.js`, new `platform-ui.js`
- `tests/browser/project-views.spec.ts`, new `refinement.spec.ts`
- `.github/workflows/admin-checks.yml`, this report

## Validation scope

Node integration tests exercise real isolated Redis and provider fixtures; browser
integration tests intercept API requests into real handlers/Redis. Tests cover private
submission and publication, resource/product editing, repeat project views, original
purchase link destinations and hit targets. Browser fixtures never enter production.
The new refinement tests check menu Escape/outside dismissal/focus return, category
chips/select synchronization, resource links, field groups, reduced motion and overflow.

All 511 rendered internal links resolve to existing built destinations. No routes
were removed. Build and JavaScript syntax checks pass. The repository does not have
standalone lint/typecheck scripts; Astro generates types during the build. Paid-content
`verify:content` still requires the unavailable local `.private/owner-key.txt`. No actual
Gumroad charge is made by these checks, and no payment settings or price are changed.
Viewport tests use Chromium, not physical iPhone/Safari devices.

Results: 40 Node tests passed with no skips. All 15 UI/functional browser tests passed
at 375, 390, 430, 768, 1280 and 1440px across the suites. Sentry's separate browser
privacy test requires the same PUBLIC_SENTRY_DSN test value as existing CI; it is
verified using that build configuration, without changing application configuration.
