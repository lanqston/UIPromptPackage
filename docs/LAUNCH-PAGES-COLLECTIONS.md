# Launch pages and private browser collections

## Scope and architecture

Vercel project `langston3/digitalpromptpackage` (`prj_SfARXMeiaJ6y6EIvhwtedHdN1ZJ1`), repository `lanqston/UIPromptPackage`. Astro static pages and existing Vercel Node functions are retained. No Supabase configuration or dependencies exist. The existing owner dashboard and Upstash Redis remain the only server identity/storage. Prompt Packet license access is not a visitor account.

The homepage uses the requested discovery headline and supporting copy. “Build. Share. Connect.” remains the brand line. This is a copy variant, not an experiment.

## Launch pages

Review a submission in `/admin`. Directory approval and launch publication are separate. Configure the supplied/approved bio, creator profile, CTA destination/label, screenshot descriptions, and optional gallery; confirm permission for **all** page fields. Save a launch draft, open **Preview saved draft**, then choose **Publish launch page**. The submission must already be approved (or featured). Ordinary page edits save a private draft and unpublish the page until explicitly published again. Reject/archive also withdraws its page. Existing directory moderation remains functional.

The page URL is `/projects/<initial-name>-<immutable-submission-id>`. The initial slug is assigned on the first page save and never changes when its title changes. Full IDs distinguish duplicate names; the atomic Redis save also rejects an occupied slug. Deleted IDs retain their slug reservation rather than reassigning a previously shared URL.

Vercel rewrites this URL to `/api/project-page`. It renders the shared Astro shell and approved fields into initial HTML, including title, description, canonical, Open Graph image/URL and Twitter card. The build generates `server/generated/project.html` and removes the public template route. The function must bundle that generated file. Draft previews use the same renderer behind the existing owner session and no-store headers; they are noindex. Public reads check the source record, moderation, explicit page publication, and permission on every request. Primary/gallery asset requests repeat those checks. Public data uses explicit field allowlists; emails, notes, consent and review metadata stay private.

Gallery: up to three raster screenshots. Browser uploads resize galleries to a 1600px maximum edge, compress to WebP, and cap each at 500KB. Primary images retain the existing 500KB raster validation. Useful alt text is required for published screenshots. No external screenshot fetch or SVG upload. Missing images have a fallback. URLs permit HTTP/HTTPS without embedded credentials; the owner must review destinations. External availability cannot be guaranteed.

## Additive schema migration and backfill

There is no relational/SQL migration and **no bulk database write**. Redis JSON records gain optional `launchVersion: 1`, immutable `slug`, `pagePublished`, and `page` (`bio`, `alt`, `ctaLabel`, `ctaUrl`, `consent`, raster `gallery`). The existing compare-and-save Lua transaction writes these fields and the `digivated:launch-slug:<slug>` → submission-ID reservation atomically. Revision conflicts fail without overwriting another edit.

Missing fields mean **no launch page**. Existing submissions remain unchanged until an admin opens, reviews and saves one. This lazy, per-record migration is the safe backfill approach: no previous approval is inferred to cover a new page. Existing public directory records remain visible. Review and publish each desired legacy page individually after confirming permission. No production data was migrated for this change.

Rollback: revert the branch/release and rebuild. Additional Redis fields are backward compatible. Existing moderation can still archive records. Previously shared launch URLs will be unavailable after removing the route; do not delete reserved slugs during rollback. Keep a provider-managed backup before production rollout.

## Collections

`/saved` is browser-only, with default **Saved items**, named folders, multi-folder membership, search/type filters, rename/delete, and JSON export/import. Save controls are buttons outside card links and use a native modal dialog with keyboard/focus behavior. Native sharing is progressive enhancement; Copy link has a selectable-text fallback.

The `digivated.collections` localStorage document has `version: 1` and collections containing **only typed stable IDs**. It never stores project/resource descriptions, screenshots, emails or private content. `/api/saved-item` resolves current public fields afresh; withdrawn/deleted items display unavailable and remain removable. Clearing browser data removes collections. No account, sync, public folders or server collection tracking exists. Anyone with access to the same browser profile can access its local data.

Imports validate size (<1MB), format/version, IDs/types, names (1–60 characters), up to 100 folders and 5,000 entries. They merge rather than replace, deduplicate membership and preserve conflicting folder IDs under a new ID. Unsupported versions and corrupt storage are not overwritten. Writes commit storage before updating the displayed state; quota/disabled-storage errors preserve prior data. Web Locks serialize edits between tabs where supported; fallback reads the latest document before writing but cannot guarantee simultaneous-tab serialization in browsers without Web Locks. Export JSON backups for safekeeping.

## Reproduce validation with isolated data

Use Node 24, `npm ci`, `ASTRO_TELEMETRY_DISABLED=1 npm run build`, `npm run check:syntax`.

Start a dedicated local Redis, bound to loopback, e.g. `docker run --rm -p 127.0.0.1:16379:6379 redis:7-alpine`. Tests use and clear databases 10–14 on this explicitly selected loopback fixture; never point them at real data.

- `DIGIVATED_TEST_REDIS_PORT=16379 npm test`
- `DIGIVATED_TEST_REDIS_PORT=16379 npx playwright test tests/browser/admin.spec.ts tests/browser/home-refresh.spec.ts tests/browser/launch-collections.spec.ts --workers=1`
- For a system Chromium, additionally set `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium`.

The Playwright configuration starts the local fixture harness on 4322 when Redis is configured. It uses actual HTTP handlers and Redis, dummy submissions, and a test-only owner password. The harness refuses to run on Vercel and is not imported by deployed functions. No fixture credentials or test records are enabled in the hosted application.

## Hosted preview and production rollout

This branch has no isolated preview Redis credentials. The hosted preview safely shows the updated homepage, browser collections and built-in resource, but database-backed content is empty and the admin API fails closed until a separate staging connection is configured. Shared `KV_*` integration variables are deliberately not reused: they also target production. Local integration coverage is not a claim of hosted writable-backend validation.

Before production:

1. Connect a **separate staging Redis database** using branch-scoped preview `SUBMISSIONS_REDIS_REST_URL` and `SUBMISSIONS_REDIS_REST_TOKEN`. Configure independent `DIGIVATED_ADMIN_PASSWORD_HASH` and `DIGIVATED_ADMIN_SESSION_SECRET`, and exact preview origins in `DIGIVATED_ADMIN_ORIGIN` and `SUBMISSIONS_ORIGIN`. Do not copy production storage credentials. Rebuild the preview.
2. Submit dummy staging content; approve its directory listing; save/preview/publish its launch page; test direct anonymous page/API/image access before and after unpublishing. Verify resource and project saves, export/import and responsive layout on the hosted preview. Delete/archive staging fixtures afterward.
3. Back up production Redis using provider facilities. Review the diff and validation evidence. No SQL or bulk backfill command is needed; no new production service or account variables are required.
4. Only with release authorization, merge the reviewed branch into `main`. The existing Git integration rebuilds with production settings. Do not promote a preview artifact or reuse staging credentials. Confirm the build creates and bundles the launch template.
5. Check homepage copy, `/saved`, anonymous admin denial and a nonexistent project 404. In the existing owner dashboard, review a specifically consented project, save its draft, and explicitly publish. Verify initial HTML metadata and screenshots; unpublish and confirm page/assets return 404. Do not automatically publish legacy submissions.
6. If needed, roll back the application to the previous production commit. Leave extra record fields and slug reservations intact. Collections remain in browser storage and can be exported when this version is restored.

No production deployment, production migration, paid service or experimentation platform is part of this branch.

## Validation recorded for this branch

- Production build: passed; 24 Astro pages generated, including an internal launch shell removed from public output after copying into the server bundle.
- Node tests: **72 passed, 0 failed, 0 skipped**, including isolated real-Redis permissions, revision conflicts, explicit publication, duplicate names/stable URLs, rejected/draft denial, asset withdrawal, deletion, private-field exclusion, literal content escaping, private-preview script removal, storage failures and import deduplication.
- Browser scenarios: **14 passed** across the relevant owner, homepage and new-feature suites. The launch-editor scenario was additionally extended and rerun with real screenshot upload/WebP compression, primary/gallery access, and screenshots at 375px and 1440px.
- Homepage checks: 320, 375, 768, 820, 1024 and 1440px; mobile/desktop screenshots inspected. One H1, exact copy, action destinations, existing carousel/filter behavior and no horizontal overflow passed.
- Collections: project/resource save, keyboard picker, multi-folder membership, remove from one folder, rename/delete, reload, search, export/import, malformed imports, unavailable items, disabled/quota storage and native-share stub passed. No card navigation on Save. Native OS share-sheet UI itself was not tested on physical devices.
- Syntax checks and `git diff --check`: passed. Encrypted paid-content verification was not run because its private edition key was not accessed; payment code is unchanged.
- Hosted preview HTTP: homepage and `/saved` 200; nonexistent project route and screenshot 404; built-in saved resource 200; `/api/projects` empty; unconfigured admin preview 503, containing only a setup error. No database writes were made against the hosted application.
- Hosted browser automation hit the execution environment's TLS certificate trust error. TLS verification was not disabled. Rendered visual evidence is from the local build with isolated test data; hosted HTTP evidence was collected through authenticated Vercel tools.

Changed files are listed in the pull request's Files changed tab; the implementation spans homepage/layout/styles, launch renderer/API/admin publishing, browser collections/resolver, build/Vercel routing, and test fixtures. Production remains on its existing `main` deployment.
