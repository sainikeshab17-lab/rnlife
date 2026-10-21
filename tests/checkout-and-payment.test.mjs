import { test, describe } from "node:test";
import assert from "node:assert";
import crypto from "node:crypto";
import { databaseTest } from "./postgres-test-support.mjs";
import {
  calculateTrustedOrderPricing,
  CheckoutItemSchema,
  CreateCheckoutOrderSchema,
  createCheckoutRequestHash,
  generateOrderNumber,
} from "../src/services/checkout-service.ts";
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
} from "../src/lib/db/orders.ts";
import { getDb } from "../src/lib/db/index.ts";
import { getCheckoutIdempotencyKey } from "../src/services/checkout-idempotency.ts";
import {
  classifyRazorpayOrderCreateFailure,
  getRazorpayOrderRecoveryAction,
  validateRazorpayOrderLookup,
  validateRazorpayOrderResponse,
  classifyRazorpayOrderPayments,
} from "../src/services/razorpay-order-recovery.ts";
import { queueNotificationJob, isProviderRetryWindowExpired, persistPaymentNotificationJobs } from "../src/services/notification-service.ts";

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
    assert.equal(classifyRazorpayOrderPayments({ entity: "collection", count: 0, items: [] }, expected), "none");
    assert.equal(classifyRazorpayOrderPayments({ entity: "collection", count: 1, items: [failure] }, expected), "failed");
    assert.equal(classifyRazorpayOrderPayments({ entity: "collection", count: 1, items: [authorized] }, expected), "authorized");
    assert.equal(classifyRazorpayOrderPayments({ entity: "collection", count: 1, items: [captured] }, expected), "captured");
    assert.equal(classifyRazorpayOrderPayments({ entity: "collection", count: 1, items: [{ ...failure, order_id: "order_old" }] }, expected), "ambiguous");
    assert.equal(classifyRazorpayOrderPayments({ entity: "collection", count: 2, items: [failure] }, expected), "ambiguous");
    assert.equal(classifyRazorpayOrderPayments({ entity: "collection", count: 1, items: [{ ...failure, status: "created" }] }, expected), "ambiguous");
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
    assert.strictEqual(isVerifiedPaymentDetails({ ...failed, amount: 100 }, "order_test_123", 99900), false);
    assert.strictEqual(isVerifiedPaymentDetails({ ...failed, order_id: "order_other" }, "order_test_123", 99900), false);
  });
});

describe("Phase 2: Database Order Management & Idempotency", () => {
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

  databaseTest("Retrieves customer order history correctly by email", async () => {
    const email = "customer_test@rightnowlife.in";
    await createPendingOrder({
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
    });

    const orders = await getOrdersByEmail(email);
    assert.ok(orders.length >= 1);
    assert.strictEqual(orders[0].customer_email, email);

    const accountOrders = await getOrdersByCustomer("test-customer-account", email);
    assert.ok(accountOrders.some((order) => order.customer_email === email));
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
