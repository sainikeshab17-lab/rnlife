-- Reuse the existing transactional outbox and its idempotency key for WhatsApp.
ALTER TABLE notification_jobs
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS recipient_phone TEXT,
  ADD COLUMN IF NOT EXISTS content_sid TEXT,
  ADD COLUMN IF NOT EXISTS content_variables JSONB;

CREATE INDEX IF NOT EXISTS idx_notification_channel_status
  ON notification_jobs(channel, status);
