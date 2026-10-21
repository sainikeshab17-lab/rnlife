-- Additive payment-attempt history. Existing orders and payments are retained.
CREATE TABLE IF NOT EXISTS razorpay_payment_attempts (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
  attempt_key TEXT NOT NULL,
  receipt TEXT NOT NULL UNIQUE,
  razorpay_order_id TEXT UNIQUE,
  razorpay_payment_id TEXT UNIQUE,
  creation_state TEXT NOT NULL CHECK (creation_state IN (
    'pending', 'creating', 'ready', 'unknown', 'retryable'
  )),
  payment_state TEXT NOT NULL DEFAULT 'not_attempted' CHECK (payment_state IN (
    'not_attempted', 'failed', 'authorized', 'captured', 'unknown'
  )),
  amount_paisa INTEGER NOT NULL CHECK (amount_paisa > 0),
  currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT razorpay_payment_attempts_order_number_key UNIQUE (order_id, attempt_number),
  CONSTRAINT razorpay_payment_attempts_order_attempt_key UNIQUE (order_id, attempt_key)
);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS current_payment_attempt_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_current_payment_attempt_id_fkey'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_current_payment_attempt_id_fkey
      FOREIGN KEY (current_payment_attempt_id)
      REFERENCES razorpay_payment_attempts(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_razorpay_payment_attempts_order_created
  ON razorpay_payment_attempts(order_id, created_at DESC);

-- Preserve provider identities already attached to existing orders so legacy
-- successful and pending orders remain verifiable after deploying this schema.
INSERT INTO razorpay_payment_attempts (
  id, order_id, attempt_number, attempt_key, receipt, razorpay_order_id,
  razorpay_payment_id, creation_state, payment_state, amount_paisa, currency,
  created_at, updated_at
)
SELECT
  'rpa_legacy_' || md5(o.id), o.id, 1, 'legacy_' || md5(o.id), o.order_number,
  o.razorpay_order_id, o.razorpay_payment_id, 'ready',
  CASE
    WHEN o.payment_status = 'paid' THEN 'captured'
    WHEN o.payment_status IN ('payment_failed', 'failed') THEN 'failed'
    WHEN o.payment_status = 'pending_payment' THEN 'not_attempted'
    ELSE 'unknown'
  END,
  ROUND(o.total * 100)::INTEGER, 'INR', o.created_at, o.updated_at
FROM orders o
WHERE o.razorpay_order_id IS NOT NULL
ON CONFLICT (order_id, attempt_number) DO NOTHING;

UPDATE orders o
SET current_payment_attempt_id = a.id
FROM razorpay_payment_attempts a
WHERE o.razorpay_order_id IS NOT NULL
  AND a.order_id = o.id
  AND a.razorpay_order_id = o.razorpay_order_id
  AND o.current_payment_attempt_id IS NULL;
