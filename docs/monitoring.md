# Production monitoring

Checkly runs `monitoring/site.spec.ts` hourly from us-east-1. The check verifies the homepage, three free samples, opening a prompt, and the enabled purchase-access form. It does not make purchases or submit license keys.

Production Vercel builds run `npm run monitoring:deploy` after the site build. The script maps the existing `PromptCoveCheckly_CHECKLY_API_KEY` and `PromptCoveCheckly_CHECKLY_ACCOUNT_ID` integration variables to Checkly's standard names, deploys the stable `promptcove-production` project, and records a live-site test. Preview builds and local builds do not change monitoring. Existing Checkly resources are preserved.

Existing email alert channels with failure notifications enabled are attached. If no channel exists, the build reports that explicitly; add an email channel in Checkly and redeploy to attach it. No new recipient is created automatically.

The deployment test runs against the currently live production site. A test failure is reported but does not prevent a website repair from deploying. Check the next scheduled result after the new deployment becomes ready. A failure to provision the monitor itself fails the build so monitoring cannot silently be skipped.

Checkly credentials must stay server-side. Never add a public/client prefix, commit them, or copy them into browser checks. The Vercel integration owns their current custom prefix.

## Sentry

Browser exceptions use @sentry/browser; handled server failures (HTTP 5xx) in the access API use @sentry/node. Production and preview have separate environment labels. Vercel commit SHAs identify releases. The DSN is configured as PUBLIC_SENTRY_DSN for the browser and SENTRY_DSN for the server; DSNs are public ingestion identifiers, not auth tokens.

Payloads are constructed from an allowlist. No request bodies, cookies, license keys, notes, user identity, raw exception messages, breadcrumbs, source context or local variables are included. Browser errors retain standard error types and application filename/line locations. Server failures include only action, phase and status. Tracing, session tracking and replay are disabled. No Sentry management token is needed, and source maps are not uploaded.

GitHub CI exercises the browser SDK against a local build while intercepting outgoing envelopes and checking privacy. The hourly Checkly browser flow performs the same verification on production without sending synthetic errors to Sentry.

For a one-time ingestion smoke test, set SENTRY_SETUP_VERIFY=1 in production and deploy. The build sends an informational setup event, checks Sentry's HTTP response, and logs its event ID. Set the variable back to 0 after verification. This is a build-only script; there is no public test-error endpoint.
