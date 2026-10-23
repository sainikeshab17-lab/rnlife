-- Pending online checkout state belongs to this table; orders are created only
-- when a verified capture is converted transactionally. This is additive and
-- leaves historical orders and their payment references untouched.
CREATE TABLE IF NOT EXISTS checkout_payment_attempts (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL,
  user_id TEXT,
  customer_email TEXT NOT NULL,
  guest_token TEXT NOT NULL UNIQUE,
  payment_method TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('full_payment', 'cod_advance')),
  receipt TEXT NOT NULL UNIQUE,
  expected_amount_paisa INTEGER NOT NULL CHECK (expected_amount_paisa > 0),
  currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  checkout_snapshot JSONB NOT NULL,
  provider_order_id TEXT UNIQUE,
  provider_payment_id TEXT UNIQUE,
  provider_signature TEXT,
  creation_state TEXT NOT NULL DEFAULT 'pending' CHECK (creation_state IN ('pending', 'creating', 'ready', 'unknown', 'retryable')),
  attempt_status TEXT NOT NULL DEFAULT 'pending' CHECK (attempt_status IN ('pending', 'authorized', 'failed', 'cancelled', 'captured', 'converted', 'reconciliation_required')),
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_checkout_payment_attempts_customer
  ON checkout_payment_attempts(user_id, customer_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkout_payment_attempts_provider_order
  ON checkout_payment_attempts(provider_order_id) WHERE provider_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_checkout_payment_attempts_status_expiry
  ON checkout_payment_attempts(attempt_status, expires_at);

ALTER TABLE checkout_payment_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON checkout_payment_attempts FROM anon, authenticated;

-- A destructive down migration is intentionally omitted: attempts can contain
-- provider reconciliation references and should be retained for auditability.
