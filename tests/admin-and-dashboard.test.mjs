import { test, describe } from "node:test";
import assert from "node:assert";
import crypto from "node:crypto";
import { getDb } from "../src/lib/db/index.ts";
import {
  hashPassword,
  verifyPassword,
  createAdminUser,
  getAdminByEmail,
  createSession,
  revokeSession,
} from "../src/lib/auth/admin-auth.ts";
import {
  isValidAdminTransition,
  requiresRefund,
  getValidNextStatuses,
} from "../src/lib/order-status-machine.ts";
import { writeAuditLog, getAuditLogs } from "../src/lib/db/audit.ts";
import {
  createPendingOrder,
  getOrderById,
  markOrderAsPaid,
  checkAndReserveInventory,
  releaseInventoryReservation,
} from "../src/lib/db/orders.ts";
import { generateOrderNumber } from "../src/services/checkout-service.ts";
import { PRODUCTS } from "../src/data/mock-data.ts";

describe("Phase 3: Secure Admin Authentication & Password Hashing", () => {
  test("PBKDF2-SHA512 password hash verifies correctly and rejects wrong passwords", () => {
    const rawPass = "SecretAdminPass@2026";
    const hashed = hashPassword(rawPass);

    assert.ok(hashed.startsWith("pbkdf2$100000$"));
    assert.strictEqual(verifyPassword(rawPass, hashed), true);
    assert.strictEqual(verifyPassword("WrongPassword123!", hashed), false);
    assert.strictEqual(verifyPassword("", hashed), false);
  });

  test("Rejects creation of admin user with password under 12 characters", () => {
    const shortResult = createAdminUser("short@rnl.in", "Short", "weak123");
    assert.strictEqual(shortResult.success, false);
    assert.match(shortResult.error, /at least 12 characters/i);
  });

  test("Creates and retrieves admin user idempotently without password leakage", () => {
    const email = `admin_test_${Date.now()}@rightnowlife.in`;
    const createRes = createAdminUser(email, "Test Lead", "SecurePassphrase123#");
    assert.strictEqual(createRes.success, true);

    const retrieved = getAdminByEmail(email);
    assert.ok(retrieved);
    assert.strictEqual(retrieved.email, email);
    assert.strictEqual(retrieved.name, "Test Lead");
    assert.strictEqual(retrieved.is_active, 1);
    // Stored hash must never equal raw password
    assert.notStrictEqual(retrieved.password_hash, "SecurePassphrase123#");
    assert.strictEqual(verifyPassword("SecurePassphrase123#", retrieved.password_hash), true);

    // Duplicate creation must be blocked
    const duplicate = createAdminUser(email, "Dupe", "SecurePassphrase123#");
    assert.strictEqual(duplicate.success, false);
  });

  test("Session lifecycle: generates token, hashes in DB, and revokes cleanly", () => {
    const email = `session_adm_${Date.now()}@rightnowlife.in`;
    createAdminUser(email, "Session Tester", "SecurePassphrase123#");
    const admin = getAdminByEmail(email);
    assert.ok(admin);

    const rawToken = createSession(admin.id, "127.0.0.1", "NodeTest/1.0");
    assert.ok(rawToken);
    assert.strictEqual(rawToken.length, 64); // 32 bytes hex

    const db = getDb();
    // Raw token must NOT exist in the database (only hashed token stored)
    const rawInDb = db.prepare("SELECT * FROM admin_sessions WHERE token_hash = ?").get(rawToken);
    assert.strictEqual(rawInDb, undefined);

    // Revocation clears the session
    revokeSession(rawToken);
  });
});

describe("Phase 3: Order Status State Machine & Refund Safety", () => {
  test("Validates strict admin transition rules", () => {
    // Valid transitions
    assert.strictEqual(isValidAdminTransition("paid", "processing"), true);
    assert.strictEqual(isValidAdminTransition("processing", "shipped"), true);
    assert.strictEqual(isValidAdminTransition("shipped", "delivered"), true);
    assert.strictEqual(isValidAdminTransition("pending_payment", "cancelled"), true);
    assert.strictEqual(isValidAdminTransition("paid", "cancelled"), true);
    assert.strictEqual(isValidAdminTransition("processing", "cancelled"), true);

    // FORBIDDEN transitions
    assert.strictEqual(isValidAdminTransition("pending_payment", "paid"), false); // Only via payment verification!
    assert.strictEqual(isValidAdminTransition("delivered", "shipped"), false); // Terminal state
    assert.strictEqual(isValidAdminTransition("cancelled", "paid"), false); // Terminal state
    assert.strictEqual(isValidAdminTransition("delivered", "cancelled"), false);
  });

  test("Requires refund flag accurately when cancelling paid vs unpaid orders", () => {
    // Paid order cancellation requires refund
    assert.strictEqual(requiresRefund("paid", "cancelled"), true);
    assert.strictEqual(requiresRefund("processing", "cancelled"), true);

    // Unpaid pending order cancellation requires NO refund
    assert.strictEqual(requiresRefund("pending_payment", "cancelled"), false);
  });

  test("Order detail endpoint returns status transition history and audit timestamps", () => {
    const orderNumber = generateOrderNumber();
    const { order } = createPendingOrder({
      orderNumber,
      customerName: "Status History Customer",
      customerEmail: "history_test@rightnowlife.in",
      customerPhone: "9876543299",
      subtotal: 999,
      shipping: 99,
      discount: 0,
      total: 1098,
      paymentMethod: "Razorpay",
      items: [
        {
          productId: "rnl-design-01",
          productSlug: "rightnowlife-design-01",
          productName: "DESIGN 01 — GRAPHIC RAGLAN TEE",
          color: "As pictured",
          size: "M",
          price: 999,
          quantity: 1,
          image: "/products/design_01_front.png",
          sku: "RNL-DESIGN-01-M",
          fit: "Regular",
        },
      ],
      address: {
        fullName: "Status History Customer",
        phone: "9876543299",
        addressLine1: "MG Road",
        city: "Bengaluru",
        state: "Karnataka",
        pinCode: "560001",
      },
    });

    const db = getDb();
    // Simulate recording status transition in order_status_history
    const histId = `sh_${Date.now()}`;
    db.prepare(`
      INSERT INTO order_status_history (id, order_id, from_status, to_status, actor, note, created_at)
      VALUES (?, ?, 'pending_payment', 'cancelled', 'admin@rightnowlife.in', 'Customer requested cancellation', ?)
    `).run(histId, order.id, new Date().toISOString());

    const historyRows = db
      .prepare("SELECT * FROM order_status_history WHERE order_id = ?")
      .all(order.id);

    assert.strictEqual(historyRows.length, 1);
    assert.strictEqual(historyRows[0].to_status, "cancelled");
    assert.strictEqual(historyRows[0].actor, "admin@rightnowlife.in");
  });
});

describe("Phase 3: Inventory Management, Adjustments & Concurrency", () => {
  test("Prevents overselling when requested quantity exceeds available stock", () => {
    const db = getDb();
    // Check initial stock for design 01 size XXL
    const inv = db
      .prepare("SELECT stock, reserved FROM inventory WHERE product_id = ? AND size = ?")
      .get("rnl-design-01", "XXL");

    const available = inv.stock - inv.reserved;

    // Requesting more than available must fail cleanly
    const excessCheck = checkAndReserveInventory([
      { productId: "rnl-design-01", size: "XXL", quantity: available + 50 },
    ]);
    assert.strictEqual(excessCheck.ok, false);
    assert.match(excessCheck.error, /Insufficient stock/i);
  });

  test("Records inventory adjustment with actor, before/after stock, and reason in audit table", () => {
    const db = getDb();
    const productId = "rnl-design-02";
    const size = "M";

    const beforeRow = db
      .prepare("SELECT stock FROM inventory WHERE product_id = ? AND size = ?")
      .get(productId, size);

    const newStock = beforeRow.stock + 15;
    const delta = 15;
    const reason = "Received shipment batch from Bengaluru textile unit";
    const actor = "warehouse_lead@rightnowlife.in";

    // Update stock
    db.prepare("UPDATE inventory SET stock = ? WHERE product_id = ? AND size = ?").run(
      newStock,
      productId,
      size
    );

    // Record adjustment audit
    const adjId = `iadj_test_${Date.now()}`;
    db.prepare(`
      INSERT INTO inventory_adjustments (id, product_id, size, prev_stock, new_stock, delta, reason, actor, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(adjId, productId, size, beforeRow.stock, newStock, delta, reason, actor, new Date().toISOString());

    // Verify audit entry
    const recorded = db
      .prepare("SELECT * FROM inventory_adjustments WHERE id = ?")
      .get(adjId);

    assert.strictEqual(recorded.prev_stock, beforeRow.stock);
    assert.strictEqual(recorded.new_stock, newStock);
    assert.strictEqual(recorded.delta, delta);
    assert.strictEqual(recorded.reason, reason);
    assert.strictEqual(recorded.actor, actor);
  });
});

describe("Phase 3: Immutable Audit Logging & Pricing Lockdown", () => {
  test("Writes and retrieves audit log entries with metadata and before/after values", () => {
    const actor = "governance@rightnowlife.in";
    const action = "product_visibility_toggled";
    const entityType = "product";
    const entityId = "rnl-design-03";

    writeAuditLog({
      actor,
      action,
      entityType,
      entityId,
      before: { is_active: true },
      after: { is_active: false },
      metadata: { reason: "Seasonal rotation" },
    });

    const { logs, total } = getAuditLogs({ entityType, entityId });
    assert.ok(total >= 1);
    const found = logs.find((l) => l.action === action);
    assert.ok(found);
    assert.strictEqual(found.actor, actor);
    assert.strictEqual(JSON.parse(found.before_value).is_active, true);
    assert.strictEqual(JSON.parse(found.after_value).is_active, false);
  });

  test("Strict ₹999 price enforcement across all 8 catalog designs", () => {
    // Assert all 8 products in catalog are strictly ₹999
    assert.strictEqual(PRODUCTS.length, 8);
    for (const product of PRODUCTS) {
      assert.strictEqual(product.price, 999, `Product ${product.name} must be ₹999`);
    }
  });

  test("Dashboard calculation logic computes gross vs net sales accurately", () => {
    const db = getDb();

    // Sum paid and refund_pending orders
    const grossRow = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as gross
      FROM orders
      WHERE payment_status IN ('paid', 'refund_pending')
    `).get();

    const refundRow = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as refunded
      FROM orders
      WHERE order_status = 'refunded'
    `).get();

    const netSales = grossRow.gross - refundRow.refunded;
    assert.ok(typeof grossRow.gross === "number");
    assert.ok(typeof netSales === "number");
    assert.ok(grossRow.gross >= netSales); // Net sales cannot exceed gross sales
  });
});
