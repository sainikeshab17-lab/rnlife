-- =============================================================================
-- RIGHTNOWLIFE — Supabase PostgreSQL Schema Migration
-- Migration: 20261017000000_supabase_init.sql
-- Description: Complete 16-table schema with constraints, foreign keys,
--              reconciled columns (return_items.product_name, refund_records.amount_paisa),
--              and performance indexes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Orders
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  subtotal INTEGER NOT NULL,
  shipping INTEGER NOT NULL,
  discount INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending_payment',
  order_status TEXT NOT NULL DEFAULT 'pending_payment',
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  guest_token TEXT NOT NULL,
  user_id TEXT,
  courier_name TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  notes TEXT,
  cancelled_reason TEXT,
  refund_status TEXT,
  refund_id TEXT,
  dispatch_date TIMESTAMPTZ,
  estimated_delivery_date TIMESTAMPTZ,
  actual_delivery_date TIMESTAMPTZ,
  cancellation_requested INTEGER DEFAULT 0,
  cancellation_requested_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order ON orders(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_guest_token ON orders(guest_token);
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- -----------------------------------------------------------------------------
-- 2. Order Items
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_slug TEXT NOT NULL,
  product_name TEXT NOT NULL,
  color TEXT NOT NULL,
  size TEXT NOT NULL,
  price INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  image TEXT NOT NULL,
  sku TEXT NOT NULL,
  fit TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- -----------------------------------------------------------------------------
-- 3. Order Addresses
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_addresses (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  landmark TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pin_code TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'India'
);

CREATE INDEX IF NOT EXISTS idx_order_addresses_order_id ON order_addresses(order_id);

-- -----------------------------------------------------------------------------
-- 4. Inventory
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory (
  product_id TEXT NOT NULL,
  size TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 20,
  reserved INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, size)
);

CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON inventory(product_id);

-- -----------------------------------------------------------------------------
-- 5. Payment Audits
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_audits (
  id TEXT PRIMARY KEY,
  order_id TEXT,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_audits_order_id ON payment_audits(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_audits_event_type ON payment_audits(event_type);

-- -----------------------------------------------------------------------------
-- 6. Order Status History
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_status_history (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_history_order ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_status_history_created_at ON order_status_history(created_at DESC);

-- -----------------------------------------------------------------------------
-- 7. Admin Users
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 8. Admin Sessions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_session_token ON admin_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_session_admin ON admin_sessions(admin_id);

-- -----------------------------------------------------------------------------
-- 9. Inventory Adjustments
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  size TEXT NOT NULL,
  prev_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  actor TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_adj_product ON inventory_adjustments(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_adj_created_at ON inventory_adjustments(created_at DESC);

-- -----------------------------------------------------------------------------
-- 10. Audit Logs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  before_value TEXT,
  after_value TEXT,
  metadata TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- -----------------------------------------------------------------------------
-- 11. Product Overrides
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_overrides (
  product_id TEXT PRIMARY KEY,
  is_active INTEGER NOT NULL DEFAULT 1,
  custom_description TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 12. Shipping Events
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shipping_events (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  location TEXT,
  description TEXT NOT NULL,
  courier_name TEXT,
  tracking_number TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipping_events_order ON shipping_events(order_id);
CREATE INDEX IF NOT EXISTS idx_shipping_events_occurred ON shipping_events(occurred_at DESC);

-- -----------------------------------------------------------------------------
-- 13. Returns
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS returns (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  return_number TEXT UNIQUE NOT NULL,
  customer_email TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'return',
  status TEXT NOT NULL DEFAULT 'requested',
  reason TEXT NOT NULL,
  customer_note TEXT,
  admin_note TEXT,
  customer_notes TEXT,
  admin_notes TEXT,
  resolution_type TEXT DEFAULT 'refund',
  refund_amount INTEGER DEFAULT 0,
  inspection_result TEXT,
  inspection_notes TEXT,
  restocked INTEGER NOT NULL DEFAULT 0,
  exchange_item_id TEXT,
  exchange_size TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_returns_order ON returns(order_id);
CREATE INDEX IF NOT EXISTS idx_returns_email ON returns(customer_email);
CREATE INDEX IF NOT EXISTS idx_returns_status ON returns(status);

-- -----------------------------------------------------------------------------
-- 14. Return Items (Reconciled with product_name, product_slug, price, etc.)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS return_items (
  id TEXT PRIMARY KEY,
  return_id TEXT NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  order_item_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  size TEXT NOT NULL,
  color TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price INTEGER NOT NULL,
  product_slug TEXT,
  requested_exchange_size TEXT,
  condition TEXT DEFAULT 'pending',
  restocked INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_return_items_return ON return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_return_items_product ON return_items(product_id);

-- -----------------------------------------------------------------------------
-- 15. Refund Records (Reconciled with amount_paisa, idempotency_key, etc.)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refund_records (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  return_id TEXT,
  razorpay_payment_id TEXT NOT NULL,
  razorpay_refund_id TEXT,
  amount INTEGER NOT NULL,
  amount_paisa INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'requested',
  reason TEXT,
  idempotency_key TEXT UNIQUE NOT NULL,
  raw_response TEXT,
  initiated_by TEXT,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refund_records_order ON refund_records(order_id);
CREATE INDEX IF NOT EXISTS idx_refund_records_rzp ON refund_records(razorpay_refund_id);

-- -----------------------------------------------------------------------------
-- 16. Notification Jobs (Persistent Transactional Queue)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_jobs (
  id TEXT PRIMARY KEY,
  order_id TEXT,
  event_type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  provider TEXT NOT NULL DEFAULT 'none',
  provider_message_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  idempotency_key TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_order ON notification_jobs(order_id);
CREATE INDEX IF NOT EXISTS idx_notif_status ON notification_jobs(status);

-- These tables contain customer, payment-reference, and credential data.
-- The application connects only from server-side code using its private DB URL.
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_jobs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  orders, order_items, order_addresses, inventory, payment_audits,
  order_status_history, admin_users, admin_sessions, inventory_adjustments,
  audit_logs, product_overrides, shipping_events, returns, return_items,
  refund_records, notification_jobs
FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
-- =============================================================================
