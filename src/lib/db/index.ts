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

export interface OrderWithDetails extends DbOrder {
  items: DbOrderItem[];
  address: DbOrderAddress | null;
  history?: DbOrderStatusHistory[];
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
