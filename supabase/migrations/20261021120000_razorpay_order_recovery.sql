-- Durable Razorpay Orders API creation state. Existing orders remain valid:
-- legacy rows retain NULL state and are reconciled instead of recreated.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS razorpay_order_state TEXT
    CHECK (razorpay_order_state IS NULL OR razorpay_order_state IN (
      'pending', 'creating', 'ready', 'unknown', 'retryable'
    )),
  ADD COLUMN IF NOT EXISTS razorpay_order_attempted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order_recovery
  ON orders(razorpay_order_state, razorpay_order_attempted_at)
  WHERE razorpay_order_state IN ('creating', 'unknown', 'retryable');
