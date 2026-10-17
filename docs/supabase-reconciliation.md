# Supabase PostgreSQL schema reconciliation

## Runtime and sources

- Runtime tables and columns were inspected from `data/rightnowlife.db` with
  SQLite metadata queries (`sqlite_master`, `PRAGMA table_info`, index metadata,
  and foreign-key metadata); customer rows were not printed.
- `schema.sql` is a historical partial bootstrap (orders, items, addresses,
  inventory, payment audits); it is not a complete migration source.
- The application runtime adapter is `pg` (`DATABASE_URL`) with a parameter
  adapter for existing `?` SQL placeholders. All request-side database work is
  asynchronous. Explicit migration/import utilities use `DIRECT_URL`.
- The canonical PostgreSQL schema is the versioned initial migration. The
  Prisma schema is a table/column reference only and is not used at runtime.

## Table inventory

All 16 SQLite runtime tables are represented in PostgreSQL:

| Table | Reconciled columns and relationships |
|---|---|
| `orders` | Preserves payment, cancellation, fulfilment, tracking, refund, user, and guest-token fields; unique order number. |
| `order_items` | Preserves item identity, trusted catalog snapshot, price, quantity, and order FK. |
| `order_addresses` | Preserves full address snapshot and order FK; `order_id` is not unique. |
| `inventory` | Composite primary key `(product_id, size)`; stock and reservations. |
| `payment_audits` | Event type, payload, and optional order ID; the SQLite source has no order FK. |
| `order_status_history` | Complete status transition history and order FK. |
| `admin_users` | Unique email, role, active flag, and password hash. |
| `admin_sessions` | Hashed session token, expiry, client metadata, and admin FK. |
| `inventory_adjustments` | Before/after stock, delta, reason, actor, and timestamp. |
| `audit_logs` | Before/after/metadata values, entity, actor, address, and timestamp. |
| `product_overrides` | Product key, active state, description, updater, and timestamp. |
| `shipping_events` | Tracking event details and order FK. |
| `returns` | Both `customer_note`/`customer_notes` and `admin_note`/`admin_notes` are retained, along with inspection and resolution fields. |
| `return_items` | Includes `product_name`, `product_slug`, `color`, `price`, quantity, requested size, condition, and return FK. |
| `refund_records` | Includes separate rupee `amount` and `amount_paisa`, payment/refund references, idempotency key, raw response, and order FK. |
| `notification_jobs` | Maps SQLite `html_content`, `retry_count`, `max_retries` into service columns `body_html`, `attempts`, `max_attempts`; other delivery/idempotency fields are preserved. |

The migration includes all application tables, primary keys, unique constraints,
foreign keys present in the SQLite DDL, and runtime query indexes. It does not
add an FK for SQLite columns that had none (including `payment_audits.order_id`,
`return_items.order_item_id`, and `refund_records.return_id`).
Row-level security is enabled on every application table, and table privileges
are revoked from Supabase's `anon` and `authenticated` roles; no client-side
policies are created. The app therefore requires a private server-side database
connection that has the necessary table privileges and bypasses RLS, never a
public client URL/key.

The migration intentionally uses `DEFAULT NOW()` for timestamp fields that have
no SQLite default, as a PostgreSQL convenience when a future insert omits a
timestamp. Existing import rows provide their source timestamp explicitly, so
the default is not used during import. `TIMESTAMPTZ` stores instants rather than
SQLite timestamp text; the verified source and backup timestamps are valid
timezone-qualified values. The six nullable source fields
`orders.cancellation_requested`, `returns.resolution_type`,
`returns.refund_amount`, `return_items.condition`, `return_items.restocked`,
and `return_items.created_at` remain nullable in PostgreSQL, with their source
defaults retained.

## Data and constraint checks

The existing SQLite snapshot contained 108 orders, 108 order items, 108 order
addresses, 27 admins, 8 returns, 6 return items, 4 refund records, 14 audit logs,
40 inventory rows, 42 status-history rows, 15 payment-audit rows, and 6 shipping
events; notification jobs, admin sessions, and product overrides were empty at
the time of the earlier verified backup. These are snapshot counts, not claims
about a future import.

Required unique source keys checked before enforcing PostgreSQL constraints:
order numbers (108 distinct), admin emails (27 distinct), return numbers
(8 distinct), refund idempotency keys (4 distinct). The source also has a
duplicate non-null `razorpay_refund_id`; PostgreSQL therefore indexes that
provider reference non-uniquely, preserving all records rather than imposing a
new constraint that rejects existing data.

## SQL/runtime conversion

- `?` bind positions are translated to `$1`, `$2`, ... while preserving quoted
  strings/identifiers and SQL comments; values remain parameterized.
- Inventory reservation, order creation, payment state, cancellation decisions,
  return creation/inspection, admin sessions, and inventory adjustments use
  PostgreSQL transactions/row locks where concurrent updates could race.
- PostgreSQL date arithmetic/casts, `ILIKE`, `GREATEST`, `ON CONFLICT`, and
  `RETURNING` replace the SQLite-specific forms that were present/needed.
- `node:sqlite` remains only in offline backup/inspection/import tooling. It is
  not imported by the application runtime.

## Import safety and migration recovery

Before opening a PostgreSQL connection, the importer verifies source and backup
SQLite integrity, foreign keys, table lists, table DDL, columns, indexes,
foreign keys, row counts, and per-table content hashes. It then takes
`SHARE ROW EXCLUSIVE` locks on all destination tables and refuses to proceed if
any destination table is non-empty. It inserts all rows in a single transaction,
checks foreign keys, and compares destination row counts and canonical content
hashes to the source before committing. Duplicate non-null
`razorpay_refund_id` values are compared as a multiplicity distribution as well
as being covered by the complete `refund_records` hash. Any failed insert or
reconciliation check rolls back the entire import; no partial import is
committed. A destination left non-empty after an uncertain network failure must
be reviewed manually rather than automatically resumed.

The migration runner creates the version ledger idempotently before applying
migrations. Each migration's DDL and ledger row are committed in the same
transaction. On migration failure, both are rolled back; the ledger table may
remain empty, and retrying the unchanged migration is safe. If the connection
is lost during `COMMIT`, retry first reads the ledger: it skips a fully
committed migration with the matching checksum and re-applies one whose
transaction did not commit. Applied migration files remain forward-only.

## Verification boundary

The migration and importer have not been pointed at any PostgreSQL server. No
schema change or import has been applied. PostgreSQL syntax/constraints,
production data transfer, and payment/webhook/return/refund flows still require
an explicitly approved non-production Supabase target and test credentials.
