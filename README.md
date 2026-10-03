# UI Prompt Package

Astro website for the Beginner’s UI Prompting Playbook. Includes a public demo and an encrypted full edition, plus a local prompt builder and toolkit. Focus City is a separate project.

## Run

Use Node.js 24. `npm ci`, then `npm run dev`. `npm run build` generates 12 static pages (including the not-found page) in `dist/`. If telemetry cannot write its configuration in a restricted environment, set `ASTRO_TELEMETRY_DISABLED=1`.

## Content and access

- Public catalog: 75 titles and short descriptions.
- Free samples: prompts 01, 14, 46; one workflow, one checklist, one lesson.
- `public/edition.enc.json`: complete edition encrypted with AES-256-GCM and a random 256-bit edition key.
- Full source and the key live in ignored `.private/`. Never commit them, the owner access file, or plaintext PDF/Word exports.
- The publisher keeps the key separately. It unlocks content in a browser tab; it is not payment verification, a per-customer license, or DRM. A key holder can copy the content. Checkout and automated Gumroad delivery are intentionally closed.
- Do not open sales before configuring purchase verification and an appropriate delivery/revocation strategy.

The import script accepts extracted text from the owner's expanded PDF: `python3 scripts/prepare-content.py /path/to/playbook-source.txt`. It validates 75 prompts, 8 workflows, and 8 checklists. Then run `node scripts/seal-content.mjs` to encrypt. Existing keys are preserved. Run `node scripts/verify-content.mjs` after a build with the private key available.

Favorites, reviewed prompts, workflow/checklist progress, notes, and builder inputs use localStorage. Export/import merges backups without including edition keys or paid content. Access keys use sessionStorage. There is no account service, cloud sync, analytics, or AI API.

## Deployment

`vercel.json` retains Astro, Node 24 from package.json, `npm ci`, `npm run build`, and `dist`. The existing Git integration publishes main to https://digitalpromptpackage.vercel.app. This is separate from Focus City.

See `REFINEMENT-CHECKPOINT.md` for the current route-by-route implementation and browser verification record.

## Recovery checkpoint

The prior public repository contained only a coming-soon page. This implementation reconstructed the requested experience from `UI_Prompting_Playbook_Expanded_Draft.pdf` (85 pages, 75 prompts). The original source document remains unchanged.
