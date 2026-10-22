-- Additive support for made-to-order custom quote tees and COD advance payments.
-- Apply this migration before deploying application code that references these columns.
-- Existing orders and order items keep their existing values and stock behavior.
-- Roll back by deploying compatible application code first; retain this schema and
-- payment history. No destructive down migration is safe after feature data exists.

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS customization JSONB,
  ADD COLUMN IF NOT EXISTS fulfillment_type TEXT NOT NULL DEFAULT 'stock';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_items_fulfillment_type_check'
      AND conrelid = 'order_items'::regclass
  ) THEN
    ALTER TABLE order_items
      ADD CONSTRAINT order_items_fulfillment_type_check
      CHECK (fulfillment_type IN ('stock', 'made_to_order'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS razorpay_payment_attempts (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
  attempt_key TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'full_payment',
  receipt TEXT NOT NULL UNIQUE,
  razorpay_order_id TEXT UNIQUE,
  razorpay_payment_id TEXT UNIQUE,
  creation_state TEXT NOT NULL CHECK (creation_state IN (
    'pending', 'creating', 'ready', 'unknown', 'retryable'
  )),
  payment_state TEXT NOT NULL DEFAULT 'not_attempted',
  amount_paisa INTEGER NOT NULL CHECK (amount_paisa > 0),
  currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  reconciliation_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT razorpay_payment_attempts_order_number_key UNIQUE (order_id, attempt_number),
  CONSTRAINT razorpay_payment_attempts_order_attempt_key UNIQUE (order_id, attempt_key),
  CONSTRAINT razorpay_payment_attempts_purpose_check CHECK (purpose IN ('full_payment', 'cod_advance')),
  CONSTRAINT razorpay_payment_attempts_payment_state_check CHECK (payment_state IN (
    'not_attempted', 'failed', 'authorized', 'captured', 'cancelled', 'unknown'
  ))
);

-- If the earlier payment-attempt migration was applied, extend that table in place.
ALTER TABLE razorpay_payment_attempts
  ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'full_payment',
  ADD COLUMN IF NOT EXISTS reconciliation_note TEXT;

ALTER TABLE razorpay_payment_attempts
  DROP CONSTRAINT IF EXISTS razorpay_payment_attempts_payment_state_check;
ALTER TABLE razorpay_payment_attempts
  ADD CONSTRAINT razorpay_payment_attempts_payment_state_check CHECK (payment_state IN (
    'not_attempted', 'failed', 'authorized', 'captured', 'cancelled', 'unknown'
  ));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'razorpay_payment_attempts_purpose_check'
      AND conrelid = 'razorpay_payment_attempts'::regclass
  ) THEN
    ALTER TABLE razorpay_payment_attempts
      ADD CONSTRAINT razorpay_payment_attempts_purpose_check
      CHECK (purpose IN ('full_payment', 'cod_advance'));
  END IF;
END $$;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS current_payment_attempt_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_current_payment_attempt_id_fkey'
      AND conrelid = 'orders'::regclass
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_current_payment_attempt_id_fkey
      FOREIGN KEY (current_payment_attempt_id)
      REFERENCES razorpay_payment_attempts(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_razorpay_payment_attempts_order_created
  ON razorpay_payment_attempts(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_razorpay_payment_attempts_order_purpose_state
  ON razorpay_payment_attempts(order_id, purpose, payment_state);
