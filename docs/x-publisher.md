# Bounded automatic connection replies

Research runs hourly at minute 1 UTC and considers up to seven posts. Four Grok requests at most per hour (96/day maximum), including failures, replace the previous daily schedule. API usage is billable and these request limits are not a dollar cap. Configure provider spending limits.

The publisher checks the queue at minutes 0, 9, 18, 27, 36, 45 and 54. It attempts at most one reply per invocation and seven attempts per rolling hour; this is a ceiling, not a target. It only considers drafts researched in the last two hours and posts explicitly inviting connections in the configured niches. The publisher re-fetches the source and verifies author and exact text before sending. Edited, missing, sensitive and uncertain matches are skipped.

## Activation and controls

Requires an hourly-capable Vercel plan, the existing CRON_SECRET and connected @digivatedx OAuth account, plus `X_AUTO_REPLY_ENABLED=true` in production. It stays off unless that value is exactly true. Existing X client and encryption settings are used for automatic refresh. Secrets are never sent to browser code.

Owner controls live at /research.html after /admin sign-in. Pause replies stops future reservations; pausing research also stops future publishing. A request already sent to X cannot be recalled by pausing. Owner status displays whether publishing is enabled, paused or halted.

## Limits and failure handling

- A persistent rolling-hour counter reserves attempts atomically before posting.
- One author/post is contacted at most once in 90 days. Identical reply text is suppressed for 30 days. History covers this app, not manual X activity.
- A single publisher lease prevents overlapping workers. A source is marked attempted before sending. Unknown outcomes are never automatically retried.
- API restrictions, token failures, storage failures or ambiguous posting responses halt the worker. Inspect X before resuming through the owner page.
- Access tokens are refreshed and stored encrypted with compare-and-save to protect concurrent owner reconnections.
- Successful sends store a direct reply URL and source URL in private history. There are no likes, follows, DMs, multiple accounts, proxy rotation or retries around platform restrictions.

This feature does not guarantee compliance with X automation policies or avoid account enforcement. It does not treat generic connection invitations as consent to receive an AI bot; the account owner has explicitly chosen to proceed despite that limitation. Wording is tailored for relevance, not to bypass spam detection.

Validation: `node tests/x-publisher.test.mjs`, `node tests/x-research.test.mjs`, and `node tests/x-connect.test.mjs`. The unit tests mock X and Redis; live operation still depends on the connected account's API permissions, credits, eligible posts and platform enforcement.
