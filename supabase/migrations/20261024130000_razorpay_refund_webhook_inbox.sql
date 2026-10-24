-- Durable, idempotent inbox for signed Razorpay refund events.
-- Apply manually after review; never apply to production as part of tests.
CREATE TABLE IF NOT EXISTS razorpay_refund_webhook_inbox (
  event_key TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  refund_id TEXT NOT NULL,
  payment_id TEXT NOT NULL,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  amount_paisa INTEGER NOT NULL CHECK (amount_paisa > 0),
  currency TEXT NOT NULL,
  provider_status TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'received' CHECK (state IN ('received', 'deferred', 'processed', 'quarantined')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_razorpay_refund_webhook_inbox_state
  ON razorpay_refund_webhook_inbox(state, received_at)
  WHERE state IN ('received', 'deferred');
ALTER TABLE public.razorpay_refund_webhook_inbox
  ENABLE ROW LEVEL SECURITY;