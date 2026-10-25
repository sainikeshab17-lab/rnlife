-- Shared PostgreSQL-backed admin login throttling for multi-instance runtimes.
-- Bucket identities are HMAC-SHA256 values; raw email addresses and IPs are not stored.
CREATE TABLE IF NOT EXISTS admin_login_rate_limits (
  bucket_hash TEXT PRIMARY KEY CHECK (bucket_hash ~ '^[a-f0-9]{64}$'),
  window_started_at TIMESTAMPTZ NOT NULL,
  attempt_count INTEGER NOT NULL CHECK (attempt_count >= 0),
  blocked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_login_rate_limits_updated_at
  ON admin_login_rate_limits(updated_at);

ALTER TABLE admin_login_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE admin_login_rate_limits FROM anon, authenticated;
