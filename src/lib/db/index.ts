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

export interface OrderWithDetails extends DbOrder {
  items: DbOrderItem[];
  address: DbOrderAddress | null;
}
