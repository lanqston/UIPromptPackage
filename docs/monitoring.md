# Production monitoring

Checkly runs `monitoring/site.spec.ts` hourly from us-east-1. The check verifies the homepage, three free samples, opening a prompt, and the enabled purchase-access form. It does not make purchases or submit license keys.

Production Vercel builds run `npm run monitoring:deploy` after the site build. The script maps the existing `PromptCoveCheckly_CHECKLY_API_KEY` and `PromptCoveCheckly_CHECKLY_ACCOUNT_ID` integration variables to Checkly's standard names, deploys the stable `promptcove-production` project, and records a live-site test. Preview builds and local builds do not change monitoring. Existing Checkly resources are preserved.

Existing email alert channels with failure notifications enabled are attached. If no channel exists, the build reports that explicitly; add an email channel in Checkly and redeploy to attach it. No new recipient is created automatically.

The deployment test runs against the currently live production site. A test failure is reported but does not prevent a website repair from deploying. Check the next scheduled result after the new deployment becomes ready. A failure to provision the monitor itself fails the build so monitoring cannot silently be skipped.

Checkly credentials must stay server-side. Never add a public/client prefix, commit them, or copy them into browser checks. The Vercel integration owns their current custom prefix.

Sentry still requires the project's DSN before error reporting can be configured and verified.
