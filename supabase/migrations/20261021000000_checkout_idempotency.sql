-- Safe additive checkout idempotency support. Existing orders remain unchanged
-- with NULL values; PostgreSQL permits multiple NULLs in this unique index.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS checkout_idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS checkout_request_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_checkout_idempotency_key
  ON orders(checkout_idempotency_key);

ALTER TABLE notification_jobs
  ADD COLUMN IF NOT EXISTS provider_first_attempt_at TIMESTAMPTZ;
