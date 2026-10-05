# UI Prompt Package — beginner-friendly AI design prompts

Have an idea for a website or app, but can’t quite get it to look the way you imagined? PromptCove helps you figure out what to change, what to expect, and what to ask AI next.

**[Explore the package and try 3 prompts free](https://mccovery.gumroad.com/l/ui-prompt-package?utm_source=github&utm_medium=referral&utm_campaign=readme)** · Full package: **$7.99, one-time**.

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

## Hosting

Existing production: https://digitalpromptpackage.vercel.app. Main is connected to Vercel; review the latest production-release entry in `docs/GUMROAD-LAUNCH.md` before making deployment changes. `.env.example` lists required server configuration without secrets. Backend access fails closed by default.

`RECOVERY-CHECKPOINT.md` and `REFINEMENT-CHECKPOINT.md` are historical; the launch runbook supersedes their shared-key access descriptions.
