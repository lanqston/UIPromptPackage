# PromptCove scheduled replies

Dependency-free Node.js service. No AI calls or AI credits. Runs hourly through GitHub Actions when configured. Uses official Threads keyword search, conversation reads and reply publishing. Searches public posts with matching community/topic tags and relevant wording; it cannot reproduce the personalized in-app community feed.

## Current state

Disabled until a live Meta API test verifies public search and complete conversation reads. No token is committed. Existing browser reply to `DeACiwHIGr-` is seeded into the duplicate log. The storefront and purchase system are untouched.

## Connect and verify

1. In the Meta app, authorize **@promptcove** for `threads_basic`, `threads_keyword_search`, `threads_content_publish` and the reply-reading permissions required by the current Threads API. Public search requires the appropriate Meta approval. Merely creating an app or authenticating in the browser does not grant this access.
2. Store a long-lived user token in GitHub Actions repository secret `THREADS_ACCESS_TOKEN`. Do not put it in a file, commit, issue or chat message.
3. Set repository variable `THREADS_AUTOMATION_READY` to `true`; leave `THREADS_LIVE` unset. Run the workflow manually. Check its summary. Validate that a known recent public post from another account appears and that its full conversation is readable. Empty search results are not proof of public-search approval. If conversation reads are unavailable, this service deliberately skips those posts.
4. After a successful preview, set `enabled` to `true` in config.json and set variable `THREADS_LIVE` to `true`. Scheduled runs can then publish. No API verification has been performed yet.

## Behavior

At most one reply per run and three per New York calendar day. Last 48 hours only. Explicit invitations only. Restrictive or ambiguous wording is skipped. All pages of a conversation must be readable (up to 20); any existing reply from @promptcove blocks another reply. Rule-based matching is conservative and cannot interpret every unusual instruction; ambiguous posts are skipped.

Persistent log lives on the separate `promptcove-reply-log` branch. Entries are committed **before** publishing. Reservations and uncertain outcomes are never automatically retried. Do not delete or reset that branch. GitHub optimistic SHA updates prevent concurrent log overwrites; workflow concurrency prevents overlapping runs. Summaries include links to posted replies and skips. A failed publish or verification leaves a durable reservation for manual review.

## Pause, maintenance and costs

Set `THREADS_AUTOMATION_READY=false` to stop scheduled jobs. GitHub may delay scheduled workflows or disable schedules for inactive public repositories. GitHub Actions usage is subject to the account's included minutes and billing settings; this setup does not purchase a plan or enable paid overages. It makes no OpenAI calls.

Long-lived Meta tokens expire or can be revoked. Renew securely before expiry; automatic token rotation is not installed. Unauthorized API requests stop the run without retrying sends. GitHub's default branch must contain the workflow for the schedule to run. If an installation cannot write workflow files, add the supplied workflow through GitHub with the necessary permission.

Tests: `node --test automation/threads/matcher.test.mjs`. Preview: supply the token, GH_TOKEN, and GITHUB_REPOSITORY then run `node automation/threads/run.mjs` (no replies unless both live switches are enabled).
