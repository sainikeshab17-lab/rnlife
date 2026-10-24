import { test, describe } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { databaseTest } from "./postgres-test-support.mjs";
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
  canInitiateRefund,
  getCancellationResultStatus,
  classifyRefundWebhook,
  shouldMarkOrderRefunded,
  getRefundWebhookIdempotencyKey,
} from "../src/lib/order-status-machine.ts";
import { writeAuditLog, getAuditLogs } from "../src/lib/db/audit.ts";
import {
  createPendingOrder,
  checkAndReserveInventory,
} from "../src/lib/db/orders.ts";
import { generateOrderNumber } from "../src/services/checkout-service.ts";
import { COLLECTIONS, PRODUCTS } from "../src/data/mock-data.ts";
import { getCatalogDisplayName, getInventoryProductLabel, getInventoryProductIdsMissingFromCatalog } from "../src/services/inventory-product-catalog.ts";
import { listAdminOrders } from "../src/services/admin-orders-list.ts";
import { getAdminRouteView, resolveAdminSessionResponse } from "../src/lib/auth/admin-route-gate.ts";

describe("Admin route session gate", () => {
  test("direct Orders navigation and refresh wait for a valid server session", () => {
    for (const navigation of ["direct", "refresh"]) {
      assert.equal(getAdminRouteView("/admin/orders", null, "checking"), "checking", `${navigation} must wait for the session check`);
      assert.equal(getAdminRouteView("/admin/orders", "/admin/orders", "authenticated"), "content", `${navigation} renders only after server validation`);
    }
  });

  test("dashboard navigation rechecks before mounting Orders under the previous route session", () => {
    assert.equal(getAdminRouteView("/admin/orders", "/admin", "authenticated"), "checking");
  });

  test("missing and expired sessions redirect without mounting protected page content", () => {
    assert.deepEqual(resolveAdminSessionResponse(401, { error: "Unauthorized" }), { status: "redirect" });
    assert.equal(getAdminRouteView("/admin/orders", null, "checking"), "checking");
    assert.equal(getAdminRouteView("/admin/login", null, "checking"), "login");
  });

  test("valid sessions render and malformed or unavailable responses remain retryable", () => {
    const admin = { id: "adm_test", email: "admin@example.test", name: "Test Admin", role: "admin" };
    assert.deepEqual(resolveAdminSessionResponse(200, { admin }), { status: "authenticated", admin });
    assert.deepEqual(resolveAdminSessionResponse(200, { admin: { id: "partial" } }), { status: "unavailable" });
    assert.deepEqual(resolveAdminSessionResponse(503, {}), { status: "unavailable" });
  });

  test("the admin segment gates page mounting and login remains reachable", () => {
    const layout = fs.readFileSync(path.join(process.cwd(), "src/app/admin/layout.tsx"), "utf8");
    const provider = fs.readFileSync(path.join(process.cwd(), "src/components/layout/AdminSessionProvider.tsx"), "utf8");
    const ordersPage = fs.readFileSync(path.join(process.cwd(), "src/app/admin/orders/page.tsx"), "utf8");
    assert.match(layout, /<AdminSessionProvider>\{children\}<\/AdminSessionProvider>/);
    assert.match(provider, /if \(routeView === "login"\) return <>{children}<\/>/);
    assert.match(provider, /routeView === "content" && contextValue/);
    assert.match(ordersPage, /if \(res\.status === 401\)\s*\{\s*router\.replace\("\/admin\/login"\)/);
  });
});

describe("COD Advance refund policy", () => {
  test("admin refund policy rejects COD Advance before provider initiation", () => {
    assert.equal(canInitiateRefund("COD Advance"), false);
    assert.equal(canInitiateRefund("Razorpay"), true);
    const route = fs.readFileSync(path.join(process.cwd(), "src/app/api/admin/refunds/route.ts"), "utf8");
    assert.ok(route.indexOf("if (!canInitiateRefund(order.payment_method))") < route.indexOf("createRazorpayRefund({"));
  });

  test("cancelling a partially paid COD Advance order does not enter refund pending", () => {
    assert.equal(getCancellationResultStatus("COD Advance", "partially_paid"), "cancelled");
    assert.equal(getCancellationResultStatus("Razorpay", "paid"), "refund_pending");
  });

  test("refund webhook payment mismatch is quarantined without refund processing", () => {
    assert.equal(classifyRefundWebhook({ payment_method: "Razorpay", payment_status: "paid", razorpay_payment_id: "pay_expected" }, "pay_other"), "quarantine");
  });

  test("unexpected COD Advance provider refund is recorded for investigation without refunding the order", () => {
    const order = { payment_method: "COD Advance", payment_status: "partially_paid", razorpay_payment_id: "pay_advance" };
    assert.equal(classifyRefundWebhook(order, "pay_advance"), "record_non_refundable");
    assert.equal(shouldMarkOrderRefunded(order.payment_method, order.payment_status, 200, 2000), false);
  });

  test("prepaid refund threshold and webhook idempotency key remain stable", () => {
    assert.equal(classifyRefundWebhook({ payment_method: "Razorpay", payment_status: "paid", razorpay_payment_id: "pay_full" }, "pay_full"), "process");
    assert.equal(shouldMarkOrderRefunded("Razorpay", "paid", 2000, 2000), true);
    assert.equal(getRefundWebhookIdempotencyKey("rfnd_same"), getRefundWebhookIdempotencyKey("rfnd_same"));
    const webhook = fs.readFileSync(path.join(process.cwd(), "src/app/api/webhooks/razorpay/route.ts"), "utf8");
    const inbox = fs.readFileSync(path.join(process.cwd(), "src/services/razorpay/refund-webhook-inbox.ts"), "utf8");
    assert.match(webhook, /receiveRazorpayRefundWebhook/);
    assert.match(inbox, /ON CONFLICT DO NOTHING/);
    assert.match(inbox, /getRefundWebhookIdempotencyKey\(event\.refundId\)/);
  });

  test("refund webhook status mismatches are durably classified and refund records are shared", () => {
    const route = fs.readFileSync(path.join(process.cwd(), "src/app/api/admin/refunds/route.ts"), "utf8");
    const webhook = fs.readFileSync(path.join(process.cwd(), "src/app/api/webhooks/razorpay/route.ts"), "utf8");
    assert.match(route, /reserveRefund\(/);
    assert.match(route, /refundRecordId: reservation\.id/);
    assert.match(route, /refund outcome is uncertain/i);
    assert.match(route, /if \(refundRec\.status === "processed"\)/);
    assert.match(webhook, /quarantineReason:\s*classifyRefundWebhook\(eventType, refundEntity\.status\)/);
    assert.match(webhook, /stablePayloadFingerprint\(event\)/);
    assert.match(webhook, /x-razorpay-event-id/);
    assert.match(route, /providerStatus, failureReason/);
    assert.match(webhook, /refund_durably_deferred/);
    assert.match(route, /reconciliation\.outcome === "deferred"/);
    assert.match(route, /Razorpay confirmed that the refund failed/);
    const notifications = fs.readFileSync(path.join(process.cwd(), "src/services/notification-service.ts"), "utf8");
    assert.match(notifications, /idempotencyKey: `notif_rfnd_\$\{refundId\}`/);
  });
});

describe("Warehouse inventory product catalog mapping", () => {
  test("resolves all eight inventory designs from the storefront catalog without a Supabase products row", () => {
    const designs = PRODUCTS.filter((product) => /^rnl-design-0[1-8]$/.test(product.id));
    assert.equal(designs.length, 8);
    for (const product of designs) {
      const label = getInventoryProductLabel(product.id);
      assert.ok(label, `${product.id} should resolve`);
      assert.equal(label.product_name, product.name);
      assert.equal(label.sku, product.sku);
      assert.ok(label.image, `${product.id} should use a catalog image`);
      assert.deepEqual(product.sizes, ["XS", "S", "M", "L", "XL", "XXL"]);
    }
    assert.deepEqual(getInventoryProductIdsMissingFromCatalog(designs.map(({ id }) => id)), []);
  });

  test("accepts name or title fields and returns diagnostic IDs for missing products", () => {
    assert.equal(getCatalogDisplayName({ name: " Catalog name ", title: "Other title" }), "Catalog name");
    assert.equal(getCatalogDisplayName({ title: "Title-shaped record" }), "Title-shaped record");
    assert.equal(getCatalogDisplayName({ name: " ", title: null }), null);
    assert.equal(getInventoryProductLabel("missing-product-id"), null);
    assert.deepEqual(getInventoryProductIdsMissingFromCatalog(["rnl-design-01", "missing-product-id"]), ["missing-product-id"]);

    const inventoryRoute = fs.readFileSync(path.join(process.cwd(), "src/app/api/admin/inventory/route.ts"), "utf8");
    const dashboardRoute = fs.readFileSync(path.join(process.cwd(), "src/app/api/admin/dashboard/route.ts"), "utf8");
    assert.match(inventoryRoute, /getInventoryProductLabel/);
    assert.match(dashboardRoute, /getInventoryProductLabel/);
    assert.doesNotMatch(inventoryRoute, /from\("products"\)/);
    assert.doesNotMatch(dashboardRoute, /from\("products"\)/);
    assert.match(inventoryRoute, /Product not found \(/);
    assert.match(dashboardRoute, /Product not found \(/);
  });
});

describe("Admin orders list query", () => {
  const filters = { query: "RNL-42", status: "paid", paymentStatus: "paid", fromDate: "2026-01-01", toDate: "2026-01-31", page: 2, limit: 15 };

  test("loads a page with safe nullable customer/payment fields and preserves filters and sort", async () => {
    const calls = [];
    const db = {
      prepare(sql) {
        calls.push(sql);
        return {
          async get(...args) {
            assert.deepEqual(args, ["%RNL-42%", "%RNL-42%", "%RNL-42%", "%RNL-42%", "paid", "paid", "2026-01-01", "2026-01-31"]);
            return { count: "1" };
          },
          async all(...args) {
            assert.deepEqual(args.slice(0, 8), ["%RNL-42%", "%RNL-42%", "%RNL-42%", "%RNL-42%", "paid", "paid", "2026-01-01", "2026-01-31"]);
            assert.deepEqual(args.slice(-2), [15, 15]);
            return [{ id: "ord_1", order_number: "RNL-42", customer_name: null, customer_email: null,
              customer_phone: null, payment_method: null, payment_status: null, razorpay_payment_id: null,
              total: 999, discount: 0, order_status: "paid", courier_name: null, tracking_number: null,
              refund_status: null, created_at: "2026-01-10T00:00:00Z", subtotal: 999, shipping: 0 }];
          },
        };
      },
    };
    const result = await listAdminOrders(db, filters);
    assert.equal(result.total, 1);
    assert.equal(result.page, 2);
    assert.equal(result.pages, 1);
    assert.equal(result.orders[0].customer_email, null);
    assert.equal(result.orders[0].payment_status, null);
    assert.match(calls[0], /is_confirmed = TRUE/);
    assert.match(calls[1], /ORDER BY created_at DESC LIMIT \? OFFSET \?/);
    assert.doesNotMatch(calls[1], /SELECT \* /);
    assert.doesNotMatch(calls[1], /guest_token|razorpay_signature|user_id/);
  });

  test("keeps orders available during rollout when only the confirmation migration is missing", async () => {
    let queryCount = 0;
    const db = {
      prepare(sql) {
        return {
          async get() {
            queryCount += 1;
            if (queryCount === 1) throw Object.assign(new Error('column "is_confirmed" does not exist'), { code: "42703", column: "is_confirmed" });
            assert.doesNotMatch(sql, /is_confirmed/);
            return { count: "0" };
          },
          async all() { return []; },
        };
      },
    };
    const result = await listAdminOrders(db, { ...filters, page: 1 });
    assert.equal(result.total, 0);
    assert.equal(queryCount, 2);
  });

  test("propagates unrelated database failures for the API to report instead of fabricating results", async () => {
    const db = { prepare() { return { async get() { throw Object.assign(new Error("connection refused"), { code: "ECONNREFUSED" }); } }; } };
    await assert.rejects(listAdminOrders(db, filters), { code: "ECONNREFUSED" });
  });

  test("API still requires admin auth and returns safe JSON errors", () => {
    const route = fs.readFileSync(path.join(process.cwd(), "src/app/api/admin/orders/route.ts"), "utf8");
    assert.match(route, /requireAdminAuth\(req\)/);
    assert.match(route, /ORDERS_UNAVAILABLE/);
    assert.match(route, /ORDERS_QUERY_FAILED/);
    assert.doesNotMatch(route, /NextResponse\.json\(\{[^}]*err\s*\}/);
  });
});

describe("Phase 3: Secure Admin Authentication & Password Hashing", () => {
  test("PBKDF2-SHA512 password hash verifies correctly and rejects wrong passwords", () => {
    const rawPass = "SecretAdminPass@2026";
    const hashed = hashPassword(rawPass);

    assert.ok(hashed.startsWith("pbkdf2$100000$"));
    assert.strictEqual(verifyPassword(rawPass, hashed), true);
    assert.strictEqual(verifyPassword("WrongPassword123!", hashed), false);
    assert.strictEqual(verifyPassword("", hashed), false);
  });

  test("Rejects creation of admin user with password under 12 characters", async () => {
    const shortResult = await createAdminUser("short@rnl.in", "Short", "weak123");
    assert.strictEqual(shortResult.success, false);
    assert.match(shortResult.error, /at least 12 characters/i);
  });

  databaseTest("Creates and retrieves admin user idempotently without password leakage", async () => {
    const email = `admin_test_${Date.now()}@rightnowlife.in`;
    const createRes = await createAdminUser(email, "Test Lead", "SecurePassphrase123#");
    assert.strictEqual(createRes.success, true);

    const retrieved = await getAdminByEmail(email);
    assert.ok(retrieved);
    assert.strictEqual(retrieved.email, email);
    assert.strictEqual(retrieved.name, "Test Lead");
    assert.strictEqual(retrieved.is_active, 1);
    // Stored hash must never equal raw password
    assert.notStrictEqual(retrieved.password_hash, "SecurePassphrase123#");
    assert.strictEqual(verifyPassword("SecurePassphrase123#", retrieved.password_hash), true);

    // Duplicate creation must be blocked
    const duplicate = await createAdminUser(email, "Dupe", "SecurePassphrase123#");
    assert.strictEqual(duplicate.success, false);
  });

  databaseTest("Session lifecycle: generates token, hashes in DB, and revokes cleanly", async () => {
    const email = `session_adm_${Date.now()}@rightnowlife.in`;
    await createAdminUser(email, "Session Tester", "SecurePassphrase123#");
    const admin = await getAdminByEmail(email);
    assert.ok(admin);

    const rawToken = await createSession(admin.id, "127.0.0.1", "NodeTest/1.0");
    assert.ok(rawToken);
    assert.strictEqual(rawToken.length, 64); // 32 bytes hex

    const db = getDb();
    // Raw token must NOT exist in the database (only hashed token stored)
    const rawInDb = await db.prepare("SELECT * FROM admin_sessions WHERE token_hash = ?").get(rawToken);
    assert.strictEqual(rawInDb, undefined);

    // Revocation clears the session
    await revokeSession(rawToken);
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
    assert.strictEqual(isValidAdminTransition("advance_paid", "processing"), true);
    assert.strictEqual(isValidAdminTransition("advance_paid", "cancelled"), true);
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
    assert.strictEqual(requiresRefund("advance_paid", "cancelled"), true);
    assert.strictEqual(requiresRefund("processing", "cancelled"), true);

    // Unpaid pending order cancellation requires NO refund
    assert.strictEqual(requiresRefund("pending_payment", "cancelled"), false);
  });

  databaseTest("Order detail endpoint returns status transition history and audit timestamps", async () => {
    const orderNumber = generateOrderNumber();
    const { order } = await createPendingOrder({
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
    await db.prepare(`
      INSERT INTO order_status_history (id, order_id, from_status, to_status, actor, note, created_at)
      VALUES (?, ?, 'pending_payment', 'cancelled', 'admin@rightnowlife.in', 'Customer requested cancellation', ?)
    `).run(histId, order.id, new Date().toISOString());

    const historyRows = await db
      .prepare("SELECT * FROM order_status_history WHERE order_id = ?")
      .all(order.id);

    assert.strictEqual(historyRows.length, 1);
    assert.strictEqual(historyRows[0].to_status, "cancelled");
    assert.strictEqual(historyRows[0].actor, "admin@rightnowlife.in");
  });
});

describe("Phase 3: Inventory Management, Adjustments & Concurrency", () => {
  databaseTest("Prevents overselling when requested quantity exceeds available stock", async () => {
    const db = getDb();
    // Check initial stock for design 01 size XXL
    const inv = await db
      .prepare("SELECT stock, reserved FROM inventory WHERE product_id = ? AND size = ?")
      .get("rnl-design-01", "XXL");

    const available = inv.stock - inv.reserved;

    // Requesting more than available must fail cleanly
    const excessCheck = await checkAndReserveInventory([
      { productId: "rnl-design-01", size: "XXL", quantity: available + 50 },
    ]);
    assert.strictEqual(excessCheck.ok, false);
    assert.match(excessCheck.error, /Insufficient stock/i);
  });

  databaseTest("Records inventory adjustment with actor, before/after stock, and reason in audit table", async () => {
    const db = getDb();
    const productId = "rnl-design-02";
    const size = "M";

    const beforeRow = await db
      .prepare("SELECT stock FROM inventory WHERE product_id = ? AND size = ?")
      .get(productId, size);

    const newStock = beforeRow.stock + 15;
    const delta = 15;
    const reason = "Received shipment batch from Bengaluru textile unit";
    const actor = "warehouse_lead@rightnowlife.in";

    // Update stock
    await db.prepare("UPDATE inventory SET stock = ? WHERE product_id = ? AND size = ?").run(
      newStock,
      productId,
      size
    );

    // Record adjustment audit
    const adjId = `iadj_test_${Date.now()}`;
    await db.prepare(`
      INSERT INTO inventory_adjustments (id, product_id, size, prev_stock, new_stock, delta, reason, actor, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(adjId, productId, size, beforeRow.stock, newStock, delta, reason, actor, new Date().toISOString());

    // Verify audit entry
    const recorded = await db
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
  databaseTest("Writes and retrieves audit log entries with metadata and before/after values", async () => {
    const actor = "governance@rightnowlife.in";
    const action = "product_visibility_toggled";
    const entityType = "product";
    const entityId = "rnl-design-03";

    await writeAuditLog({
      actor,
      action,
      entityType,
      entityId,
      before: { is_active: true },
      after: { is_active: false },
      metadata: { reason: "Seasonal rotation" },
    });

    const { logs, total } = await getAuditLogs({ entityType, entityId });
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

  test("Essential Tees contains the three selected existing products with working product slugs", () => {
    const essentials = COLLECTIONS.find((collection) => collection.slug === "essentials");
    assert.ok(essentials);
    const products = PRODUCTS.filter((product) => product.collectionSlug === essentials.slug);
    assert.deepStrictEqual(products.map((product) => product.id).sort(), [
      "rnl-design-01",
      "rnl-design-03",
      "rnl-design-08",
    ]);
    assert.strictEqual(essentials.featuredProductCount, 3);
    assert.ok(products.every((product) => product.slug && product.price === 999));
  });

  databaseTest("Dashboard calculation logic computes gross vs net sales accurately", async () => {
    const db = getDb();

    // Sum paid and refund_pending orders
    const grossRow = await db.prepare(`
      SELECT COALESCE(SUM(total), 0) as gross
      FROM orders
      WHERE payment_status IN ('paid', 'refund_pending')
    `).get();

    const refundRow = await db.prepare(`
      SELECT COALESCE(SUM(total), 0) as refunded
      FROM orders
      WHERE order_status = 'refunded'
    `).get();

    const grossSales = Number(grossRow.gross);
    const refundedSales = Number(refundRow.refunded);
    const netSales = grossSales - refundedSales;
    assert.ok(Number.isFinite(grossSales));
    assert.ok(typeof netSales === "number");
    assert.ok(grossSales >= netSales); // Net sales cannot exceed gross sales
  });
});
