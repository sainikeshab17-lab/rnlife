-- Add source-event identity and append-only processing-attempt history.
-- Existing inbox rows remain valid; provider_event_id is nullable for legacy rows.
ALTER TABLE razorpay_refund_webhook_inbox
  ADD COLUMN IF NOT EXISTS provider_event_id TEXT,
  ADD COLUMN IF NOT EXISTS source_payload_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_razorpay_refund_inbox_provider_event_id
  ON razorpay_refund_webhook_inbox(provider_event_id);

CREATE TABLE IF NOT EXISTS razorpay_refund_webhook_attempts (
  id BIGSERIAL PRIMARY KEY,
  event_key TEXT NOT NULL REFERENCES razorpay_refund_webhook_inbox(event_key) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN ('received', 'duplicate', 'processed', 'deferred', 'quarantined', 'retry_blocked')),
  reason TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_razorpay_refund_webhook_attempts_event
  ON razorpay_refund_webhook_attempts(event_key, attempted_at);

CREATE OR REPLACE FUNCTION public.prevent_razorpay_refund_webhook_attempt_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Razorpay refund webhook attempt history is append-only'
    USING ERRCODE = '23514';
END;
$$;

DROP TRIGGER IF EXISTS trg_razorpay_refund_webhook_attempt_immutable ON razorpay_refund_webhook_attempts;
CREATE TRIGGER trg_razorpay_refund_webhook_attempt_immutable
BEFORE UPDATE OR DELETE ON razorpay_refund_webhook_attempts
FOR EACH ROW EXECUTE FUNCTION public.prevent_razorpay_refund_webhook_attempt_mutation();

CREATE OR REPLACE FUNCTION public.enforce_razorpay_refund_inbox_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.state = NEW.state THEN
    RETURN NEW;
  END IF;

  IF OLD.state = 'received' AND NEW.state IN ('deferred', 'processed', 'quarantined') THEN
    RETURN NEW;
  END IF;

  IF OLD.state = 'deferred' AND NEW.state IN ('processed', 'quarantined') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Illegal Razorpay refund inbox state transition: % -> %', OLD.state, NEW.state
    USING ERRCODE = '23514';
END;
$$;

DROP TRIGGER IF EXISTS trg_razorpay_refund_inbox_transition ON razorpay_refund_webhook_inbox;
CREATE TRIGGER trg_razorpay_refund_inbox_transition
BEFORE UPDATE OF state ON razorpay_refund_webhook_inbox
FOR EACH ROW EXECUTE FUNCTION public.enforce_razorpay_refund_inbox_transition();
ALTER TABLE public.razorpay_refund_webhook_attempts
  ENABLE ROW LEVEL SECURITY;