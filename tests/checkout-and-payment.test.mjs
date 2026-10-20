import { test, describe } from "node:test";
import assert from "node:assert";
import crypto from "node:crypto";
import { databaseTest } from "./postgres-test-support.mjs";
import {
  calculateTrustedOrderPricing,
  CheckoutItemSchema,
  CreateCheckoutOrderSchema,
  generateOrderNumber,
} from "../src/services/checkout-service.ts";
import {
  verifyPaymentSignature,
  verifyWebhookSignature,
} from "../src/lib/razorpay.ts";
import {
  createPendingOrder,
  getOrderById,
  markOrderAsPaid,
  markOrderPaymentFailed,
  getOrdersByEmail,
} from "../src/lib/db/orders.ts";

describe("Phase 2: Secure Checkout & Pricing Integrity", () => {
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
    const firstCall = await markOrderAsPaid(order.id, "pay_kabir_123", "sig_123");
    assert.strictEqual(firstCall.success, true);
    assert.strictEqual(firstCall.alreadyPaid, false);

    const paidOrder = await getOrderById(order.id);
    assert.strictEqual(paidOrder?.payment_status, "paid");
    assert.strictEqual(paidOrder?.order_status, "paid");

    // 2nd duplicate transition (idempotent duplicate callback)
    const secondCall = await markOrderAsPaid(order.id, "pay_kabir_123", "sig_123");
    assert.strictEqual(secondCall.success, true);
    assert.strictEqual(secondCall.alreadyPaid, true); // Handled idempotently
  });

  databaseTest("Handles payment failure cleanly and preserves order history", async () => {
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

    await markOrderPaymentFailed(order.id, "Bank network timeout");
    const failedOrder = await getOrderById(order.id);
    assert.strictEqual(failedOrder?.payment_status, "payment_failed");
    assert.strictEqual(failedOrder?.order_status, "payment_failed");
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
  });
});
