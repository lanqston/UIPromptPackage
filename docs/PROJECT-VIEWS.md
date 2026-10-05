# Project views

Approved projects display a public view count on their cards on Home and Discover.
Creators can search for their project on Discover to see its count without an account.
A view means at least half of the card was in the viewport for one continuous second
while the tab was visible. It does not measure visits to the external project website.

The server counts a project once per network address per rolling 24 hours. Multiple
cards, refreshes, tabs, and concurrent requests cannot add repeat counts during that
window. Known bot user agents are ignored. These are approximate views, not unique
people: shared networks can undercount, changed networks and automated clients can
overcount. No historical views are reconstructed; existing projects begin at zero.

Uses the existing SUBMISSIONS Redis REST settings and SUBMISSIONS_ORIGIN; no new
service, credentials, dependencies, migrations, or buyer configuration are required.
Deploy the updated site and API together to enable counting.

Storage is separate from submission records: `digivated:project-views:<id>` holds the
total and `digivated:project-view-seen:<project-scoped HMAC>` expires after 24 hours.
Raw IP addresses are not stored. No cookies or browser storage are added. Moderation
does not reset counts. Pending/rejected/archived projects cannot receive views or
expose counts through public endpoints. Republished projects retain their totals.
Optional metric read failures display “Views unavailable” without hiding projects;
write failures leave links usable. Metrics never call payment or buyer session code.

## Verification (2026-10-05)

- 40 Node tests passed, zero skipped, using isolated local Redis 7.4.2.
- 12 browser tests passed at 375, 768, and 1440 px: view visibility, filtering,
  persistence on refresh, duplicate homepage cards, unavailable metrics, submissions,
  owner moderation, articles/products, navigation, and protected purchase links.
- Astro build, existing syntax checks, and diff whitespace checks passed.
- Payment/provider/session files and preserved product page match the production
  baseline byte for byte. No actual charge was made; browser checkout navigation
  used an intercepted Gumroad destination and buyer tests used provider fixtures.
- `verify:content` could not run because `.private/owner-key.txt` is unavailable.
- Browser tests connect the actual handlers to local Redis through intercepted API
  requests; they do not establish production deployment or Upstash transport success.
