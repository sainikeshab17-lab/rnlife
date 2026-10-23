# Staging checkout-attempt expiry rollout

This change adds reservation lifecycle metadata and a scheduled reconciliation endpoint. It does not update or delete existing orders or checkout attempts.

## Migration order

The versioned runner sorts migrations by filename and applies only migrations missing from its ledger. Confirm the staging ledger first. The order for the checkout lifecycle is:

1. `20261023190000_order_confirmation_visibility.sql`
2. `20261023200000_checkout_payment_attempts.sql`
3. `20261023210000_checkout_attempt_reservation_expiry.sql`

The preceding migrations must already be applied according to the staging ledger. The runner validates checksums, so never edit an already-applied migration to change its contents. `20261023210000` only adds attempt reservation fields, a status constraint, and an index.

## Staging procedure

1. Confirm the target is the isolated staging PostgreSQL database, not production. Take and verify a staging backup. Review the migration ledger and the read-only [legacy pending checkout report](legacy-pending-checkout-reconciliation.sql); this report must be run with a read-only role.
2. Deploy the application build to staging without enabling the expiry scheduler yet. Configure `CHECKOUT_EXPIRY_CRON_SECRET` in the staging secret store; do not put its value in logs, command history, or this document.
3. Set `DIRECT_URL` to the verified staging connection in the deployment environment and run `npm run db:migrate -- --confirm-non-production`. This command applies every migration missing from that database ledger, in filename order. Check the command output and ledger for successful application of the three lifecycle migrations and verify the new columns/index exist.
4. Smoke-test checkout initiation without completing a real charge using the provider's test mode only. Confirm that attempt creation increments `inventory.reserved` and creates no row in `orders`.
5. Schedule `POST /api/internal/checkout-attempt-expiry` with an `Authorization: Bearer <staging secret>` header at a conservative cadence (for example, hourly). Initially observe result counts and audit events. Do not enable this scheduler until test-mode delayed-capture and webhook behavior is understood.
6. Review `checkout_attempt_expired_reservation_released`, `checkout_attempt_expiry_reconciliation_deferred`, and payment-audit records. Provider-backed attempts are deliberately deferred while their Razorpay order could still accept a payment.

The worker only releases expired reservations for attempts without a provider order that are no longer being initialized. Razorpay Orders in `created` or `attempted` state can still accept a payment, and there is no supported close operation in this integration. Their reservations remain held; the worker reconciles successful captures and leaves unresolved attempts for manual review. Configure alerting for deferred items and inventory ledger mismatch failures.

## Rollback

1. Disable the staging scheduler first, then roll back the application release to the last known-good build.
2. Keep the additive schema in place. Do not drop the attempt table, reservation columns, audit data, or payment references. Releasing a reservation changes inventory state and cannot be reversed by dropping a schema column.
3. If the staging database must be restored, restore the verified pre-rollout staging backup into an isolated staging target under the normal staging restore approval. Do not restore over production and do not run the migration runner against production as part of rollback.
4. Reconcile the released-attempt audit records against the backup and provider test-mode event history before re-enabling checkout on staging.

There is intentionally no destructive down migration. Keeping the additive fields is the safe rollback path; schema removal would require a separately reviewed migration after all held/released/consumed reservations and provider references have been reconciled.

## Legacy record cleanup

No legacy order is automatically changed by these migrations or the expiry worker. Use the read-only classification report, inspect payment method and provider references, and reconcile any payment against provider history before proposing archival. Pending COD rows are not eligible for cleanup solely because payment status is pending. Any archive or cleanup needs a documented record-level decision, verified backup, and separate production approval.
