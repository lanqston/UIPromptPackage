# UI Prompt Package — beginner-friendly AI design prompts

Have an idea for a website or app, but can’t quite get it to look the way you imagined? PromptCove helps you figure out what to change, what to expect, and what to ask AI next.

**[Explore the package and try 3 prompts free](https://digivated.gumroad.com/l/ui-prompt-package?utm_source=github&utm_medium=referral&utm_campaign=readme)** · See the current price on Gumroad.

- 75 prompts for website and app UI design, with customization and follow-up guidance.
- 8 step-by-step workflows, 8 review checklists, and a prompt builder.
- Created by a grad student who wanted useful guidance to be affordable.

**New to UI prompting?** Start with the [free beginner guide](BEGINNER-UI-GUIDE.md): describe one problem, try one change, and ask a better follow-up.

## Developer documentation

Astro website for the Beginner’s UI Prompting Playbook. Public samples, 75-topic catalog, prompt builder, and personal toolkit; full edition delivered by server-verified Gumroad access. Focus City is a separate project.

**Deployment status:** The launch runbook records production deployment on October 3, 2026, successful preview seller-test activation and user-confirmed sign-out/re-entry, and production negative smoke checks. A real non-test production purchase and live revocation remain unverified. See the [Gumroad launch runbook](docs/GUMROAD-LAUNCH.md) for evidence, limits and rollback.

## Run and verify

Node.js 24: `npm ci`, `npm run dev`, `npm run build`, `npm test`, `npm run check:syntax`.

Astro creates 12 public static pages in `dist/`. Paid content is not in those pages/bundles. `/api/activate`, `/api/edition`, and `/api/logout` are Vercel Node functions; Astro's dev server alone does not run them. Local unit tests inject fixture dependencies, never production bypass flags. For UI fixture checks only, with the private edition key available and after a build: `node tests/preview-server.mjs` on localhost:4173. This fixture server is not a production server.

`npm run verify:content` needs ignored `.private/owner-key.txt`; it decrypts the server ciphertext to validate content and scans `dist/` for leaks. Never commit the key or plaintext edition.

## Content and access

- Public catalog: titles/descriptions; free prompts 01, 14 and 46 plus a sample workflow, checklist and lesson.
- `server/edition.enc.json`: encrypted full edition, packaged only with server functions.
- `EDITION_KEY`: server-only decryption key. The old browser shared-key flow is removed and legacy sessionStorage keys are cleared.
- Gumroad license → live server verification → encrypted HttpOnly cookie → live verification again on each paid fetch. No account/email linking, local entitlement database or notification receiver.
- Notes/progress/favorites remain in localStorage with existing export/import. Neither paid content nor licenses are included in backups.
- No AI API calls are used. Production visitor analytics uses Google Analytics 4; see `docs/visitor-analytics.md` for collection and reporting setup.

The source import/sealing scripts still operate on ignored `.private/` input and write server ciphertext. Keep its key securely backed up separately.

## Educational carousels

Public pages: `/carousels` and `/carousels/<slug>`. Anyone can read the title, summary, and the first four slides. Slide 5 and later, their images, and the reference list are returned only by `GET /api/carousels` after a founding-member session. Locked image requests never receive image bytes. While `FOUNDING_ACCESS_ENABLED` is not `true`, sign-in stays off and locked slides say the full carousel is coming soon, with a link to `/founding-members`.

Publishing does not require a code change or a database migration. Carousels are stored in the existing submissions Redis under new `digivated:carousel:` keys. Set these on the Vercel environment that should receive the carousel (preview and production can share Redis; a publish then becomes readable wherever that Redis is read):

- `CAROUSEL_PUBLISH_SECRET`: 64 hex characters (`openssl rand -hex 32`). The publish route rejects requests until this is set.
- `SUBMISSIONS_REDIS_REST_URL` and `SUBMISSIONS_REDIS_REST_TOKEN`: already used by submissions. No new table.

```bash
CAROUSEL_PUBLISH_URL=https://your-preview-host/api/carousel-publish \
CAROUSEL_PUBLISH_SECRET=... \
node scripts/publish-carousel.mjs path/to/carousel.json
```

`carousel.json` fields: `slug`, `title`, `summary`, `created` (optional ISO date), `references` (`label`, `https` `url`, optional `note`), and `slides`. A carousel needs 7 to 16 slides. Each slide needs `text`, `alt`, and an `image` data URL (`image/png`, `image/jpeg`, or `image/webp`, up to 350 KB). The same slug replaces the stored carousel. The route is `POST /api/carousel-publish` with `Authorization: Bearer $CAROUSEL_PUBLISH_SECRET` and `Content-Type: application/json`.

Keep member sign-in off during prelaunch. Turn it on only after the Founding Member Pass is published on Gumroad with license keys enabled, and after these are set:

- `FOUNDING_ACCESS_ENABLED=true`
- `FOUNDING_GUMROAD_PRODUCT_ID`: the founding product id, not the Prompt Packet id
- `FOUNDING_SESSION_SECRET`: a new 64-hex secret, not `SESSION_SECRET`
- `FOUNDING_GUMROAD_ACCESS_TOKEN`: a seller token with `view_sales`, used to match a purchase email
- `APP_ORIGIN`: the existing site origin
- `FOUNDING_ALLOW_TEST_PURCHASES`: preview only, same rule as packet test purchases

Sign-in is `POST /api/founding-access` with either `{ "license" }` or `{ "email" }`. It uses a separate `__Host-founding-session` cookie and checks Gumroad again on every full read. A packet license cannot open a carousel. `POST /api/founding-logout` clears only the founding cookie.

No migration is required. Do not apply this to production Redis, production environment variables, or a production deploy until you mean to publish the library on the live site.

## Hosting

Existing production: https://digivated.com. Main is connected to Vercel; review the latest production-release entry in `docs/GUMROAD-LAUNCH.md` before making deployment changes. `.env.example` lists required server configuration without secrets. Backend access fails closed by default.

`RECOVERY-CHECKPOINT.md` and `REFINEMENT-CHECKPOINT.md` are historical; the launch runbook supersedes their shared-key access descriptions.
