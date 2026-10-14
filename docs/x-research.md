# Hourly Grok research

Four Grok calls at most per UTC hour: scout and verifier with X Search, then writer and reviewer without tools. Up to seven recent niche connection invitations are considered. Research output goes to a private Redis draft queue. The separate bounded publisher can consume eligible drafts when enabled; see x-publisher.md.

The site build and X publisher do not require a Grok key. The optional research writer requires XAI_API_KEY at runtime and CRON_SECRET (at least 32 characters) for the scheduled endpoint. XAI_MODEL optionally overrides the default grok-4.7. Existing owner authentication and submission Redis settings are reused. With no usable Grok key, research returns an unconfigured status without running. No key values are logged.

The Vercel cron schedule is UTC. Owner controls and drafts are at /research.html after /admin sign-in. The cron uses Authorization: Bearer CRON_SECRET. A private Redis flag pauses future calls; an already in-flight provider request can still finish. An atomic hourly reservation prevents duplicate or concurrent runs. Failed runs consume the hourly slot and do not automatically retry paid requests. Each provider call times out after 55 seconds. The worker gets 300 seconds total.

Limits are operational limits, not a dollar guarantee: four model requests, at most two tool calls per search-enabled request, 5,000 output tokens per request. Provider spending limits should bound total cost. Actual usage returned by xAI is stored in the latest report. No growth or engagement outcome is guaranteed.

Deduplication covers this queue only, with a 90-day post/author history. The queue holds the latest 200 drafts. Verification is model-mediated and may be wrong; open source posts before using drafts. Generic connection invitations do not establish automated-reply consent. Publishing status is shown separately in the owner page.

This research worker does not access X tokens. The separate publisher implements refresh and replies. Debug the latest report and sanitized x_research runtime events; do not log provider response bodies or credentials.

