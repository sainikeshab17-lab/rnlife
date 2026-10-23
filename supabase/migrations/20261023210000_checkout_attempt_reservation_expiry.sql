-- Reservation lifecycle for checkout attempts. No historical order or attempt
-- is rewritten; only newly expired safe-to-release attempts are transitioned.
ALTER TABLE checkout_payment_attempts
  ADD COLUMN IF NOT EXISTS reservation_state TEXT NOT NULL DEFAULT 'held'
    CHECK (reservation_state IN ('held', 'released', 'consumed')),
  ADD COLUMN IF NOT EXISTS reservation_released_at TIMESTAMPTZ;

ALTER TABLE checkout_payment_attempts
  DROP CONSTRAINT IF EXISTS checkout_payment_attempts_attempt_status_check;
ALTER TABLE checkout_payment_attempts
  ADD CONSTRAINT checkout_payment_attempts_attempt_status_check
    CHECK (attempt_status IN ('pending', 'authorized', 'failed', 'cancelled', 'captured', 'converted', 'reconciliation_required', 'expired'));

CREATE INDEX IF NOT EXISTS idx_checkout_attempt_expiry_reservation
  ON checkout_payment_attempts(expires_at, created_at)
  WHERE reservation_state = 'held' AND attempt_status IN ('pending', 'failed', 'cancelled', 'authorized', 'reconciliation_required');
