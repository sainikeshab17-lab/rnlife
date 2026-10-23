-- Pending online checkout rows remain available to payment verification and
-- reconciliation, but are not confirmed orders. Existing records are retained
-- unchanged; list queries also exclude legacy pending online rows safely.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_orders_confirmed_created
  ON orders(is_confirmed, created_at DESC);

-- No UPDATE or DELETE is performed. Review legacy pending records and payment
-- history before any separately approved cleanup or archival operation.
