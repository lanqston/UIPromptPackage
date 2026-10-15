# Digivated Community review

Community lives under `/community`, separate from existing routes. Supabase contains only new member data. Existing submissions, owner authentication, product access and views continue using their existing storage.

## Connected

- Supabase project `cglkjclolglwizwepvmy`
- Public schema, RLS, media bucket and realtime publication installed
- Branch `feature/digivated-community` has preview-scoped public URL, publishable key and exact branch origin in Vercel
- Original project records confirmed through the live public API. AppAtlas had 47 views and KinetixSEO had 56 when inspected. These are observations, not seed values.
- Initial curated picks are selected by their existing IDs only while approved. The existing owner Pick checkbox writes an explicit override, allowing removal and readdition. No project copies or view counter writes.

## Required before launch

Configure these directly in the service dashboards. Do not paste secret keys into chat or commit them.

1. Vercel preview branch environment needs `COMMUNITY_SUPABASE_SECRET_KEY` from this Supabase project's secret API keys. It is now used only by the legacy Vercel upload endpoint and owner moderation handler. The Community UI uploads through the deployed Supabase `community-upload` Edge Function, which uses native server credentials and a fixed per-member SQL budget; image uploads no longer depend on a Vercel service secret.
2. `COMMUNITY_ORIGIN` is configured for the stable preview branch URL. Redeploy after adding remaining variables. Preserve existing owner authentication secrets and configure its preview origin using the existing owner setup. Existing Redis credentials are required for owner sessions and upload limits. Production owner credentials must not be rotated or replaced.
3. Supabase Auth URL Configuration needs the exact preview `/community/settings` redirect and eventual `https://digivated.vercel.app/community/settings`. Set the production site URL to Digivated at launch. Configure email delivery for public signups and keep verification enabled.
4. Configure Google OAuth in Supabase and its Google Cloud consent/client settings, using the Supabase callback URL. Enable `COMMUNITY_GOOGLE_ENABLED=true` only after it works.
5. Verify real email signup, redirect, avatar upload, post image upload, two-account follows and likes, chat delivery across browsers, reports and owner hide/restore/suspend/unsuspend. Until these pass, keep this a draft preview.
6. Add public config and server secret to Production only at launch, then deploy this reviewed branch. Do not change existing sales or analytics settings.

## Verification

- Build generates all new routes.
- Node tests cover configuration fail-closed behavior, rejected image types/size, server secret isolation, and original pick overrides.
- `tests/sql/community-permissions.sql` runs temporary accounts and content in one rolled-back transaction. It verifies ownership, protected moderation columns, follow/unfollow, like/unlike, private saves and suspension enforcement. It passed against the connected project and leaves no members or posts behind.
- Community browser CI passed at 390 and 1440 pixels. Owner dashboard regression CI passed, including real isolated Redis sessions, submissions, publishing, view counters, collections and purchase links.
- Browser CI captures mobile and desktop screenshots and checks logged-out onboarding, public reads, navigation and sign-in gating. It supplies public configuration to the static test server and reads the real empty Supabase feed. It does not claim to test email delivery or server uploads.

## Schema source

`database/community.sql` is the consolidated setup for a fresh database, not a migration to rerun on this project. Applied migrations are tracked by Supabase. The private write-limit table retains usage across deleted posts so deleting content cannot reset limits. Suspension records have no member grants or policies by design.

## Remaining limitations

- Chat shows a live connection indicator and the actual number of connected authenticated presence keys. This is room presence, not a historical activity estimate.
- Member project posts appear on profiles. Ownership of older submissions is not inferred from names or email. A reviewed ownership-claim flow can associate them later.
- Feed and reply pagination use 20 items. Chat initially shows 60 messages and can load earlier history. Post counters are exact SQL aggregates.

## October 15 UI completion pass

- Editorial charcoal/mint feed, rounded cards, persistent mobile navigation, richer skippable onboarding.
- Searchable member directory and genuine member suggestions; no seeded/fake activity.
- Five profile atmospheres, custom covers, avatar/cover previews, project filters, exact post counts.
- Composer image preview/removal, counters, enlarged media, edit/report dialogs, reply pagination and parent context.
- Fixed unmute accidentally submitting the settings form; errors surface inside open dialogs.
- `community-profile-polish.sql` applied additively to the connected project. Do not rerun it.
- `supabase/functions/community-upload/index.ts` deployed. Custom authentication calls Auth `getUser` on every request, requires verified non-anonymous users, checks suspension via the budget RPC, validates file signature/size, and stores only under the authenticated member ID. Gateway JWT validation is disabled because the function performs that validation itself.
- Local production build and 92 Node checks pass (3 Redis-dependent tests skipped locally). Transactional live SQL verification includes profile cover updates, ownership, suspension, and fixed upload budgets, and leaves no fixtures.
- Browser member-flow tests use isolated HTTP fixtures, not real accounts. They do not verify delivered email, actual storage transport, or owner credentials.
- Existing Vercel preview authentication remains enabled. Automatic approval review rejected generating a temporary authentication-bypass link; protected-preview visual inspection remains blocked until approved or signed in.
- Remaining launch requirements: real email-link completion and two-account checks, real storage upload, owner moderation secret/owner preview configuration, optional Google OAuth configuration. Do not call these verified from mocked browser tests.

## Production moderation bridge

Production sets `COMMUNITY_MODERATION_BRIDGE=true` and uses the `community-moderation` Supabase Edge Function. Existing owner session, origin, and CSRF checks issue a random 256-bit ticket in Redis with a 30-second lifetime. The function redeems it once via the fixed production callback (`/api/community?action=moderation-ticket`) and executes only that server-selected action. Service credentials remain in Supabase's native function environment. No additional database secret needs to be copied to Vercel. Deploy the Edge Function before the production app. The bridge requires the existing production owner configuration and submission Redis storage.
