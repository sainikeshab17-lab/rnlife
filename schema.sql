-- Legacy partial bootstrap schema retained for historical reference only.
-- Do not use this file to create a PostgreSQL database: it omits runtime tables.
-- The complete, versioned PostgreSQL schema is in
-- supabase/migrations/20261017000000_supabase_init.sql.

CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(64) PRIMARY KEY,
  order_number VARCHAR(32) UNIQUE NOT NULL,
  customer_name VARCHAR(128) NOT NULL,
  customer_email VARCHAR(128) NOT NULL,
  customer_phone VARCHAR(32) NOT NULL,
  subtotal INTEGER NOT NULL,
  shipping INTEGER NOT NULL,
  discount INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  payment_method VARCHAR(64) NOT NULL,
  payment_status VARCHAR(32) NOT NULL DEFAULT 'pending_payment',
  order_status VARCHAR(32) NOT NULL DEFAULT 'pending_payment',
  razorpay_order_id VARCHAR(64),
  razorpay_payment_id VARCHAR(64),
  razorpay_signature VARCHAR(128),
  guest_token VARCHAR(64) NOT NULL,
  user_id VARCHAR(64),
  created_at VARCHAR(64) NOT NULL,
  updated_at VARCHAR(64) NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id VARCHAR(64) PRIMARY KEY,
  order_id VARCHAR(64) NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  product_slug VARCHAR(128) NOT NULL,
  product_name VARCHAR(128) NOT NULL,
  color VARCHAR(64) NOT NULL,
  size VARCHAR(16) NOT NULL,
  price INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  image VARCHAR(256) NOT NULL,
  sku VARCHAR(64) NOT NULL,
  fit VARCHAR(32) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_addresses (
  id VARCHAR(64) PRIMARY KEY,
  order_id VARCHAR(64) NOT NULL,
  full_name VARCHAR(128) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  address_line1 VARCHAR(256) NOT NULL,
  address_line2 VARCHAR(256),
  landmark VARCHAR(128),
  city VARCHAR(64) NOT NULL,
  state VARCHAR(64) NOT NULL,
  pin_code VARCHAR(16) NOT NULL,
  country VARCHAR(64) NOT NULL DEFAULT 'India',
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inventory (
  product_id VARCHAR(64) NOT NULL,
  size VARCHAR(16) NOT NULL,
  stock INTEGER NOT NULL DEFAULT 20,
  reserved INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, size)
);

CREATE TABLE IF NOT EXISTS payment_audits (
  id VARCHAR(64) PRIMARY KEY,
  order_id VARCHAR(64),
  event_type VARCHAR(64) NOT NULL,
  payload TEXT NOT NULL,
  created_at VARCHAR(64) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order ON orders(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_guest_token ON orders(guest_token);
