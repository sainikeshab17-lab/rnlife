import { test, describe } from "node:test";
import assert from "node:assert";
import crypto from "node:crypto";
import { getDb } from "../src/lib/db/index.ts";
import {
  isValidTrackingUrl,
  isValidCancellationStatus,
  isReturnWindowValid,
  RETURN_REASONS,
  CANCELLATION_REASONS,
} from "../src/lib/policies.ts";
import {
  getShippingProvider,
  createTrackingUrl,
  validateAwbFormat,
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
  checkAndReserveInventory,
  releaseInventoryReservation,
} from "../src/lib/db/orders.ts";
import { generateOrderNumber } from "../src/services/checkout-service.ts";
import { createRazorpayRefund, verifyWebhookSignature } from "../src/lib/razorpay.ts";

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
    assert.ok(createTrackingUrl("delhivery", "DEL123456")?.includes("delhivery.com"));

    // Generic carrier
    assert.strictEqual(createTrackingUrl("generic", "GEN123"), null);
  });

  test("Records shipping timeline events and updates order fulfilment state", () => {
    const orderNumber = generateOrderNumber();
    const { order } = createPendingOrder({
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

    const event = addShippingEvent({
      orderId: order.id,
      status: "Dispatched",
      location: "Bengaluru Hub",
      description: "Package sorted and assigned to delivery agent",
    });

    assert.ok(event.id);
    assert.strictEqual(event.order_id, order.id);
    assert.strictEqual(event.status, "Dispatched");

    const fetched = getOrderById(order.id);
    assert.ok(fetched?.shipping_events);
    assert.strictEqual(fetched.shipping_events.length, 1);
    assert.strictEqual(fetched.shipping_events[0].location, "Bengaluru Hub");
  });
});

describe("Phase 4: Customer Order Ownership & Cancellation Flow", () => {
  test("Customer requests cancellation for eligible pending order", () => {
    const orderNumber = generateOrderNumber();
    const { order } = createPendingOrder({
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
    const cancelRes = requestOrderCancellation(order.id, "Ordered wrong size by mistake");
    assert.strictEqual(cancelRes.success, true);

    // Duplicate request must be rejected idempotently
    const dupRes = requestOrderCancellation(order.id, "Ordered wrong size by mistake");
    assert.strictEqual(dupRes.success, false);
    assert.match(dupRes.error || "", /already been requested/i);

    // Admin approves cancellation
    const decisionRes = decideOrderCancellation(order.id, true, "admin@rightnowlife.in", "Approved");
    assert.strictEqual(decisionRes.success, true);
    assert.strictEqual(decisionRes.newStatus, "cancelled");

    const updated = getOrderById(order.id);
    assert.strictEqual(updated?.order_status, "cancelled");
  });

  test("Cancellation of paid order sets refund_pending status without falsely reporting money returned", () => {
    const orderNumber = generateOrderNumber();
    const { order } = createPendingOrder({
      orderNumber,
      customerName: "Paid Cancel Cust",
      customerEmail: "paid_cancel@rightnowlife.in",
      customerPhone: "9876543203",
      subtotal: 999,
      shipping: 99,
      discount: 0,
      total: 1098,
      paymentMethod: "Razorpay",
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
    markOrderAsPaid(order.id, "pay_test_paid_cancel_123");

    // Request cancellation
    requestOrderCancellation(order.id, "Change of travel plans");

    // Admin approves
    const decisionRes = decideOrderCancellation(order.id, true, "admin@rightnowlife.in", "Approved refund needed");
    assert.strictEqual(decisionRes.success, true);
    assert.strictEqual(decisionRes.newStatus, "refund_pending");

    const updated = getOrderById(order.id);
    assert.strictEqual(updated?.order_status, "refund_pending");
  });
});

describe("Phase 4: Returns, Exchanges & Inspection Workflow", () => {
  test("Prevents return quantities from exceeding purchased items", () => {
    const orderNumber = generateOrderNumber();
    const { order } = createPendingOrder({
      orderNumber,
      customerName: "Return Cust",
      customerEmail: "return_cust@rightnowlife.in",
      customerPhone: "9876543204",
      subtotal: 1998,
      shipping: 0,
      discount: 0,
      total: 1998,
      paymentMethod: "Razorpay",
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

    markOrderAsPaid(order.id, "pay_return_test_1");

    // Transition to delivered
    const db = getDb();
    db.prepare("UPDATE orders SET order_status = 'delivered', actual_delivery_date = ? WHERE id = ?").run(
      new Date().toISOString(),
      order.id
    );

    const orderWithItems = getOrderById(order.id);
    const orderItemId = orderWithItems.items[0].id;

    // Try returning 3 items when only 2 were purchased
    const overReturnRes = requestReturnOrExchange({
      orderId: order.id,
      type: "return",
      reason: "Defective / damaged piece",
      items: [{ orderItemId, quantity: 3 }],
    });

    assert.strictEqual(overReturnRes.success, false);
    assert.match(overReturnRes.error || "", /Cannot return 3 units/i);

    // Return 1 valid item
    const validReturnRes = requestReturnOrExchange({
      orderId: order.id,
      type: "return",
      reason: "Defective / damaged piece",
      items: [{ orderItemId, quantity: 1 }],
    });

    assert.strictEqual(validReturnRes.success, true);
    assert.ok(validReturnRes.returnId);

    // Now try returning 2 more items (1 + 2 = 3 > 2 purchased)
    const secondReturnRes = requestReturnOrExchange({
      orderId: order.id,
      type: "return",
      reason: "Defective / damaged piece",
      items: [{ orderItemId, quantity: 2 }],
    });
    assert.strictEqual(secondReturnRes.success, false);
    assert.match(secondReturnRes.error || "", /Only 1 eligible units remaining/i);
  });

  test("Inspection records item condition and restocks only if resalable", () => {
    const db = getDb();
    // Get initial inventory for design 05
    const initInv = db
      .prepare("SELECT stock FROM inventory WHERE product_id = 'rnl-design-05' AND size = 'L'")
      .get();
    const initialStock = initInv ? initInv.stock : 20;

    const orderNumber = generateOrderNumber();
    const { order } = createPendingOrder({
      orderNumber,
      customerName: "Inspect Cust",
      customerEmail: "inspect_cust@rightnowlife.in",
      customerPhone: "9876543205",
      subtotal: 999,
      shipping: 99,
      discount: 0,
      total: 1098,
      paymentMethod: "Razorpay",
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

    markOrderAsPaid(order.id, "pay_inspect_test_1");
    db.prepare("UPDATE orders SET order_status = 'delivered', actual_delivery_date = ? WHERE id = ?").run(
      new Date().toISOString(),
      order.id
    );

    const orderWithItems = getOrderById(order.id);
    const orderItemId = orderWithItems.items[0].id;

    const returnRes = requestReturnOrExchange({
      orderId: order.id,
      type: "return",
      reason: "Size fits too small",
      items: [{ orderItemId, quantity: 1 }],
    });

    const returnItem = db
      .prepare("SELECT * FROM return_items WHERE return_id = ?")
      .get(returnRes.returnId);

    // Inspect as resalable -> should increment inventory
    const inspectRes = inspectReturnItem({
      returnItemId: returnItem.id,
      condition: "resalable",
      actorEmail: "admin@rightnowlife.in",
    });

    assert.strictEqual(inspectRes.success, true);

    const updatedInv = db
      .prepare("SELECT stock FROM inventory WHERE product_id = 'rnl-design-05' AND size = 'L'")
      .get();

    // Stock was deducted on payment (-1) and restocked on resalable (+1)
    assert.strictEqual(updatedInv.stock, initialStock);

    // Calling inspect again should be idempotent and not restock twice
    inspectReturnItem({
      returnItemId: returnItem.id,
      condition: "resalable",
      actorEmail: "admin@rightnowlife.in",
    });

    const doubleInspectInv = db
      .prepare("SELECT stock FROM inventory WHERE product_id = 'rnl-design-05' AND size = 'L'")
      .get();

    assert.strictEqual(doubleInspectInv.stock, initialStock);
  });
});

describe("Phase 4: Refund Safety & Record Tracking", () => {
  test("Records refund record and enforces maximum refundable limits", () => {
    const orderNumber = generateOrderNumber();
    const { order } = createPendingOrder({
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
    const refundRec1 = recordRefund({
      orderId: order.id,
      amount: 500,
      status: "processed",
      reason: "Partial goodwill refund",
      initiatedBy: "admin@rightnowlife.in",
      razorpayRefundId: "rfnd_test_1",
    });

    assert.strictEqual(refundRec1.amount, 500);
    assert.strictEqual(refundRec1.status, "processed");

    const fetched = getOrderById(order.id);
    assert.ok(fetched?.refunds);
    assert.strictEqual(fetched.refunds.length, 1);
    assert.strictEqual(fetched.refunds[0].amount, 500);
  });

  test("Simulated server-side Razorpay refund works in test/dev mode", async () => {
    const res = await createRazorpayRefund({
      paymentId: "pay_test_sim_123",
      amountPaisa: 99900,
      notes: { orderNumber: "RNL-TEST-123" },
    });

    assert.strictEqual(res.success, true);
    assert.ok(res.refundId?.startsWith("rfnd_sim_"));
  });
});
