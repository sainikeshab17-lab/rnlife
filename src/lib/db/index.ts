import path from "path";
import fs from "fs";
import { DatabaseSync } from "node:sqlite";
import { PRODUCTS } from "@/data/mock-data";

// Database storage file path
const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "rightnowlife.db");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Singleton database instance
let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_FILE);
    dbInstance.exec("PRAGMA foreign_keys = ON;");
    dbInstance.exec("PRAGMA journal_mode = WAL;");
    initSchema(dbInstance);
    runMigrations(dbInstance);
  }
  return dbInstance;
}

function initSchema(db: DatabaseSync) {
  db.exec(`
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
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_slug TEXT NOT NULL,
      product_name TEXT NOT NULL,
      color TEXT NOT NULL,
      size TEXT NOT NULL,
      price INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      image TEXT NOT NULL,
      sku TEXT NOT NULL,
      fit TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS order_addresses (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address_line1 TEXT NOT NULL,
      address_line2 TEXT,
      landmark TEXT,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      pin_code TEXT NOT NULL,
      country TEXT NOT NULL DEFAULT 'India',
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS inventory (
      product_id TEXT NOT NULL,
      size TEXT NOT NULL,
      stock INTEGER NOT NULL DEFAULT 20,
      reserved INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (product_id, size)
    );

    CREATE TABLE IF NOT EXISTS payment_audits (
      id TEXT PRIMARY KEY,
      order_id TEXT,
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
    CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order ON orders(razorpay_order_id);
    CREATE INDEX IF NOT EXISTS idx_orders_guest_token ON orders(guest_token);
  `);

  // Seed inventory for actual 8 products if not already initialized
  const countRow = db.prepare("SELECT COUNT(*) as count FROM inventory").get() as { count: number };
  if (countRow.count === 0) {
    const insertInv = db.prepare(`
      INSERT OR IGNORE INTO inventory (product_id, size, stock, reserved)
      VALUES (?, ?, ?, 0)
    `);

    for (const p of PRODUCTS) {
      for (const size of p.sizes) {
        insertInv.run(p.id, size, p.stock || 20);
      }
    }
  }
}

/**
 * Additive migrations — safe to run repeatedly.
 * Each migration checks for existence before altering.
 */
function runMigrations(db: DatabaseSync) {
  // Migration 001: Add shipping/tracking columns to orders
  try {
    db.exec(`ALTER TABLE orders ADD COLUMN courier_name TEXT;`);
  } catch { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE orders ADD COLUMN tracking_number TEXT;`);
  } catch { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE orders ADD COLUMN tracking_url TEXT;`);
  } catch { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE orders ADD COLUMN notes TEXT;`);
  } catch { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE orders ADD COLUMN cancelled_reason TEXT;`);
  } catch { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE orders ADD COLUMN refund_status TEXT;`);
  } catch { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE orders ADD COLUMN refund_id TEXT;`);
  } catch { /* column already exists */ }

  // Migration 002: Order status history
  db.exec(`
    CREATE TABLE IF NOT EXISTS order_status_history (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      actor TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_status_history_order ON order_status_history(order_id);
  `);

  // Migration 003: Admin users (hashed passwords, no plain text stored)
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_admin_email ON admin_users(email);
  `);

  // Migration 004: Admin sessions (HTTP-only cookie tokens)
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      id TEXT PRIMARY KEY,
      admin_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_session_token ON admin_sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_session_admin ON admin_sessions(admin_id);
  `);

  // Migration 005: Inventory adjustments audit
  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory_adjustments (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      size TEXT NOT NULL,
      prev_stock INTEGER NOT NULL,
      new_stock INTEGER NOT NULL,
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL,
      actor TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_inv_adj_product ON inventory_adjustments(product_id);
  `);

  // Migration 006: General admin audit log
  db.exec(`
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
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor);
    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
  `);

  // Migration 007: Product overrides (visibility, description overrides — price always 999)
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_overrides (
      product_id TEXT PRIMARY KEY,
      is_active INTEGER NOT NULL DEFAULT 1,
      custom_description TEXT,
      updated_by TEXT,
      updated_at TEXT NOT NULL
    );
  `);

  // Migration 008 (Phase 4): Detailed Shipping & Fulfilment Dates
  try {
    db.exec(`ALTER TABLE orders ADD COLUMN dispatch_date TEXT;`);
  } catch { /* column exists */ }
  try {
    db.exec(`ALTER TABLE orders ADD COLUMN estimated_delivery_date TEXT;`);
  } catch { /* column exists */ }
  try {
    db.exec(`ALTER TABLE orders ADD COLUMN actual_delivery_date TEXT;`);
  } catch { /* column exists */ }
  try {
    db.exec(`ALTER TABLE orders ADD COLUMN cancellation_requested INTEGER DEFAULT 0;`);
  } catch { /* column exists */ }
  try {
    db.exec(`ALTER TABLE orders ADD COLUMN cancellation_requested_at TEXT;`);
  } catch { /* column exists */ }
  try {
    db.exec(`ALTER TABLE orders ADD COLUMN cancellation_reason TEXT;`);
  } catch { /* column exists */ }

  // Migration 009 (Phase 4): Shipping Events / Tracking History
  db.exec(`
    CREATE TABLE IF NOT EXISTS shipping_events (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      status TEXT NOT NULL,
      location TEXT,
      description TEXT NOT NULL,
      courier_name TEXT,
      tracking_number TEXT,
      occurred_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_shipping_events_order ON shipping_events(order_id);
  `);

  // Migration 010 (Phase 4): Returns and Exchanges
  db.exec(`
    CREATE TABLE IF NOT EXISTS returns (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      return_number TEXT,
      customer_email TEXT,
      type TEXT NOT NULL DEFAULT 'return', -- 'return' | 'exchange'
      status TEXT NOT NULL DEFAULT 'requested', -- 'requested' | 'approved' | 'rejected' | 'in_transit' | 'inspected' | 'completed' | 'cancelled'
      reason TEXT NOT NULL,
      customer_note TEXT,
      admin_note TEXT,
      resolution_type TEXT NOT NULL DEFAULT 'refund',
      refund_amount INTEGER NOT NULL DEFAULT 0,
      inspection_result TEXT,
      inspection_notes TEXT,
      restocked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_returns_order ON returns(order_id);
  `);
  try { db.exec(`ALTER TABLE returns ADD COLUMN customer_note TEXT;`); } catch {}
  try { db.exec(`ALTER TABLE returns ADD COLUMN admin_note TEXT;`); } catch {}
  try { db.exec(`ALTER TABLE returns ADD COLUMN resolution_type TEXT DEFAULT 'refund';`); } catch {}
  try { db.exec(`ALTER TABLE returns ADD COLUMN refund_amount INTEGER DEFAULT 0;`); } catch {}

  // Migration 011 (Phase 4): Return Line Items
  db.exec(`
    CREATE TABLE IF NOT EXISTS return_items (
      id TEXT PRIMARY KEY,
      return_id TEXT NOT NULL,
      order_item_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_slug TEXT,
      size TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      requested_exchange_size TEXT,
      condition TEXT NOT NULL DEFAULT 'pending',
      restocked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (return_id) REFERENCES returns(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_return_items_return ON return_items(return_id);
  `);
  try { db.exec(`ALTER TABLE return_items ADD COLUMN product_slug TEXT;`); } catch {}
  try { db.exec(`ALTER TABLE return_items ADD COLUMN requested_exchange_size TEXT;`); } catch {}
  try { db.exec(`ALTER TABLE return_items ADD COLUMN condition TEXT DEFAULT 'pending';`); } catch {}
  try { db.exec(`ALTER TABLE return_items ADD COLUMN restocked INTEGER DEFAULT 0;`); } catch {}
  try { db.exec(`ALTER TABLE return_items ADD COLUMN created_at TEXT;`); } catch {}

  // Migration 012 (Phase 4): Refund Records
  db.exec(`
    CREATE TABLE IF NOT EXISTS refund_records (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      return_id TEXT,
      razorpay_payment_id TEXT,
      razorpay_refund_id TEXT,
      amount INTEGER NOT NULL, -- in INR rupees
      currency TEXT NOT NULL DEFAULT 'INR',
      status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'processed' | 'failed' | 'rejected'
      reason TEXT,
      initiated_by TEXT,
      failure_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_refund_records_order ON refund_records(order_id);
    CREATE INDEX IF NOT EXISTS idx_refund_records_rzp ON refund_records(razorpay_refund_id);
  `);
  try { db.exec(`ALTER TABLE refund_records ADD COLUMN initiated_by TEXT;`); } catch {}
  try { db.exec(`ALTER TABLE refund_records ADD COLUMN failure_reason TEXT;`); } catch {}

  // Migration 013 (Phase 4): Persistent Notification Jobs
  db.exec(`
    CREATE TABLE IF NOT EXISTS notification_jobs (
      id TEXT PRIMARY KEY,
      order_id TEXT,
      event_type TEXT NOT NULL, -- 'order_placed' | 'payment_confirmed' | 'order_dispatched' | 'tracking_updated' | 'order_delivered' | 'cancellation_decided' | 'return_decided' | 'refund_processed' | 'refund_failed'
      recipient_email TEXT NOT NULL,
      recipient_name TEXT,
      subject TEXT NOT NULL,
      html_content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'sent' | 'failed' | 'skipped'
      provider TEXT NOT NULL DEFAULT 'none',
      provider_message_id TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 3,
      last_error TEXT,
      idempotency_key TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_notif_order ON notification_jobs(order_id);
    CREATE INDEX IF NOT EXISTS idx_notif_status ON notification_jobs(status);
  `);
}

export interface DbOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  payment_method: string;
  payment_status: string;
  order_status: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  guest_token: string;
  user_id: string | null;
  courier_name: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  dispatch_date?: string | null;
  estimated_delivery_date?: string | null;
  actual_delivery_date?: string | null;
  cancellation_requested?: number;
  cancellation_requested_at?: string | null;
  cancellation_reason?: string | null;
  notes: string | null;
  cancelled_reason: string | null;
  refund_status: string | null;
  refund_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_slug: string;
  product_name: string;
  color: string;
  size: string;
  price: number;
  quantity: number;
  image: string;
  sku: string;
  fit: string;
}

export interface DbOrderAddress {
  id: string;
  order_id: string;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pin_code: string;
  country: string;
}

export interface DbOrderStatusHistory {
  id: string;
  order_id: string;
  from_status: string | null;
  to_status: string;
  actor: string;
  note: string | null;
  created_at: string;
}

export interface DbShippingEvent {
  id: string;
  order_id: string;
  status: string;
  location: string | null;
  description: string;
  occurred_at: string;
  created_at: string;
}

export interface DbReturn {
  id: string;
  order_id: string;
  type: 'return' | 'exchange';
  status: 'requested' | 'approved' | 'rejected' | 'in_transit' | 'inspected' | 'completed' | 'cancelled';
  reason: string;
  customer_note: string | null;
  admin_note: string | null;
  resolution_type: 'refund' | 'exchange';
  refund_amount: number;
  created_at: string;
  updated_at: string;
}

export interface DbReturnItem {
  id: string;
  return_id: string;
  order_item_id: string;
  product_id: string;
  product_slug: string;
  size: string;
  quantity: number;
  requested_exchange_size: string | null;
  condition: 'pending' | 'resalable' | 'damaged' | 'unsuitable';
  restocked: number;
  created_at: string;
}

export interface DbRefundRecord {
  id: string;
  order_id: string;
  return_id: string | null;
  razorpay_refund_id: string | null;
  razorpay_payment_id: string | null;
  amount: number;
  currency: string;
  status: 'pending' | 'processed' | 'failed';
  reason: string;
  initiated_by: string;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbNotificationJob {
  id: string;
  order_id: string | null;
  recipient_email: string;
  recipient_name: string | null;
  event_type: string;
  subject: string;
  body_text: string | null;
  body_html: string;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderWithDetails extends DbOrder {
  items: DbOrderItem[];
  address: DbOrderAddress | null;
  history?: DbOrderStatusHistory[];
  shipping_events?: DbShippingEvent[];
  returns?: (DbReturn & { items: DbReturnItem[] })[];
  refunds?: DbRefundRecord[];
}

export interface DbAdminUser {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface DbInventoryRow {
  product_id: string;
  size: string;
  stock: number;
  reserved: number;
}

export interface DbAuditLog {
  id: string;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_value: string | null;
  after_value: string | null;
  metadata: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface DbProductOverride {
  product_id: string;
  is_active: number;
  custom_description: string | null;
  updated_by: string | null;
  updated_at: string;
}
