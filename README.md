# UI Prompt Package

Astro website for the Beginner’s UI Prompting Playbook. Public samples, 75-topic catalog, prompt builder, and personal toolkit; full edition delivered by server-verified Gumroad access. Focus City is a separate project.

**Launch status: blocked pending Gumroad license setup, access to the correct Vercel project, rate-limit cost/configuration approval, and live purchase-flow verification.** This branch is not deployed to production. See [Gumroad launch runbook](docs/GUMROAD-LAUNCH.md) for exact setup, customer copy, test evidence, limits and rollback.

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
- No AI API calls or third-party analytics were added.

The source import/sealing scripts still operate on ignored `.private/` input and write server ciphertext. Keep its key securely backed up separately.

## Hosting

Existing production: https://digitalpromptpackage.vercel.app. Main is connected to Vercel; do not merge this branch until the launch gate in `docs/GUMROAD-LAUNCH.md` is satisfied. `.env.example` lists required server configuration without secrets. Backend access fails closed by default.

`RECOVERY-CHECKPOINT.md` and `REFINEMENT-CHECKPOINT.md` are historical; the launch runbook supersedes their shared-key access descriptions.
