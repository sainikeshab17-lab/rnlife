# Admin login IP and database configuration

## Local development

Run the application with `npm run dev`. The package script binds Next.js to `127.0.0.1`. On `/api/admin/login`, the Next proxy overwrites the internal `x-rightnowlife-dev-client-ip` request header with `127.0.0.1` only when `NODE_ENV` is `development` and the request host is loopback (`localhost`, `127.0.0.1`, or `::1`). The limiter treats local browser requests as one local-development IP bucket. It does not trust a browser-provided copy of that internal header.

Leave `ADMIN_LOGIN_TRUSTED_IP_HEADER` blank in local `.env.local`; the development proxy provides the local bucket. `ADMIN_SESSION_SECRET` must still be configured with at least 32 characters, and `DATABASE_URL` must point to the intended runtime database with the admin tables and rate-limit table available. Do not point a local development server at production.

## Production ingress

Production does not accept the development-only header. Set `ADMIN_LOGIN_TRUSTED_IP_HEADER` to the name of one custom `x-*` header supplied by the ingress. The ingress must remove any client-supplied copy and overwrite it on every request with one IP literal. Comma-separated chains, malformed values, missing configuration, `X-Forwarded-For`, and `X-Real-IP` are rejected. If the repository does not contain the actual hosting/ingress configuration, verify these behaviors in the hosting platform before setting the variable; do not infer them from the mere presence of an IP header.

No hosting platform or ingress manifest is present in this repository, so there is no platform-specific header rule to provide here. Until the actual ingress contract is confirmed, production login intentionally returns `503`.

## Diagnose an HTTP 503

The route logs a sanitized reason without header values or secrets:

- Trusted IP configuration messages refer to `ADMIN_LOGIN_TRUSTED_IP_HEADER` (production) or the local Next proxy (`npm run dev`).
- `ADMIN_SESSION_SECRET` messages mean it is missing or shorter than 32 characters.
- PostgreSQL code `42P01` identifies the missing `admin_login_rate_limits` table and names the migration to apply.
- A `DATABASE_URL` message refers to the application's runtime PostgreSQL connection. Migration tooling instead reads `DIRECT_URL`; both should be verified against the same intended non-production Supabase project without printing either URL.
- Other PostgreSQL rate-limit errors log only a database code. No limiter failure falls back to process memory or skips throttling.

## Diagnose login followed by HTTP 401 from `/api/admin/me`

The login handler logs only sanitized stages in development. A `Session persisted; host-only HTTP-only session cookie added` message confirms that session creation completed and the response was given the cookie; it does not prove the browser stored or resent it. The `/api/admin/me` log reports only whether the cookie was present. The canonical validator logs when a delivered cookie has no active matching database session. Database and `ADMIN_SESSION_SECRET` errors return 503 and are logged as configuration/database failures; they are not converted into 401.

The cookie is host-only, `Path=/`, HTTP-only, and SameSite=Strict. Use one exact origin throughout login and subsequent requests; `localhost` and `127.0.0.1` are different cookie hosts. In the browser network panel, verify the login response has a `Set-Cookie` header and the later `/api/admin/me` request includes the cookie, without revealing or copying its value. A missing cookie points to browser/origin delivery. A present cookie with no active session match can mean it expired, was revoked, its row is absent, or the app instances use different session secrets. `ADMIN_SESSION_SECRET` must be stable and identical across all instances and restarts; do not log or compare its value in a transcript. Confirm the runtime app database is the intended non-production database and contains the session row using an authorized database console without printing credentials or token hashes.

If login is 200 but `/api/admin/me` is 401, a response cookie and same-host delivery still need to be distinguished from database lookup. The regression test exercises the cookie and route flow with a mocked session store; it does not replace the gated PostgreSQL session-validator integration test.

The migration is additive and creates one table and an `updated_at` index; it does not update or delete existing application data. Apply it with the repository's versioned migration runner only after verifying and backing up the non-production target. From the repository root, the command is:

```powershell
npm run db:migrate -- --confirm-non-production
```

The runner reads `DIRECT_URL` and applies **all pending versioned migrations**, not only this migration. Its confirmation flag is an operator assertion and does not identify the database project. Review the pending migration ledger and target first. Never use this command against production without a separately approved production migration plan.
