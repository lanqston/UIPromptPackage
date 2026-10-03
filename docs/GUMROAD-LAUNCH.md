# Gumroad integration — launch gate

Status: IMPLEMENTED ON A BRANCH; NOT LAUNCH-READY. Production is unchanged.

## What was inspected

- Repository: lanqston/UIPromptPackage, base f5cec3703e41b1c9d1467d4719dd46565945df55.
- Existing hosting: Astro static build, Vercel Git deployment to https://digitalpromptpackage.vercel.app.
- No database, customer authentication service, email service, or cloud note storage exists in this repository.
- Existing paid edition used public ciphertext and a shared browser decryption key. This branch moves ciphertext to the server and removes browser decryption/key storage.
- Public Gumroad product state observed October 3, 2026: published; USD 7.99; one-time course; no recurring billing; license keys DISABLED. Product ID `ELdVVW1-tlMwQyuADA6C0A==`, original permalink `qxlgk`, custom URL https://mccovery.gumroad.com/l/ui-prompt-package.
- Dashboard required login; its private content/receipt settings could not be inspected.
- Connected Vercel team returned only Focus City, not digitalpromptpackage. No hosting credentials are available for this project. Do not link or alter Focus City.

## Chosen purchase flow

1. Gumroad issues each purchaser a license after the creator adds a License key block.
2. Gumroad sends its normal receipt. The buyer copies the license to `/access`.
3. `POST /api/activate` verifies the exact product through Gumroad's HTTPS `/v2/licenses/verify` API. It rejects refunded, charged-back, unresolved disputed, disabled, malformed, wrong-product and production test purchases. Subscription purchases are unsupported and rejected because this product is one-time.
4. After verification and a successful server-side edition read, the backend issues an encrypted JWE in a Secure, HttpOnly, SameSite=Strict, host-only cookie with a 30-day maximum lifetime. The cookie includes only the license, sale ID, product ID, and standard token claims. No email-based linking occurs.
5. Each `GET /api/edition` decrypts/validates the session, independently re-verifies the license with Gumroad, checks the sale ID, and only then returns the paid edition. All responses are private/no-store. No stored grant can become stale.
6. Returning browsers reuse their cookie. Other browsers or expired sessions re-enter the same license. Gumroad handles receipt/license recovery at https://gumroad.com/license-key-lookup. Notes/progress remain device-local and have the existing export/import feature.

No merchant API token, new database, mail provider, notification endpoint, background queue, or cron is required. License verification uses `increment_uses_count=false`: repeated activation/read attempts do not consume uses, create grants or send email. Interrupted activation is safely repeatable. Delayed or missing sale notifications are irrelevant to entitlement. A provider outage fails closed, retains an existing session for retry, and displays recovery wording.

## Notifications and purchase changes

Official Gumroad API documentation lists sale, refund, dispute, dispute_won, cancellation, subscription_updated, subscription_ended and subscription_restarted resource subscriptions. These require authenticated setup. The inspected notification documentation does not establish a cryptographic signature scheme; do not invent an HMAC header or trust an incoming sale payload.

This implementation intentionally has NO notification receiver. Forged notification routes cannot grant access. The paid-read verification is its reconciliation path: refunds/disputes are enforced on the next protected fetch; won disputes can regain access if the purchase is otherwise valid. No cancellation event is interpreted as a one-time refund. Gumroad remains the durable purchase/receipt record.

## Required Gumroad dashboard steps

1. Open Products → UI Prompt Package | From Basic to Polished → Content.
2. Choose Insert → License key. Keep multi-seat purchasing disabled for this edition. Confirm the product ID displayed is `ELdVVW1-tlMwQyuADA6C0A==`.
3. Publish/save the content. Gumroad documents that enabling licenses also generates keys for eligible previous purchases. Confirm using an existing/test purchase, not an assumption.
4. Add the exact content and receipt wording below. Remove any old shared edition key or manual-code promise if present. Never place the owner edition key in Gumroad content.
5. Use Gumroad's supported seller Test purchase flow, not a real card. Verify the receipt, the generated license, the download/content view, recovery, and activation on the preview. If Gumroad's current test-license response differs, adjust fixtures from the observed documented response without relaxing production checks.
6. Do not promote sales until production access and the customer receipt flow pass. The product is already published, but access is not yet connected.

### Product-description access paragraph (append after the included features)

Your purchase gives you access to the Full Edition website. After checkout, Gumroad provides a personal license key in your receipt and purchase content. Open the website’s Access page, paste your key, and start using the full playbook. You don’t need a separate website account. Keep your receipt so you can return on another browser. Saved prompts, notes, and progress stay on your device.

### Content section

Welcome to UI Prompt Package

1. Copy your personal license key from the License key block on this page.
2. Open https://digitalpromptpackage.vercel.app/access.
3. Paste your key and select Open full edition.
4. Start with Start Here, or browse the prompt library.

Your browser can remember your access for up to 30 days. If you switch browsers or need to sign in again, use the same key. Your purchase is not charged again.

Can’t find your receipt? Visit https://gumroad.com/license-key-lookup or open this purchase in your Gumroad Library. If you still need help, reply to your receipt to contact me. Please keep your license key private.

Your notes and progress save on your device. Use My saved work → Export backup to keep a copy.

[Place Gumroad’s actual License key block here. This line is an editing instruction, not customer copy.]

### Receipt instructions / button

Button label: Open Full Edition
Button destination: https://digitalpromptpackage.vercel.app/access

Copy the license key included with your purchase, open the link above, and select Open full edition after pasting your key. Keep this receipt for future access. No separate website account is needed. If you need help, reply to this email.

Do not promise automated access in the public description until this branch is deployed and tested. The wording above is the exact replacement for the completed flow.

## Required Vercel setup

Connect the Vercel account/team that owns **digitalpromptpackage**, not Focus City. Keep its existing Git integration and production domain.

Set server-side environment variables through Vercel's secret settings (never chat or source control):

| Variable | Value / purpose |
| --- | --- |
| ACCESS_ENABLED | `false` until prerequisites pass; `true` on configured preview for tests, then production at launch |
| APP_ORIGIN | Exact HTTPS origin without trailing slash; stable preview origin for preview, `https://digitalpromptpackage.vercel.app` for production |
| GUMROAD_PRODUCT_ID | `ELdVVW1-tlMwQyuADA6C0A==` |
| SESSION_SECRET | New random 32-byte value encoded as 64 hexadecimal characters; use different values in preview and production |
| EDITION_KEY | Existing private owner edition key; server-only; do not disclose it to buyers |
| ALLOW_TEST_PURCHASES | `true` only in isolated preview; production ignores it and always rejects test purchases |

Vercel supplies `VERCEL=1`, `VERCEL_ENV` and production `NODE_ENV`. The rate limiter deliberately fails closed outside the trusted runtime. `SESSION_SECRET` can be generated with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` in a secure terminal; put its output directly into secret settings. Do not put it in a PR, chat, screenshot or logs.

### Rate limiting — requires cost decision before enabling

Code uses Vercel's official `@vercel/firewall` SDK. Configure one `@vercel/firewall` rule in the correct project's Firewall → Configure → New Rule:

- Rate limit ID `uip-activate`: 10 requests per 60 seconds per bucket. Both endpoints use this existing rule; the SDK key includes the configured origin, server-selected action, and trusted client IP. Activation and edition reads each receive an independent 10/minute/IP allowance. Preview cannot consume production buckets.
- This fits the owning Hobby plan's one-rate-limit-rule allowance. Frequent page navigation or users behind shared NAT can hit the edition limit; return 429 with Retry-After rather than bypassing protection.

The SDK passes only the configured host and trusted edge IP to the firewall, never the license/cookie or arbitrary request headers. Missing rules and service failures deny access. Stage and verify in preview; review traffic before production enforcement. Rule counters are regional, not a global exact quota. Account for shared school/office/mobile NAT addresses when tuning.

Vercel's official pricing page lists WAF rate limiting as metered ($0.50 per million allowed requests when inspected). No billable feature was activated. Confirm the owning plan's allowance and obtain approval before enabling charges; if this is unacceptable, choose an approved durable free-tier counter store before launch. Do not substitute in-memory serverless counters.

Ensure HTTPS, correct origin, the shared rate-limit rule, and secret injection work on the real deployment. Preview and production have different session secrets/origins and test policies. There are no database migrations.

## Verification and remaining gates

Completed locally:
- 22 backend fixture checks: correct purchase; wrong product; invalid/malformed input; refund, chargeback, dispute and dispute-won handling; production test rejection; encrypted session round-trip, expiry, wrong-origin/environment and tampering; anonymous/forged-cookie denial; POST origin/method/content-type/size protection; repeated activation; returning access; logout; rate-limit and upstream errors; refund after activation; interrupted/outage retry; redacted audit output.
- Astro production build: 12 static pages.
- Existing content integrity checks: all 75 prompts, 8 workflows, 8 checklists; correct samples; authenticated decryption; bad-key failure; no edition file, paid prompt bodies or edition key in public output.
- JavaScript syntax checks.
- Chromium local fixture browser: invalid key gives a clear error; valid key opens all 75 prompts; returning access works; logout restores only 3 samples. HttpOnly cookie is not JavaScript-readable and the license is absent from browser storage. Access/library layouts had no horizontal overflow at 390px and 1440px; mobile and desktop screenshots inspected; no uncaught browser errors. This uses a local fixture verifier and origin adapter, not Gumroad or Vercel. Physical iPhone/Safari and live HTTPS remain untested.

Blocked launch checks: real Gumroad test purchase and receipt/license delivery; real license recovery; authenticated dashboard settings; Vercel function packaging/routing, secret configuration, edge rate-limit enforcement, HTTPS cookies, live revocation and deployment verification. Fixture results are not a substitute for these checks.

Dependency audit: npm reports two high findings (Astro and transitive http-cache-semantics, GHSA-ch52-4w7c-c8xp), with no patched cache-library version listed. Inspection found Astro using it for build-time remote assets; this project is static and the paid API does not import Astro. No shared authenticated cache exists in this implementation. Do not apply npm's suggested major downgrade. Retain as an unresolved upstream advisory and revisit before launch; confirm deployed function traces exclude Astro/cache library.

## Operations, backups and rollback

- Monitor Vercel function errors and `access_request` events for 503/429 spikes; monitor activation outcomes and Gumroad receipt support issues. App audit events omit licenses, cookies, email, raw exceptions and upstream payloads. Vercel log retention depends on the actual plan and has not been verified. Gumroad maintains purchase history; export it through its dashboard as needed.
- Keep a secure backup of the source, encrypted edition and its decryption key. Without the key the encrypted edition is not recoverable. Existing customer notes remain device-local; explain export to customers.
- No partial grant/database state exists to reconcile. Retry activation or a protected read after outages. A refund or license disable/rotation is enforced on the next protected read.
- Emergency: set ACCESS_ENABLED=false and redeploy; free content continues, new paid requests fail closed. Correct the configuration and re-enable after verification.
- Roll back to a known good **server-protected** version. Do not restore the old shared-key browser delivery as a security rollback. Before the first release, an emergency disabled-access deployment is safer than exposing the legacy method.
- Rotate SESSION_SECRET to invalidate all sessions. A stolen valid license is still a bearer credential until Gumroad disables/rotates it; disable/rotate it in the seller dashboard and tell the buyer how to recover the replacement. No such seller credential change was performed in this task.

## Material limits

A license key is a bearer credential and can be shared. No per-person or device-seat enforcement is claimed. Signing out clears this browser's cookie, but cannot invalidate a copied cookie on another device without rotating secrets or the underlying license; every read still checks Gumroad. A buyer can copy already delivered prompts. Refunds cannot erase content already viewed or copied. Old ciphertext remains in Git history and anyone already possessing its former shared key can decrypt that old copy. These are distinct from unauthorized future server access.

Live Gumroad verification introduces provider dependency and request volume. Outages deny paid loads until retry; no stale entitlement grace period is used. Current paid content is delivered as one authorized JSON response per page load and held only in memory. This is intentionally simple for this small one-time product.

## Official sources checked

- https://gumroad.com/help/article/76-license-keys (current article content, including product ID, recovery and refund flags)
- https://gumroad.com/api and Gumroad's own source: https://github.com/antiwork/gumroad/blob/main/app/javascript/components/ApiDocumentation/Endpoints/Licenses.tsx
- https://github.com/antiwork/gumroad/blob/main/app/javascript/components/ApiDocumentation/Endpoints/ResourceSubscriptions.tsx
- https://github.com/antiwork/gumroad/blob/main/app/controllers/api/v2/licenses_controller.rb
- https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting-sdk
- https://vercel.com/docs/vercel-firewall/vercel-waf/usage-and-pricing
- https://github.com/advisories/GHSA-ch52-4w7c-c8xp

## Continuation — October 3, 2026

- Correct Vercel project is now accessible: `langston3/digitalpromptpackage`, `prj_SfARXMeiaJ6y6EIvhwtedHdN1ZJ1`. Focus City was not modified.
- User reports Gumroad license/receipt settings saved. Real purchase testing remains required.
- Production and branch-scoped preview each have SESSION_SECRET and server-only EDITION_KEY entries. Edition-key decryption and public-output checks pass locally.
- Preview APP_ORIGIN uses the stable branch alias. Preview permits Gumroad test purchases; production rejects them. ACCESS_ENABLED remains false until live testing.
- Published SDK rule `uip-activate` is 10/60 seconds; code now shares the one supported rule using independent origin/action/IP counters. SDK-level fixture tests cover bucket isolation, untrusted-host rejection, header minimization, missing rule, blocked/over-limit, service failure, and non-Vercel fail-closed behavior.
- Live preview, automation bypass configuration if required, real Gumroad activation/revocation, and production promotion remain pending. A READY static deployment is not proof of working paid access.
