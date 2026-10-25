import { test, describe } from "node:test";
import assert from "node:assert";
import crypto from "node:crypto";
import { databaseTest } from "./postgres-test-support.mjs";
import {
  calculateTrustedOrderPricing,
  calculateCodAdvanceAmounts,
  CheckoutItemSchema,
  CreateCheckoutOrderSchema,
  createCheckoutRequestHash,
  generateOrderNumber,
} from "../src/services/checkout-service.ts";

describe("Wear Your Mood and COD Advance pricing contracts", () => {
  const customDetails = {
    type: "quote_tshirt", mood: "confident", quote: "I choose my own way", quoteStyle: "deep",
    font: "serif", printColor: "ocean", placement: "center",
  };

  test("custom quote tees use the server price and made-to-order fulfillment", () => {
    const result = calculateTrustedOrderPricing([{ productId: "rnl-custom-quote-tee", size: "M", quantity: 2, customization: customDetails }]);
    assert.equal(result.success, true);
    assert.equal(result.pricing.items[0].price, 1299);
    assert.equal(result.pricing.items[0].fulfillmentType, "made_to_order");
    assert.equal(result.pricing.items[0].customization.quote, customDetails.quote);
    assert.equal(result.pricing.subtotal, 2598);
    assert.equal(result.pricing.items[0].productId, "rnl-custom-quote-tee");
  });

  test("custom price input is rejected and customization is required and bounded", () => {
    assert.equal(CheckoutItemSchema.safeParse({ productId: "rnl-custom-quote-tee", size: "M", quantity: 1, price: 1, customization: customDetails }).success, false);
    assert.equal(calculateTrustedOrderPricing([{ productId: "rnl-custom-quote-tee", size: "M", quantity: 1 }]).success, false);
    assert.equal(CheckoutItemSchema.safeParse({ productId: "rnl-custom-quote-tee", size: "M", quantity: 1, customization: { ...customDetails, quote: "x".repeat(81) } }).success, false);
    assert.equal(CheckoutItemSchema.safeParse({ productId: "rnl-custom-quote-tee", size: "M", quantity: 1, customization: { ...customDetails, font: "comic" } }).success, false);
  });

  test("client shipping charges and grand totals do not affect trusted checkout pricing", () => {
    const request = CreateCheckoutOrderSchema.safeParse({
      customerName: "Test Customer",
      customerEmail: "customer@example.test",
      customerPhone: "9876543210",
      address: {
        fullName: "Test Customer", phone: "9876543210", addressLine1: "12 Test Street",
        city: "Pune", state: "Maharashtra", pinCode: "411001", country: "India",
      },
      items: [{ productId: "rnl-design-01", size: "M", quantity: 1, color: "As pictured" }],
      shipping: 5000,
      total: 1,
      grandTotal: 1,
    });

    assert.equal(request.success, true);
    if (request.success) {
      assert.equal("shipping" in request.data, false);
      assert.equal("total" in request.data, false);
      assert.equal("grandTotal" in request.data, false);
      const calculated = calculateTrustedOrderPricing(request.data.items);
      assert.equal(calculated.success, true);
      if (calculated.success) {
        assert.deepEqual({ subtotal: calculated.pricing.subtotal, shipping: calculated.pricing.shipping,
          discount: calculated.pricing.discount, total: calculated.pricing.total },
        { subtotal: 999, shipping: 0, discount: 0, total: 999 });
        assert.equal(Math.round(calculated.pricing.total * 100), 99_900);
      }
    }
  });

  test("catalog tees remain ₹999 stock items and COD Advance is ₹200 once per order", () => {
    for (let n = 1; n <= 8; n += 1) {
      const id = `rnl-design-${String(n).padStart(2, "0")}`;
      const result = calculateTrustedOrderPricing([{ productId: id, size: "M", quantity: 1, color: "As pictured" }]);
      assert.equal(result.success, true, id);
      assert.equal(result.pricing.items[0].price, 999, id);
      assert.equal(result.pricing.items[0].fulfillmentType, "stock", id);
    }
    assert.deepEqual(calculateCodAdvanceAmounts(1999), { success: true, advance: 200, balanceDue: 1799 });
    assert.deepEqual(calculateCodAdvanceAmounts(999), { success: true, advance: 200, balanceDue: 799 });
    assert.deepEqual(calculateCodAdvanceAmounts(200), { success: false, error: "COD Advance is available only when the final order total is greater than ₹200." });
  });

  test("Wear Your Mood price is ₹1,299 and the old ₹1,999 price is no longer the current selling price", () => {
    const single = calculateTrustedOrderPricing([{
      productId: "rnl-custom-quote-tee", size: "L", quantity: 1,
      customization: { type: "quote_tshirt", mood: "happy", quote: "Good vibes only", quoteStyle: "minimal", font: "bold", printColor: "ink", placement: "center" },
    }]);
    assert.equal(single.success, true);
    assert.equal(single.pricing.items[0].price, 1299, "WYM price must be ₹1,299");
    assert.notEqual(single.pricing.items[0].price, 1999, "WYM price must NOT be ₹1,999");
    assert.equal(single.pricing.subtotal, 1299);
    assert.equal(single.pricing.total, 1299);
    // Two WYM tees: ₹1,299 × 2 = ₹2,598
    const double = calculateTrustedOrderPricing([{
      productId: "rnl-custom-quote-tee", size: "M", quantity: 2,
      customization: { type: "quote_tshirt", mood: "confident", quote: "I own this", quoteStyle: "savage", font: "serif", printColor: "ocean", placement: "chest" },
    }]);
    assert.equal(double.success, true);
    assert.equal(double.pricing.subtotal, 2598);
    assert.equal(double.pricing.total, 2598);
    // Catalog tees are still ₹999 — unaffected
    const catalog = calculateTrustedOrderPricing([{ productId: "rnl-design-01", size: "M", quantity: 1, color: "As pictured" }]);
    assert.equal(catalog.success, true);
    assert.equal(catalog.pricing.items[0].price, 999);
  });
});
import {
  verifyPaymentSignature,
  verifyWebhookSignature,
  isPaymentCaptured,
  isVerifiedCapturedWebhookPayment,
  isVerifiedCapturedPaymentDetails,
  isVerifiedPaymentDetails,
} from "../src/lib/razorpay.ts";
import {
  createPendingOrder,
  checkAndReserveInventory,
  orderInventoryVariants,
  getOrderById,
  scopeCheckoutIdempotencyKey,
  withCheckoutIdempotency,
  markOrderAsPaid,
  recordPaymentAttemptFailure,
  getOrdersByEmail,
  getOrdersByCustomer,
  isOrderOwnedByCustomer,
  createCodAdvanceAttempt,
  claimCodAdvanceOrderCreation,
  attachCodAdvanceRazorpayOrder,
  markCodAdvanceAsVerified,
} from "../src/lib/db/orders.ts";
import { getDb } from "../src/lib/db/index.ts";
import { getCheckoutIdempotencyKey } from "../src/services/checkout-idempotency.ts";
import { hasRequiredOrderPayment } from "../src/services/order-payment-state.ts";
import {
  classifyRazorpayOrderCreateFailure,
  getRazorpayOrderRecoveryAction,
  validateRazorpayOrderLookup,
  validateRazorpayOrderResponse,
  classifyRazorpayOrderPayments,
} from "../src/services/razorpay-order-recovery.ts";
import { queueNotificationJob, isProviderRetryWindowExpired, persistPaymentNotificationJobs } from "../src/services/notification-service.ts";
import { createCheckoutPaymentAttempt, attachCheckoutProviderOrder, claimCheckoutProviderOrder, convertCapturedCheckoutAttempt, getCheckoutPaymentAttempt, processCheckoutAttemptExpiryBatch, updateCheckoutAttemptPaymentState } from "../src/services/checkout-payment-attempts.ts";

describe("Phase 2: Secure Checkout & Pricing Integrity", () => {
  test("checkout idempotency key is reused for an unchanged retry", async () => {
    const values = new Map();
    const originalWindow = globalThis.window;
    let sequence = 0;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        crypto: { subtle: crypto.webcrypto.subtle, randomUUID: () => `checkout-key-${++sequence}` },
        sessionStorage: {
          getItem: (key) => values.get(key) ?? null,
          setItem: (key, value) => values.set(key, value),
          removeItem: (key) => values.delete(key),
        },
      },
    });
    try {
      const details = {
        userId: "customer-1", customerEmail: "Buyer@example.test", paymentMethod: "Cash on Delivery",
        customerName: "Buyer", customerPhone: "9876543210",
        address: { fullName: "Buyer", phone: "9876543210", addressLine1: "Test Street", addressLine2: "", landmark: "", city: "Pune", state: "Maharashtra", pinCode: "411 001", country: "India" },
        items: [{ productId: "rnl-design-01", size: "M", quantity: 1, color: "As pictured" }],
      };
      const first = await getCheckoutIdempotencyKey(details);
      const retry = await getCheckoutIdempotencyKey({ ...details, customerEmail: "buyer@example.test", address: { ...details.address, pinCode: "411001" } });
      assert.equal(retry, first);
      assert.equal(sequence, 1);
    } finally {
      if (originalWindow === undefined) delete globalThis.window;
      else Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
    }
  });

  test("a changed checkout cart receives a new idempotency key", async () => {
    const values = new Map();
    const originalWindow = globalThis.window;
    let sequence = 0;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        crypto: { subtle: crypto.webcrypto.subtle, randomUUID: () => `checkout-key-${++sequence}` },
        sessionStorage: {
          getItem: (key) => values.get(key) ?? null,
          setItem: (key, value) => values.set(key, value),
          removeItem: (key) => values.delete(key),
        },
      },
    });
    try {
      const details = {
        userId: "customer-1", customerEmail: "buyer@example.test", paymentMethod: "Cash on Delivery",
        customerName: "Buyer", customerPhone: "9876543210",
        address: { fullName: "Buyer", phone: "9876543210", addressLine1: "Test Street", city: "Pune", state: "Maharashtra", pinCode: "411001", country: "India" },
        items: [{ productId: "rnl-design-01", size: "M", quantity: 1, color: "As pictured" }],
      };
      const first = await getCheckoutIdempotencyKey(details);
      const changedCart = await getCheckoutIdempotencyKey({ ...details, items: [{ ...details.items[0], quantity: 2 }] });
      assert.notEqual(changedCart, first);
      assert.equal(await getCheckoutIdempotencyKey({ ...details, items: [{ ...details.items[0], quantity: 2 }] }), changedCart);
      assert.equal(sequence, 2);
    } finally {
      if (originalWindow === undefined) delete globalThis.window;
      else Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
    }
  });

  test("Razorpay order creation state only retries known pre-creation outcomes", () => {
    const now = Date.now();
    assert.equal(getRazorpayOrderRecoveryAction({ state: "pending", razorpayOrderId: null, attemptedAt: null, now }), "claim_creation");
    assert.equal(getRazorpayOrderRecoveryAction({ state: "retryable", razorpayOrderId: null, attemptedAt: null, now }), "claim_creation");
    assert.equal(getRazorpayOrderRecoveryAction({ state: "creating", razorpayOrderId: null, attemptedAt: new Date(now - 10_000).toISOString(), now }), "wait");
    assert.equal(getRazorpayOrderRecoveryAction({ state: "creating", razorpayOrderId: null, attemptedAt: new Date(now - 180_000).toISOString(), now }), "reconcile");
    assert.equal(getRazorpayOrderRecoveryAction({ state: "unknown", razorpayOrderId: null, attemptedAt: null, now }), "reconcile");
    assert.equal(getRazorpayOrderRecoveryAction({ state: null, razorpayOrderId: null, attemptedAt: null, now }), "reconcile");
    assert.equal(getRazorpayOrderRecoveryAction({ state: "unknown", razorpayOrderId: "order_saved", attemptedAt: null, now }), "ready");
    // Status alone does not establish that Razorpay rejected before creating an order.
    assert.equal(classifyRazorpayOrderCreateFailure({ statusCode: 400 }), "unknown");
    assert.equal(classifyRazorpayOrderCreateFailure({ statusCode: 409 }), "unknown");
    assert.equal(classifyRazorpayOrderCreateFailure({ statusCode: 408 }), "unknown");
    assert.equal(classifyRazorpayOrderCreateFailure({ statusCode: 503 }), "unknown");
    assert.equal(classifyRazorpayOrderCreateFailure(new Error("socket timeout")), "unknown");
  });

  test("Razorpay create retries require structured definitive rejection and exclude duplicate receipts", () => {
    assert.equal(classifyRazorpayOrderCreateFailure({
      statusCode: 400,
      error: {
        code: "BAD_REQUEST_ERROR",
        description: "An order with the same receipt value has already been created.",
        field: "receipt",
        source: "business",
        step: "payment_initiation",
        reason: "duplicate_request",
        metadata: {},
      },
    }), "unknown");
    assert.equal(classifyRazorpayOrderCreateFailure({
      statusCode: 400,
      error: {
        code: "BAD_REQUEST_ERROR",
        description: "Receipt already exists",
        field: "receipt",
        source: "business",
        step: "payment_initiation",
        reason: "input_validation_failed",
        metadata: {},
      },
    }), "unknown");
    assert.equal(classifyRazorpayOrderCreateFailure({
      statusCode: 400,
      error: {
        code: "BAD_REQUEST_ERROR",
        description: "The amount must be an integer.",
        field: "amount",
        source: "business",
        step: "payment_initiation",
        reason: "input_validation_failed",
        metadata: {},
      },
    }), "retryable");
    assert.equal(classifyRazorpayOrderCreateFailure({ statusCode: 400 }), "unknown");
    assert.equal(classifyRazorpayOrderCreateFailure({ statusCode: 409, error: { code: "BAD_REQUEST_ERROR", description: "Conflict" } }), "unknown");
    assert.equal(classifyRazorpayOrderCreateFailure({ statusCode: 503, error: { code: "SERVER_ERROR", description: "Unavailable" } }), "unknown");
    assert.equal(classifyRazorpayOrderCreateFailure({ code: "ECONNRESET", message: "connection reset" }), "unknown");
    assert.equal(classifyRazorpayOrderCreateFailure(new Error("timeout")), "unknown");
  });

  test("Only an empty or all-failed complete same-order INR lookup permits reusing the existing order", () => {
    const expected = { orderId: "order_current", amount: 99900 };
    const failure = { order_id: expected.orderId, amount: expected.amount, currency: "INR", status: "failed", captured: false };
    const authorized = { ...failure, status: "authorized", captured: false };
    const captured = { ...failure, status: "captured", captured: true };
    const cancelled = { ...failure, status: "cancelled" };
    assert.equal(classifyRazorpayOrderPayments({ entity: "collection", count: 0, items: [] }, expected), "none");
    assert.equal(classifyRazorpayOrderPayments({ entity: "collection", count: 1, items: [failure] }, expected), "failed");
    assert.equal(classifyRazorpayOrderPayments({ entity: "collection", count: 1, items: [cancelled] }, expected), "failed");
    assert.equal(classifyRazorpayOrderPayments({ entity: "collection", count: 1, items: [authorized] }, expected), "authorized");
    assert.equal(classifyRazorpayOrderPayments({ entity: "collection", count: 1, items: [captured] }, expected), "captured");
    assert.equal(classifyRazorpayOrderPayments({ entity: "collection", count: 1, items: [{ ...failure, order_id: "order_old" }] }, expected), "ambiguous");
    assert.equal(classifyRazorpayOrderPayments({ entity: "collection", count: 2, items: [failure] }, expected), "ambiguous");
    assert.equal(classifyRazorpayOrderPayments({ entity: "collection", count: 1, items: [{ ...failure, status: "created" }] }, expected), "ambiguous");
    assert.equal(classifyRazorpayOrderPayments({ entity: "collection", count: 2, items: [captured, captured] }, expected), "ambiguous");
    assert.equal(classifyRazorpayOrderPayments({ entity: "collection", count: 2, items: [captured, authorized] }, expected), "ambiguous");
    assert.equal(classifyRazorpayOrderPayments({ entity: "collection", count: 2, items: [captured, { ...failure, amount: 100 }] }, expected), "ambiguous");
  });

  test("order history only marks the required payment state as confirmed", () => {
    assert.equal(hasRequiredOrderPayment("Razorpay (UPI / Cards / NetBanking)", "paid"), true);
    assert.equal(hasRequiredOrderPayment("Razorpay (UPI / Cards / NetBanking)", "pending_payment"), false);
    assert.equal(hasRequiredOrderPayment("COD Advance", "pending_advance"), false);
    assert.equal(hasRequiredOrderPayment("COD Advance", "partially_paid"), false);
    assert.equal(hasRequiredOrderPayment("COD Advance", "partially_paid", true), true);
  });

  test("Razorpay create and receipt lookup require exact local order details", () => {
    const expected = { receipt: "RNL-TEST-1", amount: 99900, orderId: "local-order-1" };
    const valid = { id: "order_provider_1", receipt: expected.receipt, amount: expected.amount, currency: "INR", notes: { orderId: expected.orderId } };
    assert.deepStrictEqual(validateRazorpayOrderResponse(valid, expected), { valid: true, razorpayOrderId: valid.id });
    assert.equal(validateRazorpayOrderResponse({ ...valid, amount: 100 }, expected).valid, false);
    assert.deepStrictEqual(validateRazorpayOrderLookup({ entity: "collection", count: 1, items: [valid] }, expected), { status: "found", razorpayOrderId: valid.id });
    assert.deepStrictEqual(validateRazorpayOrderLookup({ entity: "collection", count: 0, items: [] }, expected), { status: "not_found" });
    assert.equal(validateRazorpayOrderLookup({ entity: "collection", count: 2, items: [valid, valid] }, expected).status, "ambiguous");
    assert.equal(validateRazorpayOrderLookup({ entity: "collection", count: 1, items: [{ ...valid, notes: { orderId: "other-order" } }] }, expected).status, "ambiguous");
  });

  test("Checkout idempotency scope separates customers and request fingerprints include payment method", () => {
    assert.notStrictEqual(
      scopeCheckoutIdempotencyKey("buyer-a@example.test", "00000000-0000-4000-8000-000000000001"),
      scopeCheckoutIdempotencyKey("buyer-b@example.test", "00000000-0000-4000-8000-000000000001")
    );
    const request = {
      userId: "user-a",
      customerEmail: "Buyer@example.test",
      paymentMethod: "COD",
      customerName: "Buyer",
      customerPhone: "9876543210",
      address: { fullName: "Buyer", phone: "9876543210", addressLine1: "Test Street", city: "Pune", state: "Maharashtra", pinCode: "411001", country: "India" },
      items: [], subtotal: 0, shipping: 0, discount: 0, total: 0,
    };
    assert.notStrictEqual(
      createCheckoutRequestHash(request),
      createCheckoutRequestHash({ ...request, paymentMethod: "Razorpay" })
    );
  });

  test("Inventory locks use the same product and size order for reordered carts", () => {
    const first = [
      { productId: "rnl-design-02", size: "M" },
      { productId: "rnl-design-01", size: "L" },
      { productId: "rnl-design-01", size: "S" },
    ];
    const second = [...first].reverse();
    assert.deepStrictEqual(orderInventoryVariants(first), orderInventoryVariants(second));
    assert.deepStrictEqual(orderInventoryVariants([
      { productId: "b", size: "A" }, { productId: "a", size: "Z" }, { productId: "a", size: "A" },
    ]), [
      { productId: "a", size: "A" }, { productId: "a", size: "Z" }, { productId: "b", size: "A" },
    ]);
  });

  test("Order email fallback requires a verified email and list ownership is by user ID", () => {
    const guestOrder = { user_id: null, customer_email: "buyer@example.test" };
    assert.equal(isOrderOwnedByCustomer(guestOrder, {
      userId: "other-user", email: "buyer@example.test", emailVerified: false,
    }), false);
    assert.equal(isOrderOwnedByCustomer(guestOrder, {
      userId: "other-user", email: "BUYER@example.test", emailVerified: true,
    }), true);
    assert.equal(isOrderOwnedByCustomer({ ...guestOrder, user_id: "owner" }, {
      userId: "owner", email: null, emailVerified: false,
    }), true);
  });

  test("Post-payment notification persistence failure does not throw into payment handling", async () => {
    const originalError = console.error;
    console.error = () => {};
    try {
      assert.equal(await persistPaymentNotificationJobs("paid-order", async () => {
        throw new Error("notification database unavailable");
      }), false);
      assert.equal(await persistPaymentNotificationJobs("paid-order", async () => ({ persisted: 2, failed: 1 })), false);
      assert.equal(await persistPaymentNotificationJobs("paid-order", async () => ({ persisted: 3, failed: 0 })), true);
    } finally {
      console.error = originalError;
    }
  });

  test("Notification retries stop before the provider idempotency window expires", () => {
    const now = Date.parse("2026-10-21T12:00:00.000Z");
    assert.strictEqual(isProviderRetryWindowExpired("2026-10-20T13:01:00.000Z", now), false);
    assert.strictEqual(isProviderRetryWindowExpired("2026-10-20T13:00:00.000Z", now), true);
    assert.strictEqual(isProviderRetryWindowExpired(null, now), false);
  });

  test("Server strictly enforces ₹999 price per T-shirt and calculates correct shipping", () => {
    // 1 item: ₹999 + ₹0 express shipping = ₹999
    const singleResult = calculateTrustedOrderPricing([
      { productId: "rnl-design-01", size: "L", quantity: 1, color: "As pictured" },
    ]);
    assert.strictEqual(singleResult.success, true);
    if (singleResult.success) {
      assert.strictEqual(singleResult.pricing.items[0].price, 999);
      assert.strictEqual(singleResult.pricing.subtotal, 999);
      assert.strictEqual(singleResult.pricing.shipping, 0);
      assert.strictEqual(singleResult.pricing.total, 999);
    }

    // 2 items: 2 * ₹999 = ₹1,998 + ₹0 shipping = ₹1,998
    const multiResult = calculateTrustedOrderPricing([
      { productId: "rnl-design-01", size: "M", quantity: 1, color: "As pictured" },
      { productId: "rnl-design-02", size: "XL", quantity: 1, color: "As pictured" },
    ]);
    assert.strictEqual(multiResult.success, true);
    if (multiResult.success) {
      assert.strictEqual(multiResult.pricing.subtotal, 1998);
      assert.strictEqual(multiResult.pricing.shipping, 0); // FREE
      assert.strictEqual(multiResult.pricing.total, 1998);
    }
  });

  test("Server enforces no discounts when promo codes are disabled", () => {
    const promoResult = calculateTrustedOrderPricing(
      [{ productId: "rnl-design-03", size: "L", quantity: 2, color: "As pictured" }],
      "DROP20"
    );
    assert.strictEqual(promoResult.success, true);
    if (promoResult.success) {
      assert.strictEqual(promoResult.pricing.subtotal, 1998);
      assert.strictEqual(promoResult.pricing.discount, 0); // Promo codes removed
      assert.strictEqual(promoResult.pricing.total, 1998);
    }
  });

  test("Rejects invalid product IDs and unavailable sizes", () => {
    const invalidProduct = calculateTrustedOrderPricing([
      { productId: "non-existent-product", size: "M", quantity: 1, color: "Black" },
    ]);
    assert.strictEqual(invalidProduct.success, false);

    // Test invalid size schema validation
    const invalidSize = CheckoutItemSchema.safeParse({
      productId: "rnl-design-01",
      size: "XXXL", // Invalid
      quantity: 1,
      color: "As pictured",
    });
    assert.strictEqual(invalidSize.success, false);
  });

  test("Validates Indian mobile numbers and PIN codes strictly", () => {
    const validOrder = CreateCheckoutOrderSchema.safeParse({
      customerName: "Arjun Verma",
      customerEmail: "arjun@streetwear.in",
      customerPhone: "9876543210",
      address: {
        fullName: "Arjun Verma",
        phone: "9876543210",
        addressLine1: "Flat 402, Skyline Residency",
        city: "Bengaluru",
        state: "Karnataka",
        pinCode: "560038",
        country: "India",
      },
      items: [{ productId: "rnl-design-01", size: "L", quantity: 1 }],
    });
    assert.strictEqual(validOrder.success, true);

    // Invalid PIN (5 digits)
    const invalidPin = CreateCheckoutOrderSchema.safeParse({
      customerName: "Arjun Verma",
      customerEmail: "arjun@streetwear.in",
      customerPhone: "9876543210",
      address: {
        fullName: "Arjun Verma",
        phone: "9876543210",
        addressLine1: "Flat 402, Skyline Residency",
        city: "Bengaluru",
        state: "Karnataka",
        pinCode: "56003", // 5 digits
        country: "India",
      },
      items: [{ productId: "rnl-design-01", size: "L", quantity: 1 }],
    });
    assert.strictEqual(invalidPin.success, false);

    // Invalid phone number
    const invalidPhone = CreateCheckoutOrderSchema.safeParse({
      customerName: "Arjun Verma",
      customerEmail: "arjun@streetwear.in",
      customerPhone: "12345", // Invalid
      address: {
        fullName: "Arjun Verma",
        phone: "12345",
        addressLine1: "Flat 402, Skyline Residency",
        city: "Bengaluru",
        state: "Karnataka",
        pinCode: "560038",
        country: "India",
      },
      items: [{ productId: "rnl-design-01", size: "L", quantity: 1 }],
    });
    assert.strictEqual(invalidPhone.success, false);
  });
});

describe("Separate checkout payment attempts", () => {
  const makeSnapshot = (email, paymentMethod = "Razorpay (UPI / Cards / NetBanking)") => ({
    customerName: "Attempt Test", customerEmail: email, customerPhone: "9876543210",
    subtotal: 999, shipping: 0, discount: 0, total: 999, paymentMethod, userId: null,
    items: [{ productId: "rnl-design-01", productSlug: "rightnowlife-design-01", productName: "DESIGN 01",
      color: "As pictured", size: "M", price: 999, quantity: 1, image: "/products/design_01_front.png",
      sku: `CPA-${crypto.randomUUID()}`, fit: "Regular", fulfillmentType: "stock" }],
    address: { fullName: "Attempt Test", phone: "9876543210", addressLine1: "Test Street", city: "Pune", state: "Maharashtra", pinCode: "411001" },
  });

  databaseTest("checkout initiation persists an attempt but creates no order; verified capture converts exactly once", async () => {
    const email = `checkout-attempt-${crypto.randomUUID()}@example.test`;
    const key = crypto.randomUUID();
    const hash = crypto.createHash("sha256").update(key).digest("hex");
    const snapshot = makeSnapshot(email);
    const created = await createCheckoutPaymentAttempt({ idempotencyKey: key, requestHash: hash,
      customerEmail: email, userId: null, paymentMethod: snapshot.paymentMethod,
      purpose: "full_payment", expectedAmountPaisa: 99_900, snapshot });
    assert.equal(created.status, "created");
    assert.equal(created.attempt?.attempt_status, "pending");
    assert.equal(created.attempt?.expected_amount_paisa, Math.round(snapshot.total * 100));
    assert.equal(created.attempt?.checkout_snapshot.shipping, 0);
    assert.equal(await getDb().prepare("SELECT COUNT(*) AS n FROM orders WHERE customer_email = ?").get(email).then((row) => Number(row.n)), 0);

    const replay = await createCheckoutPaymentAttempt({ idempotencyKey: key, requestHash: hash,
      customerEmail: email, userId: null, paymentMethod: snapshot.paymentMethod,
      purpose: "full_payment", expectedAmountPaisa: 99_900, snapshot });
    assert.equal(replay.status, "replayed");
    assert.equal(replay.attempt?.id, created.attempt?.id);
    assert.equal(await claimCheckoutProviderOrder(created.attempt.id), "claimed");
    assert.equal(await attachCheckoutProviderOrder(created.attempt.id, `order_${crypto.randomUUID()}`), true);
    const attempt = await getCheckoutPaymentAttempt(created.attempt.id);
    await updateCheckoutAttemptPaymentState(attempt.id, `pay_${crypto.randomUUID()}`, "captured", "test-signature");
    const captured = await getCheckoutPaymentAttempt(attempt.id);
    const converted = await convertCapturedCheckoutAttempt({ attemptId: attempt.id,
      providerOrderId: attempt.provider_order_id, providerPaymentId: captured.provider_payment_id, signature: "test-signature" });
    assert.equal(converted.success, true);
    assert.equal(converted.alreadyConverted, false);
    const replayedCapture = await convertCapturedCheckoutAttempt({ attemptId: attempt.id,
      providerOrderId: attempt.provider_order_id, providerPaymentId: captured.provider_payment_id, signature: "test-signature" });
    assert.equal(replayedCapture.success, true);
    assert.equal(replayedCapture.alreadyConverted, true);
    const order = await getOrderById(converted.orderId);
    assert.equal(order.payment_status, "paid");
    assert.equal(order.is_confirmed, true);
    assert.equal(order.subtotal, 999);
    assert.equal(order.shipping, 0);
    assert.equal(order.discount, 0);
    assert.equal(order.total, 999);
    assert.equal(await getDb().prepare("SELECT COUNT(*) AS n FROM orders WHERE id = ?").get(order.id).then((row) => Number(row.n)), 1);
  });

  databaseTest("failed and abandoned attempts do not convert; verified COD Advance records its balance", async () => {
    const email = `checkout-advance-${crypto.randomUUID()}@example.test`;
    const key = crypto.randomUUID();
    const snapshot = { ...makeSnapshot(email, "COD Advance"), total: 999, userId: "test-cod-advance-user" };
    const failedAttempt = await createCheckoutPaymentAttempt({ idempotencyKey: key, requestHash: key,
      customerEmail: email, userId: snapshot.userId, paymentMethod: "COD Advance", purpose: "cod_advance",
      expectedAmountPaisa: 20_000, snapshot });
    await claimCheckoutProviderOrder(failedAttempt.attempt.id);
    await attachCheckoutProviderOrder(failedAttempt.attempt.id, `order_${crypto.randomUUID()}`);
    await updateCheckoutAttemptPaymentState(failedAttempt.attempt.id, `pay_${crypto.randomUUID()}`, "failed");
    const failed = await getCheckoutPaymentAttempt(failedAttempt.attempt.id);
    const rejected = await convertCapturedCheckoutAttempt({ attemptId: failed.id,
      providerOrderId: failed.provider_order_id, providerPaymentId: "pay_not_captured" });
    assert.equal(rejected.success, false);
    assert.equal(await getDb().prepare("SELECT COUNT(*) AS n FROM orders WHERE customer_email = ?").get(email).then((row) => Number(row.n)), 0);

    const cancelledKey = crypto.randomUUID();
    const cancelledAttempt = await createCheckoutPaymentAttempt({ idempotencyKey: cancelledKey, requestHash: cancelledKey,
      customerEmail: email, userId: snapshot.userId, paymentMethod: "COD Advance", purpose: "cod_advance",
      expectedAmountPaisa: 20_000, snapshot });
    await claimCheckoutProviderOrder(cancelledAttempt.attempt.id);
    await attachCheckoutProviderOrder(cancelledAttempt.attempt.id, `order_${crypto.randomUUID()}`);
    await updateCheckoutAttemptPaymentState(cancelledAttempt.attempt.id, `pay_${crypto.randomUUID()}`, "cancelled");
    const cancelled = await getCheckoutPaymentAttempt(cancelledAttempt.attempt.id);
    assert.equal((await convertCapturedCheckoutAttempt({ attemptId: cancelled.id,
      providerOrderId: cancelled.provider_order_id, providerPaymentId: "pay_cancelled" })).success, false);

    const advanceKey = crypto.randomUUID();
    const advance = await createCheckoutPaymentAttempt({ idempotencyKey: advanceKey, requestHash: advanceKey,
      customerEmail: email, userId: snapshot.userId, paymentMethod: "COD Advance", purpose: "cod_advance",
      expectedAmountPaisa: 20_000, snapshot });
    const advanceReplay = await createCheckoutPaymentAttempt({ idempotencyKey: advanceKey, requestHash: advanceKey,
      customerEmail: email, userId: snapshot.userId, paymentMethod: "COD Advance", purpose: "cod_advance",
      expectedAmountPaisa: 20_000, snapshot });
    assert.equal(advanceReplay.status, "replayed");
    assert.equal(advanceReplay.attempt.id, advance.attempt.id);
    await claimCheckoutProviderOrder(advance.attempt.id);
    await attachCheckoutProviderOrder(advance.attempt.id, `order_${crypto.randomUUID()}`);
    const paymentId = `pay_${crypto.randomUUID()}`;
    await updateCheckoutAttemptPaymentState(advance.attempt.id, paymentId, "captured", "test-signature");
    const ready = await getCheckoutPaymentAttempt(advance.attempt.id);
    const result = await convertCapturedCheckoutAttempt({ attemptId: ready.id,
      providerOrderId: ready.provider_order_id, providerPaymentId: paymentId, signature: "test-signature" });
    const order = await getOrderById(result.orderId);
    assert.equal(order.payment_status, "partially_paid");
    assert.equal(order.order_status, "advance_paid");
    assert.equal(order.total - 200, 799);
    assert.equal(order.is_confirmed, true);
  });

  databaseTest("expired unstarted attempts release reservations once under concurrent workers", async () => {
    const email = `checkout-expiry-${crypto.randomUUID()}@example.test`;
    const key = crypto.randomUUID();
    const productId = `expiry-${crypto.randomUUID()}`;
    const snapshot = makeSnapshot(email);
    snapshot.items[0].productId = productId;
    snapshot.items[0].sku = productId;
    const { attempt } = await createCheckoutPaymentAttempt({ idempotencyKey: key, requestHash: key,
      customerEmail: email, userId: null, paymentMethod: snapshot.paymentMethod,
      purpose: "full_payment", expectedAmountPaisa: 99_900, snapshot });
    await getDb().prepare("UPDATE checkout_payment_attempts SET expires_at = NOW() - INTERVAL '1 hour', updated_at = NOW() - INTERVAL '1 hour' WHERE id = ?").run(attempt.id);
    const reservedBefore = await getDb().prepare("SELECT reserved FROM inventory WHERE product_id = ? AND size = 'M'").get(productId);
    assert.equal(Number(reservedBefore.reserved), 1);

    const [first, second] = await Promise.all([
      processCheckoutAttemptExpiryBatch(),
      processCheckoutAttemptExpiryBatch(),
    ]);
    assert.equal(first.released + second.released, 1);
    const reservedAfter = await getDb().prepare("SELECT reserved FROM inventory WHERE product_id = ? AND size = 'M'").get(productId);
    const expired = await getCheckoutPaymentAttempt(attempt.id);
    assert.equal(Number(reservedAfter.reserved), 0);
    assert.equal(expired.attempt_status, "expired");
    assert.equal(expired.reservation_state, "released");
    assert.equal(await claimCheckoutProviderOrder(attempt.id), "reconcile");
    assert.equal((await processCheckoutAttemptExpiryBatch()).released, 0);
  });

  databaseTest("provider-backed expiry keeps reservations for delayed successful webhook capture", async () => {
    const email = `checkout-late-capture-${crypto.randomUUID()}@example.test`;
    const key = crypto.randomUUID();
    const productId = `late-${crypto.randomUUID()}`;
    const snapshot = makeSnapshot(email);
    snapshot.items[0].productId = productId;
    snapshot.items[0].sku = productId;
    const { attempt } = await createCheckoutPaymentAttempt({ idempotencyKey: key, requestHash: key,
      customerEmail: email, userId: null, paymentMethod: snapshot.paymentMethod,
      purpose: "full_payment", expectedAmountPaisa: 99_900, snapshot });
    await claimCheckoutProviderOrder(attempt.id);
    const providerOrderId = `order_${crypto.randomUUID()}`;
    await attachCheckoutProviderOrder(attempt.id, providerOrderId);
    await getDb().prepare("UPDATE checkout_payment_attempts SET expires_at = NOW() - INTERVAL '1 hour' WHERE id = ?").run(attempt.id);

    const expiry = await processCheckoutAttemptExpiryBatch(100, async () => null);
    assert.equal(expiry.released, 0);
    assert.equal(expiry.deferred, 1);
    const stillHeld = await getCheckoutPaymentAttempt(attempt.id);
    assert.equal(stillHeld.reservation_state, "held");
    assert.equal(Number((await getDb().prepare("SELECT reserved FROM inventory WHERE product_id = ? AND size = 'M'").get(productId)).reserved), 1);

    const paymentId = `pay_${crypto.randomUUID()}`;
    await updateCheckoutAttemptPaymentState(attempt.id, paymentId, "captured");
    const converted = await convertCapturedCheckoutAttempt({ attemptId: attempt.id, providerOrderId, providerPaymentId: paymentId });
    const duplicate = await convertCapturedCheckoutAttempt({ attemptId: attempt.id, providerOrderId, providerPaymentId: paymentId });
    assert.equal(converted.success, true);
    assert.equal(duplicate.alreadyConverted, true);
    assert.equal((await getCheckoutPaymentAttempt(attempt.id)).reservation_state, "consumed");
  });
});

describe("Phase 2: Cryptographic Razorpay Signature Verification", () => {
  const testSecret = "test_secret_key_rnl_2026";
  const orderId = "order_test_123456789";
  const paymentId = "pay_test_987654321";

  test("Verifies valid payment signature correctly using HMAC-SHA256", () => {
    const text = `${orderId}|${paymentId}`;
    const validSignature = crypto
      .createHmac("sha256", testSecret)
      .update(text)
      .digest("hex");

    const isValid = verifyPaymentSignature({
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: validSignature,
      secret: testSecret,
    });
    assert.strictEqual(isValid, true);
  });

  test("Rejects forged or tampered payment signatures", () => {
    const forgedSignature = "0000000000000000000000000000000000000000000000000000000000000000";
    const isValid = verifyPaymentSignature({
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: forgedSignature,
      secret: testSecret,
    });
    assert.strictEqual(isValid, false);
  });

  test("Verifies raw request body for Razorpay Webhooks", () => {
    const webhookSecret = "test_webhook_secret_rnl";
    const rawBody = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_123", amount: 109800 } } },
    });

    const validWebhookSig = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    assert.strictEqual(
      verifyWebhookSignature(rawBody, validWebhookSig, webhookSecret),
      true
    );

    // Tampered body must fail
    const tamperedBody = rawBody + " ";
    assert.strictEqual(
      verifyWebhookSignature(tamperedBody, validWebhookSig, webhookSecret),
      false
    );
  });

  test("Only captured Razorpay payments count as paid", () => {
    assert.strictEqual(isPaymentCaptured("captured"), true);
    assert.strictEqual(isPaymentCaptured("authorized"), false);
    assert.strictEqual(isPaymentCaptured("failed"), false);
  });

  test("Webhook payment must be captured, INR, and have valid Razorpay IDs and amount", () => {
    const captured = {
      id: "pay_test_123",
      order_id: "order_test_123",
      status: "captured",
      captured: true,
      currency: "INR",
      amount: 99900,
    };
    assert.strictEqual(isVerifiedCapturedWebhookPayment(captured), true);
    assert.strictEqual(isVerifiedCapturedWebhookPayment({ ...captured, captured: false }), false);
    assert.strictEqual(isVerifiedCapturedWebhookPayment({ ...captured, amount: 0 }), false);
    assert.strictEqual(isVerifiedCapturedWebhookPayment({ ...captured, currency: "USD" }), false);
    assert.strictEqual(isVerifiedCapturedWebhookPayment({ ...captured, order_id: undefined }), false);
    assert.strictEqual(isVerifiedCapturedPaymentDetails(captured, "order_test_123", 99900), true);
    assert.strictEqual(isVerifiedCapturedPaymentDetails(captured, "order_other", 99900), false);
    assert.strictEqual(isVerifiedCapturedPaymentDetails(captured, "order_test_123", 100), false);
    const failed = { ...captured, status: "failed", captured: false };
    const authorized = { ...captured, status: "authorized", captured: false };
    assert.strictEqual(isVerifiedPaymentDetails(failed, "order_test_123", 99900), true);
    assert.strictEqual(isVerifiedPaymentDetails(authorized, "order_test_123", 99900), true);
    assert.strictEqual(isVerifiedPaymentDetails(captured, "order_test_123", 99900, "pay_test_123"), true);
    assert.strictEqual(isVerifiedPaymentDetails(captured, "order_test_123", 99900, "pay_other"), false);
    assert.strictEqual(isVerifiedPaymentDetails({ ...captured, status: "cancelled", captured: false }, "order_test_123", 99900, "pay_test_123"), true);
    assert.strictEqual(isVerifiedPaymentDetails({ ...failed, amount: 100 }, "order_test_123", 99900), false);
    assert.strictEqual(isVerifiedPaymentDetails({ ...failed, order_id: "order_other" }, "order_test_123", 99900), false);
  });

  test("COD Advance verification requires exact ₹200 INR and matching Razorpay references", () => {
    const advance = { id: "pay_advance_1", order_id: "order_advance_1", status: "captured", captured: true, currency: "INR", amount: 20000 };
    assert.equal(isVerifiedCapturedPaymentDetails(advance, "order_advance_1", 20000), true);
    assert.equal(isVerifiedCapturedPaymentDetails({ ...advance, amount: 19900 }, "order_advance_1", 20000), false);
    assert.equal(isVerifiedCapturedPaymentDetails({ ...advance, currency: "USD" }, "order_advance_1", 20000), false);
    assert.equal(isVerifiedCapturedPaymentDetails({ ...advance, order_id: "order_other" }, "order_advance_1", 20000), false);
    assert.equal(isVerifiedCapturedPaymentDetails({ ...advance, status: "authorized", captured: false }, "order_advance_1", 20000), false);
  });
});

describe("Phase 2: Database Order Management & Idempotency", () => {
  databaseTest("COD Advance capture is idempotent and records a partial, not full, payment", async () => {
    const id = crypto.randomUUID();
    const { order } = await createPendingOrder({
      orderNumber: generateOrderNumber(), customerName: "Advance Test", customerEmail: `advance-${id}@example.test`,
      customerPhone: "9876543210", subtotal: 999, shipping: 0, discount: 0, total: 999,
      paymentMethod: "COD Advance", userId: "test-customer-account",
      items: [{ productId: "rnl-design-01", productSlug: "rightnowlife-design-01", productName: "Design 01",
        color: "As pictured", size: "M", price: 999, quantity: 1, image: "/products/design_01_front.png", sku: `ADV-${id}`, fit: "Regular" }],
      address: { fullName: "Advance Test", phone: "9876543210", addressLine1: "Test Street", city: "Pune", state: "Maharashtra", pinCode: "411001" },
    });
    await getDb().prepare("UPDATE orders SET payment_status = 'pending_advance' WHERE id = ?").run(order.id);
    const attempt = await createCodAdvanceAttempt(order.id, `advance-${id}`, getDb());
    assert.equal(await claimCodAdvanceOrderCreation(attempt.id), "claimed");
    assert.equal(await attachCodAdvanceRazorpayOrder(attempt.id, `order_test_advance_${id}`), true);
    const first = await markCodAdvanceAsVerified({ attemptId: attempt.id, paymentId: `pay_test_advance_${id}`, razorpayOrderId: `order_test_advance_${id}` });
    const replay = await markCodAdvanceAsVerified({ attemptId: attempt.id, paymentId: `pay_test_advance_${id}`, razorpayOrderId: `order_test_advance_${id}` });
    const stored = await getOrderById(order.id);
    assert.deepEqual(first, { success: true, alreadyVerified: false });
    assert.deepEqual(replay, { success: true, alreadyVerified: true });
    assert.equal(stored?.payment_status, "partially_paid");
    assert.equal(stored?.order_status, "advance_paid");
    assert.equal(stored?.total, 999);
    assert.equal(stored?.total - 200, 799);
  });

  databaseTest("Custom order customization persists and made-to-order items do not create inventory", async () => {
    const id = crypto.randomUUID();
    const customProductId = "rnl-custom-quote-tee";
    const before = await getDb().prepare("SELECT COUNT(*) AS count FROM inventory WHERE product_id = ?")
      .get(customProductId);
    const { order } = await createPendingOrder({
      orderNumber: generateOrderNumber(), customerName: "Custom Test", customerEmail: `custom-${id}@example.test`,
      customerPhone: "9876543210", subtotal: 1299, shipping: 0, discount: 0, total: 1299,
      paymentMethod: "Razorpay (UPI / Cards / NetBanking)", userId: "test-customer-account", razorpayOrderId: `order_test_custom_${id}`,
      items: [{
        productId: "rnl-custom-quote-tee", productSlug: "wear-your-mood", productName: "Wear Your Mood Custom Quote Tee",
        color: "Natural", size: "M", price: 1299, quantity: 1, image: "/products/custom-tee-preview.svg",
        sku: `RNL-CUSTOM-QUOTE-M-${id}`, fit: "Regular", fulfillmentType: "made_to_order",
        customization: { type: "quote_tshirt", mood: "confident", quote: "I choose my own way", quoteStyle: "deep", font: "serif", printColor: "ocean", placement: "center" },
      }],
      address: { fullName: "Custom Test", phone: "9876543210", addressLine1: "Test Street", city: "Pune", state: "Maharashtra", pinCode: "411001" },
    });
    const captured = await markOrderAsPaid(order.id, `pay_test_custom_${id}`, `order_test_custom_${id}`);
    assert.equal(captured.success, true);
    const fetched = await getOrderById(order.id);
    assert.equal(fetched?.items[0].customization?.quote, "I choose my own way");
    assert.equal(fetched?.items[0].fulfillment_type, "made_to_order");
    assert.equal(fetched?.payment_status, "paid");
    const after = await getDb().prepare("SELECT COUNT(*) AS count FROM inventory WHERE product_id = ?")
      .get(customProductId);
    assert.equal(Number(after?.count), Number(before?.count));
  });

  databaseTest("Creates pending order in relational database and verifies relations", async () => {
    const orderNumber = generateOrderNumber();
    const { order, guestToken } = await createPendingOrder({
      orderNumber,
      customerName: "Devika Rao",
      customerEmail: "devika@rightnowlife.in",
      customerPhone: "9876543211",
      subtotal: 999,
      shipping: 99,
      discount: 0,
      total: 1098,
      paymentMethod: "Razorpay (UPI / Cards / NetBanking)",
      razorpayOrderId: "order_test_devika_1",
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
        fullName: "Devika Rao",
        phone: "9876543211",
        addressLine1: "123 Indiranagar 100ft Road",
        city: "Bengaluru",
        state: "Karnataka",
        pinCode: "560038",
      },
    });

    assert.ok(order.id);
    assert.strictEqual(order.payment_status, "pending_payment");
    assert.strictEqual(order.order_status, "pending_payment");
    assert.strictEqual(order.is_confirmed, false);
    assert.ok(guestToken);

    // Fetch order back with relations
    const fetched = await getOrderById(order.id);
    assert.ok(fetched);
    assert.strictEqual(fetched.items.length, 1);
    assert.strictEqual(fetched.items[0].price, 999);
    assert.strictEqual(fetched.address?.city, "Bengaluru");
  });

  databaseTest("Idempotently transitions order to paid without duplicate deductions", async () => {
    const orderNumber = generateOrderNumber();
    const reservation = await checkAndReserveInventory([
      { productId: "rnl-design-02", size: "L", quantity: 1 },
    ]);
    assert.strictEqual(reservation.ok, true);
    const { order } = await createPendingOrder({
      orderNumber,
      customerName: "Kabir Malhotra",
      customerEmail: "kabir@rightnowlife.in",
      customerPhone: "9876543212",
      subtotal: 999,
      shipping: 99,
      discount: 0,
      total: 1098,
      paymentMethod: "Razorpay",
      razorpayOrderId: "order_test_kabir_1",
      items: [
        {
          productId: "rnl-design-02",
          productSlug: "rightnowlife-design-02",
          productName: "DESIGN 02 — GRAPHIC RAGLAN TEE",
          color: "As pictured",
          size: "L",
          price: 999,
          quantity: 1,
          image: "/products/design_02_front.png",
          sku: "RNL-DESIGN-02-L",
          fit: "Regular",
        },
      ],
      address: {
        fullName: "Kabir Malhotra",
        phone: "9876543212",
        addressLine1: "456 Bandra West",
        city: "Mumbai",
        state: "Maharashtra",
        pinCode: "400050",
      },
    });

    // 1st transition
    const firstCall = await markOrderAsPaid(order.id, "pay_kabir_123", "order_test_kabir_1", "sig_123");
    assert.strictEqual(firstCall.success, true);
    assert.strictEqual(firstCall.alreadyPaid, false);

    const paidOrder = await getOrderById(order.id);
    assert.strictEqual(paidOrder?.payment_status, "paid");
    assert.strictEqual(paidOrder?.order_status, "paid");
    assert.strictEqual(paidOrder?.is_confirmed, true);
    assert.equal((await getOrdersByEmail("kabir@rightnowlife.in")).some((entry) => entry.id === paidOrder.id), true);

    // 2nd duplicate transition (idempotent duplicate callback)
    const secondCall = await markOrderAsPaid(order.id, "pay_kabir_123", "order_test_kabir_1", "sig_123");
    assert.strictEqual(secondCall.success, true);
    assert.strictEqual(secondCall.alreadyPaid, true); // Handled idempotently
    const differentCapture = await markOrderAsPaid(order.id, "pay_kabir_duplicate", "order_test_kabir_1", "sig_other");
    assert.deepStrictEqual(differentCapture, { success: false, alreadyPaid: true });
  });

  databaseTest("Concurrent checkout retries with one key create one order", async () => {
    const rawKey = crypto.randomUUID();
    const scopedKey = scopeCheckoutIdempotencyKey(`idem-${rawKey}@example.test`, rawKey);
    const requestHash = crypto.createHash("sha256").update(rawKey).digest("hex");
    let createCalls = 0;
    const create = async (db) => {
      createCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 30));
      return createPendingOrder({
        orderNumber: generateOrderNumber(),
        customerName: "Idempotency Test",
        customerEmail: `idem-${rawKey}@example.test`,
        customerPhone: "9876543210",
        subtotal: 999,
        shipping: 0,
        discount: 0,
        total: 999,
        paymentMethod: "Cash on Delivery",
        checkoutIdempotencyKey: scopedKey,
        checkoutRequestHash: requestHash,
        items: [{
          productId: "rnl-design-01", productSlug: "rightnowlife-design-01",
          productName: "DESIGN 01", color: "As pictured", size: "M", price: 999,
          quantity: 1, image: "/products/design_01_front.png", sku: `IDEM-${rawKey}`, fit: "Regular",
        }],
        address: { fullName: "Idempotency Test", phone: "9876543210", addressLine1: "Test Street", city: "Pune", state: "Maharashtra", pinCode: "411001" },
      }, db);
    };
    const [first, second] = await Promise.all([
      withCheckoutIdempotency({ idempotencyKey: scopedKey, requestHash, create }),
      withCheckoutIdempotency({ idempotencyKey: scopedKey, requestHash, create }),
    ]);
    assert.strictEqual(createCalls, 1);
    assert.deepStrictEqual([first.status, second.status].sort(), ["created", "replayed"]);
    assert.strictEqual(first.order.id, second.order.id);
  });

  databaseTest("A failed payment attempt does not release inventory or terminally fail its order", async () => {
    const orderNumber = generateOrderNumber();
    const { order } = await createPendingOrder({
      orderNumber,
      customerName: "Pooja S",
      customerEmail: "pooja@rightnowlife.in",
      customerPhone: "9876543213",
      subtotal: 999,
      shipping: 99,
      discount: 0,
      total: 1098,
      paymentMethod: "Razorpay",
      userId: "test-customer-account",
      items: [
        {
          productId: "rnl-design-03",
          productSlug: "rightnowlife-design-03",
          productName: "DESIGN 03 — GRAPHIC RAGLAN TEE",
          color: "As pictured",
          size: "S",
          price: 999,
          quantity: 1,
          image: "/products/design_03_front.png",
          sku: "RNL-DESIGN-03-S",
          fit: "Regular",
        },
      ],
      address: {
        fullName: "Pooja S",
        phone: "9876543213",
        addressLine1: "Connaught Place",
        city: "New Delhi",
        state: "Delhi",
        pinCode: "110001",
      },
    });

    await recordPaymentAttemptFailure(order.id, "pay_failed_attempt", "Bank network timeout");
    const stillPendingOrder = await getOrderById(order.id);
    assert.strictEqual(stillPendingOrder?.payment_status, "pending_payment");
    assert.strictEqual(stillPendingOrder?.order_status, "pending_payment");
  });

  databaseTest("Customer history excludes unpaid online checkouts and keeps pending COD orders", async () => {
    const email = `customer-test-${crypto.randomUUID()}@rightnowlife.in`;
    const checkout = {
      orderNumber: generateOrderNumber(),
      customerName: "Test Customer",
      customerEmail: email,
      customerPhone: "9876543214",
      subtotal: 999,
      shipping: 99,
      discount: 0,
      total: 1098,
      paymentMethod: "Razorpay",
      items: [
        {
          productId: "rnl-design-04",
          productSlug: "rightnowlife-design-04",
          productName: "DESIGN 04 — GRAPHIC RAGLAN TEE",
          color: "As pictured",
          size: "XL",
          price: 999,
          quantity: 1,
          image: "/products/design_04_front.png",
          sku: "RNL-DESIGN-04-XL",
          fit: "Regular",
        },
      ],
      address: {
        fullName: "Test Customer",
        phone: "9876543214",
        addressLine1: "Koregaon Park",
        city: "Pune",
        state: "Maharashtra",
        pinCode: "411001",
      },
    };
    const online = await createPendingOrder(checkout);

    const orders = await getOrdersByEmail(email);
    assert.equal(orders.some((order) => order.id === online.order.id), false);

    const cod = await createPendingOrder({ ...checkout, orderNumber: generateOrderNumber(), paymentMethod: "COD" });
    assert.equal(cod.order.is_confirmed, true);
    const codOrders = await getOrdersByEmail(email);
    assert.equal(codOrders.some((order) => order.id === cod.order.id && order.payment_status === "pending_payment"), true);

    const accountOrders = await getOrdersByCustomer("test-customer-account", email);
    assert.ok(accountOrders.some((order) => order.id === cod.order.id));
    assert.equal(accountOrders.some((order) => order.id === online.order.id), false);
  });

  databaseTest("Concurrent notification retries call Resend once with a stable idempotency key", async () => {
    const priorApiKey = process.env.RESEND_API_KEY;
    const priorFetch = globalThis.fetch;
    const idempotencyKey = `test-notification-${crypto.randomUUID()}`;
    let sendCount = 0;
    const seenKeys = [];
    process.env.RESEND_API_KEY = "re_test_key_used_only_with_stubbed_fetch";
    globalThis.fetch = async (_url, options) => {
      sendCount += 1;
      seenKeys.push(options.headers["Idempotency-Key"]);
      await new Promise((resolve) => setTimeout(resolve, 25));
      return new Response(JSON.stringify({ id: "email_test_accepted" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    try {
      const params = {
        recipientEmail: "preview-test@example.invalid",
        eventType: "test_notification",
        subject: "Test notification",
        bodyHtml: "<p>Test</p>",
        idempotencyKey,
      };
      const [left, right] = await Promise.all([
        queueNotificationJob(params),
        queueNotificationJob(params),
      ]);
      assert.strictEqual(left.id, right.id);
      assert.strictEqual(sendCount, 1);
      assert.strictEqual(seenKeys[0], idempotencyKey);

      const job = await getDb().prepare("SELECT * FROM notification_jobs WHERE idempotency_key = ?")
        .get(idempotencyKey);
      assert.strictEqual(job.status, "sent");
      assert.strictEqual(job.provider_message_id, "email_test_accepted");
    } finally {
      globalThis.fetch = priorFetch;
      if (priorApiKey === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = priorApiKey;
    }
  });
});
