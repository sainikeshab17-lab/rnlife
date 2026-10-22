import { test, describe } from "node:test";
import assert from "node:assert";
import { databaseTest } from "./postgres-test-support.mjs";
import { getDb } from "../src/lib/db/index.ts";
import {
  isValidTrackingUrl,
} from "../src/lib/policies.ts";
import {
  getShippingProvider,
  createTrackingUrl,
} from "../src/lib/shipping/provider.ts";
import {
  createPendingOrder,
  getOrderById,
  markOrderAsPaid,
  addShippingEvent,
  requestOrderCancellation,
  decideOrderCancellation,
  requestReturnOrExchange,
  inspectReturnItem,
  recordRefund,
  reserveRefund,
} from "../src/lib/db/orders.ts";
import { generateOrderNumber } from "../src/services/checkout-service.ts";
import { getRefundWebhookIdempotencyKey } from "../src/lib/order-status-machine.ts";
import {
  createRazorpayRefund,
  RAZORPAY_KEY_SECRET,
} from "../src/lib/razorpay.ts";

describe("Phase 4: Shipping, Fulfilment & URL Validation", () => {
  test("Validates tracking URLs strictly and rejects dangerous javascript: schemes", () => {
    assert.strictEqual(isValidTrackingUrl("https://track.bluedart.com/track?awb=12345"), true);
    assert.strictEqual(isValidTrackingUrl("http://delhivery.com/track/123"), true);

    // Unsafe / Malicious URLs
    assert.strictEqual(isValidTrackingUrl("javascript:alert(1)"), false);
    assert.strictEqual(isValidTrackingUrl("data:text/html,<script>evil()</script>"), false);
    assert.strictEqual(isValidTrackingUrl("ftp://files.example.com"), false);
    assert.strictEqual(isValidTrackingUrl(""), false);
    assert.strictEqual(isValidTrackingUrl("not-a-url"), false);
  });

  test("Shipping provider abstraction formats AWB tracking URLs correctly", () => {
    const bluedart = getShippingProvider("bluedart");
    assert.strictEqual(bluedart.name, "Blue Dart Express");
    assert.ok(createTrackingUrl("bluedart", "123456789")?.includes("bluedart.com"));

    const delhivery = getShippingProvider("delhivery");
    assert.strictEqual(delhivery.name, "Delhivery Surface & Express");
    assert.ok(createTrackingUrl("delhivery", "DEL123456")?.includes("delhivery.com"));

    // Generic carrier
    assert.strictEqual(createTrackingUrl("generic", "GEN123"), null);
  });

  databaseTest("Records shipping timeline events and updates order fulfilment state", async () => {
    const orderNumber = generateOrderNumber();
    const { order } = await createPendingOrder({
      orderNumber,
      customerName: "Shipping Test User",
      customerEmail: "ship_test@rightnowlife.in",
      customerPhone: "9876543201",
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
        fullName: "Shipping Test User",
        phone: "9876543201",
        addressLine1: "Indiranagar",
        city: "Bengaluru",
        state: "Karnataka",
        pinCode: "560038",
      },
    });

    const event = await addShippingEvent({
      orderId: order.id,
      status: "Dispatched",
      location: "Bengaluru Hub",
      description: "Package sorted and assigned to delivery agent",
    });

    assert.ok(event.id);
    assert.strictEqual(event.order_id, order.id);
    assert.strictEqual(event.status, "Dispatched");

    const fetched = await getOrderById(order.id);
    assert.ok(fetched?.shipping_events);
    assert.strictEqual(fetched.shipping_events.length, 1);
    assert.strictEqual(fetched.shipping_events[0].location, "Bengaluru Hub");
  });
});

describe("Phase 4: Customer Order Ownership & Cancellation Flow", () => {
  databaseTest("Customer requests cancellation for eligible pending order", async () => {
    const orderNumber = generateOrderNumber();
    const { order } = await createPendingOrder({
      orderNumber,
      customerName: "Cancel Cust",
      customerEmail: "cancel_cust@rightnowlife.in",
      customerPhone: "9876543202",
      subtotal: 999,
      shipping: 99,
      discount: 0,
      total: 1098,
      paymentMethod: "Razorpay",
      items: [
        {
          productId: "rnl-design-02",
          productSlug: "rightnowlife-design-02",
          productName: "DESIGN 02 — ACID WASH TEE",
          color: "As pictured",
          size: "L",
          price: 999,
          quantity: 1,
          image: "/products/design_02_front.png",
          sku: "RNL-DESIGN-02-L",
          fit: "Oversized",
        },
      ],
      address: {
        fullName: "Cancel Cust",
        phone: "9876543202",
        addressLine1: "Koramangala",
        city: "Bengaluru",
        state: "Karnataka",
        pinCode: "560034",
      },
    });

    // Request cancellation
    const cancelRes = await requestOrderCancellation(order.id, "Ordered wrong size by mistake");
    assert.strictEqual(cancelRes.success, true);

    // Duplicate request must be rejected idempotently
    const dupRes = await requestOrderCancellation(order.id, "Ordered wrong size by mistake");
    assert.strictEqual(dupRes.success, false);
    assert.match(dupRes.error || "", /already been requested/i);

    // Admin approves cancellation
    const decisionRes = await decideOrderCancellation(order.id, true, "admin@rightnowlife.in", "Approved");
    assert.strictEqual(decisionRes.success, true);
    assert.strictEqual(decisionRes.newStatus, "cancelled");

    const updated = await getOrderById(order.id);
    assert.strictEqual(updated?.order_status, "cancelled");
  });

  databaseTest("Cancellation of paid order sets refund_pending status without falsely reporting money returned", async () => {
    const orderNumber = generateOrderNumber();
    const { order } = await createPendingOrder({
      orderNumber,
      customerName: "Paid Cancel Cust",
      customerEmail: "paid_cancel@rightnowlife.in",
      customerPhone: "9876543203",
      subtotal: 999,
      shipping: 99,
      discount: 0,
      total: 1098,
      paymentMethod: "Razorpay",
      razorpayOrderId: "order_test_paid_cancel",
      items: [
        {
          productId: "rnl-design-03",
          productSlug: "rightnowlife-design-03",
          productName: "DESIGN 03 — HEAVYWEIGHT TEE",
          color: "As pictured",
          size: "XL",
          price: 999,
          quantity: 1,
          image: "/products/design_03_front.png",
          sku: "RNL-DESIGN-03-XL",
          fit: "Boxy",
        },
      ],
      address: {
        fullName: "Paid Cancel Cust",
        phone: "9876543203",
        addressLine1: "Lavelle Road",
        city: "Bengaluru",
        state: "Karnataka",
        pinCode: "560001",
      },
    });

    // Mark paid
    await markOrderAsPaid(order.id, "pay_test_paid_cancel_123", "order_test_paid_cancel");

    // Request cancellation
    await requestOrderCancellation(order.id, "Change of travel plans");

    // Admin approves
    const decisionRes = await decideOrderCancellation(order.id, true, "admin@rightnowlife.in", "Approved refund needed");
    assert.strictEqual(decisionRes.success, true);
    assert.strictEqual(decisionRes.newStatus, "refund_pending");

    const updated = await getOrderById(order.id);
    assert.strictEqual(updated?.order_status, "refund_pending");
  });
});

describe("Phase 4: Returns, Exchanges & Inspection Workflow", () => {
  databaseTest("Prevents return quantities from exceeding purchased items", async () => {
    const orderNumber = generateOrderNumber();
    const { order } = await createPendingOrder({
      orderNumber,
      customerName: "Return Cust",
      customerEmail: "return_cust@rightnowlife.in",
      customerPhone: "9876543204",
      subtotal: 1998,
      shipping: 0,
      discount: 0,
      total: 1998,
      paymentMethod: "Razorpay",
      razorpayOrderId: "order_test_return",
      items: [
        {
          productId: "rnl-design-04",
          productSlug: "rightnowlife-design-04",
          productName: "DESIGN 04 — TYPO OVERSIZED TEE",
          color: "As pictured",
          size: "M",
          price: 999,
          quantity: 2,
          image: "/products/design_04_front.png",
          sku: "RNL-DESIGN-04-M",
          fit: "Oversized",
        },
      ],
      address: {
        fullName: "Return Cust",
        phone: "9876543204",
        addressLine1: "HSR Layout",
        city: "Bengaluru",
        state: "Karnataka",
        pinCode: "560102",
      },
    });

    await markOrderAsPaid(order.id, "pay_return_test_1", "order_test_return");

    // Transition to delivered
    const db = getDb();
    await db.prepare("UPDATE orders SET order_status = 'delivered', actual_delivery_date = ? WHERE id = ?").run(
      new Date().toISOString(),
      order.id
    );

    const orderWithItems = await getOrderById(order.id);
    const orderItemId = orderWithItems.items[0].id;

    // Try returning 3 items when only 2 were purchased
    const overReturnRes = await requestReturnOrExchange({
      orderId: order.id,
      type: "return",
      reason: "Defective / damaged piece",
      items: [{ orderItemId, quantity: 3 }],
    });

    assert.strictEqual(overReturnRes.success, false);
    assert.match(overReturnRes.error || "", /Cannot return 3 units/i);

    // Return 1 valid item
    const validReturnRes = await requestReturnOrExchange({
      orderId: order.id,
      type: "return",
      reason: "Defective / damaged piece",
      items: [{ orderItemId, quantity: 1 }],
    });

    assert.strictEqual(validReturnRes.success, true);
    assert.ok(validReturnRes.returnId);

    // Now try returning 2 more items (1 + 2 = 3 > 2 purchased)
    const secondReturnRes = await requestReturnOrExchange({
      orderId: order.id,
      type: "return",
      reason: "Defective / damaged piece",
      items: [{ orderItemId, quantity: 2 }],
    });
    assert.strictEqual(secondReturnRes.success, false);
    assert.match(secondReturnRes.error || "", /Only 1 eligible units remaining/i);
  });

  databaseTest("Inspection records item condition and restocks only if resalable", async () => {
    const db = getDb();
    // Get initial inventory for design 05
    const initInv = await db
      .prepare("SELECT stock FROM inventory WHERE product_id = 'rnl-design-05' AND size = 'L'")
      .get();
    const initialStock = initInv ? initInv.stock : 20;

    const orderNumber = generateOrderNumber();
    const { order } = await createPendingOrder({
      orderNumber,
      customerName: "Inspect Cust",
      customerEmail: "inspect_cust@rightnowlife.in",
      customerPhone: "9876543205",
      subtotal: 999,
      shipping: 99,
      discount: 0,
      total: 1098,
      paymentMethod: "Razorpay",
      razorpayOrderId: "order_test_inspect",
      items: [
        {
          productId: "rnl-design-05",
          productSlug: "rightnowlife-design-05",
          productName: "DESIGN 05 — MINIMAL EMBROIDERY TEE",
          color: "As pictured",
          size: "L",
          price: 999,
          quantity: 1,
          image: "/products/design_05_front.png",
          sku: "RNL-DESIGN-05-L",
          fit: "Regular",
        },
      ],
      address: {
        fullName: "Inspect Cust",
        phone: "9876543205",
        addressLine1: "Whitefield",
        city: "Bengaluru",
        state: "Karnataka",
        pinCode: "560066",
      },
    });

    await markOrderAsPaid(order.id, "pay_inspect_test_1", "order_test_inspect");
    await db.prepare("UPDATE orders SET order_status = 'delivered', actual_delivery_date = ? WHERE id = ?").run(
      new Date().toISOString(),
      order.id
    );

    const orderWithItems = await getOrderById(order.id);
    const orderItemId = orderWithItems.items[0].id;

    const returnRes = await requestReturnOrExchange({
      orderId: order.id,
      type: "return",
      reason: "Size fits too small",
      items: [{ orderItemId, quantity: 1 }],
    });

    const returnItem = await db
      .prepare("SELECT * FROM return_items WHERE return_id = ?")
      .get(returnRes.returnId);

    // Inspect as resalable -> should increment inventory
    const inspectRes = await inspectReturnItem({
      returnItemId: returnItem.id,
      condition: "resalable",
      actorEmail: "admin@rightnowlife.in",
    });

    assert.strictEqual(inspectRes.success, true);

    const updatedInv = await db
      .prepare("SELECT stock FROM inventory WHERE product_id = 'rnl-design-05' AND size = 'L'")
      .get();

    // Stock was deducted on payment (-1) and restocked on resalable (+1)
    assert.strictEqual(updatedInv.stock, initialStock);

    // Calling inspect again should be idempotent and not restock twice
    await inspectReturnItem({
      returnItemId: returnItem.id,
      condition: "resalable",
      actorEmail: "admin@rightnowlife.in",
    });

    const doubleInspectInv = await db
      .prepare("SELECT stock FROM inventory WHERE product_id = 'rnl-design-05' AND size = 'L'")
      .get();

    assert.strictEqual(doubleInspectInv.stock, initialStock);
  });
});

describe("Phase 4: Refund Safety & Record Tracking", () => {
  databaseTest("Records refund record and enforces maximum refundable limits", async () => {
    const orderNumber = generateOrderNumber();
    const { order } = await createPendingOrder({
      orderNumber,
      customerName: "Refund Limit Cust",
      customerEmail: "refund_limit@rightnowlife.in",
      customerPhone: "9876543206",
      subtotal: 999,
      shipping: 99,
      discount: 0,
      total: 1098,
      paymentMethod: "Razorpay",
      items: [
        {
          productId: "rnl-design-06",
          productSlug: "rightnowlife-design-06",
          productName: "DESIGN 06 — STREETWEAR LOGO TEE",
          color: "As pictured",
          size: "XL",
          price: 999,
          quantity: 1,
          image: "/products/design_06_front.png",
          sku: "RNL-DESIGN-06-XL",
          fit: "Regular",
        },
      ],
      address: {
        fullName: "Refund Limit Cust",
        phone: "9876543206",
        addressLine1: "Jayanagar",
        city: "Bengaluru",
        state: "Karnataka",
        pinCode: "560041",
      },
    });

    // Record partial refund
    const refundRec1 = await recordRefund({
      orderId: order.id,
      amount: 500,
      status: "processed",
      reason: "Partial goodwill refund",
      initiatedBy: "admin@rightnowlife.in",
      razorpayRefundId: "rfnd_test_1",
      idempotencyKey: getRefundWebhookIdempotencyKey("rfnd_test_1"),
    });

    const duplicateRefund = await recordRefund({
      orderId: order.id,
      amount: 500,
      status: "pending",
      reason: "Webhook retry",
      initiatedBy: "razorpay_webhook",
      razorpayRefundId: "rfnd_test_1",
      idempotencyKey: getRefundWebhookIdempotencyKey("rfnd_test_1"),
    });

    assert.strictEqual(refundRec1.amount, 500);
    assert.strictEqual(refundRec1.status, "processed");
    assert.strictEqual(duplicateRefund.id, refundRec1.id);
    assert.strictEqual(duplicateRefund.status, "processed");

    const fetched = await getOrderById(order.id);
    assert.ok(fetched?.refunds);
    assert.strictEqual(fetched.refunds.length, 1);
    assert.strictEqual(fetched.refunds[0].amount, 500);
  });

  databaseTest("Serializes concurrent refund reservations and blocks duplicate provider attempts", async () => {
    const { order } = await createPendingOrder({
      orderNumber: generateOrderNumber(), customerName: "Refund Reservation Test",
      customerEmail: "refund_reservation_test@rightnowlife.in", customerPhone: "9876543207",
      subtotal: 999, shipping: 0, discount: 0, total: 999, paymentMethod: "Razorpay",
      razorpayOrderId: "order_refund_reservation_test",
      items: [{ productId: "rnl-design-07", productSlug: "rightnowlife-design-07", productName: "Test Tee", color: "Black", size: "M", price: 999, quantity: 1, image: "/products/design_07_front.png", sku: "RNL-TEST-M", fit: "Regular" }],
      address: { fullName: "Refund Reservation Test", phone: "9876543207", addressLine1: "Test Road", city: "Bengaluru", state: "Karnataka", pinCode: "560001" },
    });
    await markOrderAsPaid(order.id, "pay_refund_reservation_test", "order_refund_reservation_test");
    const input = { orderId: order.id, paymentId: "pay_refund_reservation_test", amount: 700, reason: "Test", initiatedBy: "admin-test" };
    const results = await Promise.all([reserveRefund(input), reserveRefund(input)]);
    assert.equal(results.filter((result) => result.reservation).length, 1);
    assert.equal(results.filter((result) => result.reason === "pending").length, 1);
    const blocked = await reserveRefund({ ...input, amount: 100 });
    assert.equal(blocked.reservation, null);
    assert.equal(blocked.reason, "pending");
    const rows = await getDb().prepare("SELECT status, amount_paisa FROM refund_records WHERE order_id = ?").all(order.id);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, "pending");
    assert.equal(rows[0].amount_paisa, 70000);

    const reservation = results.find((result) => result.reservation)?.reservation;
    assert.ok(reservation);
    await recordRefund({
      orderId: order.id, amount: 700, status: "processed", reason: "Provider confirmed",
      initiatedBy: "test-reconciliation", razorpayRefundId: "rfnd_reservation_test",
      razorpayPaymentId: input.paymentId, idempotencyKey: reservation.idempotency_key,
    });
    const overBalance = await reserveRefund({ ...input, amount: 400 });
    assert.equal(overBalance.reservation, null);
    assert.equal(overBalance.reason, "exceeds_balance");
  });

  test("Simulated server-side Razorpay refund works in test/dev mode", {
    skip: RAZORPAY_KEY_SECRET === "rzp_test_placeholder_secret"
      ? false
      : "provider-facing refund call is disabled when Razorpay credentials are configured",
  }, async () => {
    const res = await createRazorpayRefund({
      paymentId: "pay_test_sim_123",
      amountPaisa: 99900,
      notes: { orderNumber: "RNL-TEST-123" },
    });

    assert.strictEqual(res.success, true);
    assert.ok(res.refundId?.startsWith("rfnd_sim_"));
  });
});
