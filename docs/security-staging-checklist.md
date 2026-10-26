# RIGHTNOWLIFE security and staging readiness checklist

This checklist is an operator handoff. It does not authorize production changes.

## Before staging traffic

- [ ] Store secrets only in the staging platform's server-side environment settings. Configure `DATABASE_URL`, `DIRECT_URL`, `PG_POOL_MAX`, `ADMIN_SESSION_SECRET`, Supabase URL/publishable key/service-role key, Razorpay sandbox keys and webhook secret, and email provider settings as required by enabled features. Keep service-role keys, payment secrets, and admin secrets server-only; never prefix them with `NEXT_PUBLIC_`.
- [ ] Generate `ADMIN_SESSION_SECRET` with a cryptographically secure generator and at least 32 characters. Do not reuse it across environments.
- [ ] On Vercel, no IP-header environment variable is needed: the limiter uses `x-vercel-forwarded-for` only when `VERCEL=1`. On other hosts, IP throttling is optional; configure `ADMIN_LOGIN_TRUSTED_IP_HEADER` only when ingress strips client copies and overwrites it with one validated IP. Account/email throttling still applies if no trusted IP is available.
- [ ] Use a dedicated staging PostgreSQL role with only the application privileges required by the runtime. Confirm the staging project identity in the provider dashboard before migration work.
- [ ] Keep `SHIPROCKET_ENABLED=false`. Do not set `SHIPROCKET_LABEL_ALLOWED_HOSTS` until exact HTTPS hostnames have been observed in a controlled Shiprocket staging response and verified with the provider. Never use wildcard or broad shared-storage hosts.
- [ ] Configure Razorpay sandbox credentials and webhook secret, then validate payment verification, raw-body signature validation, duplicate delivery, and refund reconciliation only with sandbox transactions.
- [ ] Verify admin session creation, cookie flags, expiry/revocation, customer ownership checks, order privacy, and admin authorization using staging accounts.
- [ ] Confirm error monitoring, database health monitoring, alerting, log retention, and backup restoration procedures. Logs must not contain passwords, session tokens, provider secrets, or database URLs.

## Safe PostgreSQL integration test setup

The test harness accepts only a PostgreSQL URL with a loopback host (`localhost`, `127.0.0.1`, or `::1`), a standalone `test`/`testing` database-name token, both explicit approval flags, and no query or fragment options. It does not create or migrate the database. Do not pass a hosted Supabase URL to the test suite, and do not use `.env.local` as the source for a test database target.

1. Obtain explicit approval to use a dedicated disposable local PostgreSQL database. Create it on loopback with a test-only database name such as `rightnowlife_test`; confirm it contains no needed data. Do not reuse production credentials or a hosted database URL.
2. In a fresh PowerShell session, populate `TEST_DATABASE_URL` from the local disposable database's private configuration (not `.env.local`), then set the non-production approval flag. Never echo the URL. The runner's `.env.local` values are overridden by process environment values because `dotenv.config()` does not override existing variables.
3. Point the migration runner directly at that same disposable URL and positively validate it before running any migration:

   ```powershell
   $env:TEST_DATABASE_IS_NON_PRODUCTION = '1'
   $env:DIRECT_URL = $env:TEST_DATABASE_URL
   node --input-type=module -e "import { validateTestDatabaseConfig } from './tests/postgres-test-database-gate.mjs'; const c = validateTestDatabaseConfig(process.env); const d = new URL(process.env.DIRECT_URL || ''); if (!c.approved || d.origin !== new URL(c.url).origin || d.pathname !== new URL(c.url).pathname) process.exit(1); console.log('Approved disposable loopback test target verified.');"
   ```

   If this command fails, stop. It prints no connection details. Review the complete pending migration list first: `npm run db:migrate -- --confirm-non-production` applies **all** pending versioned migrations, not only one selected file. After review, run that existing command with `DIRECT_URL` still overridden to the verified disposable URL. Do not run it while `DIRECT_URL` points anywhere else.
4. Verify the expected schema and migration ledger on the disposable database. Then set `TEST_DATABASE_SCHEMA_READY=1`, run `npm run test`, and record the test totals and each database test that passed or skipped. The gate requires all three process settings (`TEST_DATABASE_URL`, `TEST_DATABASE_IS_NON_PRODUCTION=1`, and `TEST_DATABASE_SCHEMA_READY=1`); without them database callbacks are skipped, while malformed or remote configuration aborts the suite.
5. Unset the three `TEST_DATABASE_*` variables and `DIRECT_URL` when finished. Keep the disposable database isolated for any needed diagnosis, or remove it using the local PostgreSQL administrator's approved cleanup procedure.

## Migration procedure for a non-production environment

The migration runner reads `DIRECT_URL` from process environment first (then `.env.local`), and `npm run db:migrate -- --confirm-non-production` applies every unapplied versioned migration in timestamp order. The confirmation flag is an operator assertion; the runner does not independently identify the database. For disposable testing, explicitly override `DIRECT_URL` with the approved local test URL and validate it as above. Production migration still requires a separately approved production migration plan.

1. Sign in to the intended environment's Supabase Dashboard and record the project identity in the change ticket. Confirm that it is the intended non-production project. Separately verify `DIRECT_URL` is configured for that same project without printing it, for example by checking its host/project reference locally without copying credentials into a terminal transcript.
2. Use that project's supported Supabase backup/PITR mechanism to create a backup or recovery point. Confirm the backup is complete and that restoration access is available before proceeding.
3. Review `supabase/migrations/20261024150000_admin_login_rate_limits.sql` and the complete pending migration list. This migration creates one shared limiter table plus an index, enables RLS, and revokes table privileges from `anon` and `authenticated`; it does not alter existing rows.
4. From the repository root, after confirming `.env.local` points to the intended non-production project, run `npm run db:migrate -- --confirm-non-production`. The script uses an advisory lock and a migration ledger; it may apply all pending migrations, not just the login limiter migration. Capture migration IDs and outcomes without capturing connection settings.
5. In that same project's SQL editor, verify the `admin_login_rate_limits` table, primary-key/check constraints, `idx_admin_login_rate_limits_updated_at`, RLS state, and denied `anon`/`authenticated` table privileges. Confirm the migration ledger records the expected migration ID and checksum.
6. Run the approved PostgreSQL integration suite against that disposable/local database and retain its counts and output.

The repository migration runner is forward-only and has no automatic down migration. For a newly applied, unused additive table, a reviewed manual rollback may remove the index and table after confirming no rows are needed and no application instance depends on them. Once throttling data is in use, a forward repair is safer; dropping the table disables login throttling and must not be used as a routine rollback. Production migration requires separate explicit authorization and a reviewed production change plan; this checklist does not grant it.

## Release gates

- [ ] `npm run test`, `npx tsc --noEmit`, `npm run build`, and `git diff --check` pass on the release candidate.
- [ ] `npm audit --omit=dev` completes against the registry and every actionable runtime advisory is assessed. A network failure is an unresolved supply-chain check.
- [ ] The rate-limit migration is applied and verified in the intended environment; PostgreSQL concurrency/expiry behavior is tested against an approved test database.
- [ ] Trusted ingress overwrites the configured client-IP header and this is verified with a spoofed-header staging check.
- [ ] Payment, webhook, refund, and reconciliation behavior is verified with sandbox credentials; no live money movement is used for smoke tests.
- [ ] Shiprocket remains disabled until its exact label hosts and controlled staging workflow are approved.
- [ ] No unresolved critical or high-severity findings remain, and rollback/restore access is confirmed.
