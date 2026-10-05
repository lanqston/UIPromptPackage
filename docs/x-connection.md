# Owner X connection

This module provides account authorization and private token storage. Separate research and publisher workers use the connection; see x-publisher.md.

## X developer console

- App permissions: Read and write; no Direct Message or email access.
- App type: Web App, Automated App or Bot (confidential client).
- Website: `https://digivated.vercel.app`
- Callback URI (exactly): `https://digivated.vercel.app/api/x-connect?action=callback`

## Vercel setup

Store these as sensitive production environment variables, then redeploy:

- `X_CLIENT_ID`: OAuth 2.0 client ID from X, not the OAuth 1.0 consumer key.
- `X_CLIENT_SECRET`: OAuth 2.0 client secret.
- `X_TOKEN_ENCRYPTION_KEY`: independently generated 32 random bytes encoded as 64 lowercase hexadecimal characters. Keep a secure copy; changing it makes existing encrypted tokens unreadable and requires reconnecting.

Reuses the existing `DIGIVATED_ADMIN_PASSWORD_HASH`, `DIGIVATED_ADMIN_SESSION_SECRET`, `DIGIVATED_ADMIN_ORIGIN`, `SUBMISSIONS_REDIS_REST_URL` and `SUBMISSIONS_REDIS_REST_TOKEN`. The admin origin determines the callback; do not change it to a preview URL unless that exact preview callback is registered in X. Missing settings fail closed.

After deployment and configuration, sign into `/admin`, open `/connect-x.html`, and click Connect with X. Approve as @digivatedx. Other accounts are rejected. A private encrypted Redis record holds the tokens; responses and the UI never return them. Tokens are separate from public community data.

OAuth uses PKCE S256, 10-minute one-time state, a browser-binding HttpOnly Secure cookie, owner session validation, same-origin POST/CSRF checks, and AES-256-GCM token encryption. Read/write and offline scopes prepare the connection for future authorized account operations; no publishing endpoint is included.

Revocation: remove this app through X's connected-app settings. The local connection status reflects stored credentials, not a live token check; reconnect after revocation or expiry. The publisher refreshes expired access tokens and halts on API/token failures.

An X connection does not confer approval for AI reply automation or establish recipient opt-in. The research worker does not use this record; the separately enabled publisher does.

Validation: `node --test tests/x-connect.test.mjs`. Tests use mock Redis and mock X responses; real OAuth still requires the owner's client credentials and browser authorization. Never put credentials, authorization codes or token responses into source, monitoring events or screenshots.
