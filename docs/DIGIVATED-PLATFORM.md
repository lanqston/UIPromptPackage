# Digivated platform maintenance

**Update: owner dashboard added.** Use `/admin` to review submissions, publish articles, and manage additional products. Read [the current dashboard guide](DIGIVATED-ADMIN.md) for setup and daily management. Dashboard publication updates the database-backed public pages immediately; the export/deploy and JSON editing instructions below describe the earlier implementation and are retained only as historical context.

The existing Astro/Vercel architecture and payment infrastructure are preserved. Only the original homepage and About source are replaced. Exact copies remain at `/ui-ux-prompt-packet` and `/about-langston`. The existing product Shell, product styles, license activation, paid content, and all old product/tool URLs remain intact. New pages share the isolated Platform layout and footer.

## Submission setup (required before accepting real submissions)

The existing backend has no database. This adds one small Vercel Node function using an Upstash Redis database over HTTPS, with no additional npm dependencies. Provision a dedicated private Redis database and set these **new server-only** Vercel variables:

- `SUBMISSIONS_REDIS_REST_URL`: its HTTPS REST endpoint.
- `SUBMISSIONS_REDIS_REST_TOKEN`: its write-capable REST token. Never use a PUBLIC_ prefix.
- `SUBMISSIONS_ORIGIN`: optional exact HTTPS origin; defaults to `https://digivated.vercel.app`. Set the specific preview origin for preview testing with a separate test database.

Do not rename, reuse, or modify payment variables. Redeploy through the existing Vercel project. No infrastructure was provisioned by this change. Until configured, valid submissions return a clear unavailable response and retain the user's form. A successful UI receipt is shown only after storage confirms the write. There is no email notification service.

`POST /api/submissions` validates all fields, consent and image signature/size; enforces same-origin JSON and a body limit; and atomically rate-limits each hashed Vercel-supplied IP to five saves/hour. It uses its own Redis counters, not the protected checkout firewall rule. Submissions are stored in private Redis keys `digivated:submission:<UUID>` and indexed in `digivated:submissions`. Records start `pending`; caller-supplied approval, feature and pick values are ignored. No new public read or admin API exists.

Images are optional JPG/PNG/WebP uploads up to 500 KB, held with the private record until review. No remote thumbnail requests or SVG uploads are accepted. The reviewer must inspect images and project URLs before approval. Social handles stay in the private review record until the owner supplies a full verified creator profile URL. Email, notes, and consent evidence never enter the public export. Set an owner retention practice and delete old rejected records in the Redis console when no longer needed; no automatic retention job is included.

## Review, approve, feature, and archive

From the repository root, load the two Redis credentials into your local shell using your normal secret manager or a private ignored `.env` file. Commands below can be run as `node --env-file=.env scripts/moderate-projects.mjs ...` if needed. Keep preview and production databases distinct. This is an owner CLI, not a user account system.

```sh
node scripts/moderate-projects.mjs list
node scripts/moderate-projects.mjs inspect SUBMISSION_UUID
node scripts/moderate-projects.mjs status SUBMISSION_UUID approved
node scripts/moderate-projects.mjs social SUBMISSION_UUID https://example.com/creator
node scripts/moderate-projects.mjs status SUBMISSION_UUID featured
node scripts/moderate-projects.mjs pick SUBMISSION_UUID true
node scripts/moderate-projects.mjs export
```

`inspect` shows private fields in your local terminal and writes an optional image to ignored `.private/submissions/`. Do not share that output publicly. Review the project and image before approving. `featured` requires prior approval and demotes the previous Featured Build to approved. `pick` also requires approval. Public eligibility is `approved` or its promoted `featured` state. Pending, rejected, archived, or records without consent cannot be exported. `status UUID rejected` or `status UUID archived` removes eligibility and clears its pick flag.

`export` writes only approved public fields to `src/data/projects.json` and approved images to `public/community/`. It removes withdrawn images from the working tree. **Review the diff, build, commit, and deploy through the existing Vercel workflow** to update the live directory. Approval changes are private until this export/deploy step; archiving likewise needs export/deploy to remove a live listing. Run one moderator at a time. Redis updates are durable but the CLI is intentionally simple; rerun export after any interrupted moderation operation. Git history may retain previously public images/details.

## Add resources

Add real articles to `src/data/resources.json`; keep unpublished work out of `published` status. The resource index, homepage, filters, static detail routes and related links are generated at build time. Put covers under `public/resources/` and use root-relative paths to comply with the existing image CSP. Example structure (replace all example values; do not publish dummy content):

```json
{
  "slug": "your-article-slug",
  "status": "draft",
  "title": "Your article title",
  "category": "UI/UX",
  "description": "A short, accurate summary.",
  "coverImage": "/resources/your-cover.jpg",
  "coverAlt": "Describe the cover",
  "date": "2026-10-05",
  "readingTime": 4,
  "content": [
    { "type": "heading", "text": "A useful starting point" },
    { "type": "paragraph", "text": "Your original article text." }
  ],
  "related": ["another-real-article-slug"]
}
```

Use a unique URL-safe slug, a listed category, ISO date, and positive reading time. Content is escaped text with headings/paragraphs, not raw HTML. Remove cover fields when no image is available. Set `status` to `published`, build and deploy when ready.

## Add another product

Add its name, description, existing destination URL, local image path, and label to `src/data/products.json`. The Products page reuses ProductCard. The homepage currently highlights the first product. New products need their own authorized product experience; never change or duplicate the existing packet's checkout. Its link remains `/ui-ux-prompt-packet`, whose buttons still lead to the original Gumroad URL.

## Payment protection and testing limits

See `DIGIVATED-INSPECTION.md` for the protected flow and `DIGIVATED-VALIDATION.md` for actual test results. No price is copied into the new product catalog. The live Gumroad structured product data observed during this work lists USD 5.99 (the older README/runbook lists 7.99). No price/provider configuration was changed.

There is no new account system, feed, comments, follows, likes, notifications, or paid membership. Public catalogs are intentionally empty at launch. Submissions storage requires setup and an integration smoke test against your own database before launch. Astro preview serves static pages only, not Vercel functions; automated handler fixtures are separate from real storage verification.
