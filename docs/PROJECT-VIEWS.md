# Project view tracking

A view is a directory/homepage project card at least 50% visible for one second in an active tab. Counts are approximate impressions, not unique people: repeat views from the same network are deduplicated per project for 24 hours. Bots are excluded. Raw network addresses are not stored; deduplication uses project-scoped HMAC keys with 24-hour expiry. Existing totals and Redis keys are preserved.

Visible counts refresh every minute through the same atomic, deduplicated endpoint. Temporary failures retain the displayed count and retry after 2 and 4 seconds, then at most once per minute. Hidden/filtered cards stop scheduling requests. Returning to the tab or going online resumes tracking. Observers and timers are cleaned up on navigation and restored for browser back/forward-cache pages.

The Redis transaction validates the current source record's approval/featured status and public consent before deduplication and increment. A stale public snapshot cannot allow pending, rejected, deleted or private content to accrue counts. Concurrent tabs increment at most once per network per project in the deduplication window. Existing totals survive unpublishing and reapproval.

Validation uses isolated Redis: concurrent requests, distinct networks, expiry, missing records, pending status, consent withdrawal, public count responses and outage handling. Browser tests cover mobile/tablet/desktop visibility, filtered cards, repeat loads, transient retry and automatic refresh. The existing production Checkly scenario now checks current discovery copy, numeric public counts, and a bot-excluded endpoint probe without adding fake views. Its existing deployment script attaches the account's configured alert channels; no new service is introduced.

Release through the existing main/Vercel pipeline; no schema migration or environment change. Verify `/api/projects` returns numeric counts and the bot probe returns `views: null`. Check Checkly deployment logs for the scheduled monitor and alert attachment. These checks reduce regressions; they do not guarantee uninterrupted availability. Detail-page visits are not counted as separate impressions in this release.
