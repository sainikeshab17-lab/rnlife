import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  CheckoutIdempotencyKeySchema, CreateCheckoutOrderSchema,
  calculateCodAdvanceAmounts, createCheckoutRequestHash,
} from "@/services/checkout-service";
import { calculateConfiguredOrderPricing } from "@/services/configured-checkout-pricing";
import { InventoryUnavailableError, scopeCheckoutIdempotencyKey } from "@/lib/db/orders";
import { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, getRazorpayClient, findRazorpayOrdersByReceipt } from "@/lib/razorpay";
import {
  attachCheckoutProviderOrder, claimCheckoutProviderOrder, createCheckoutPaymentAttempt,
  getCheckoutPaymentAttempt, reconcileCapturedCheckoutAttempt, setCheckoutAttemptCreationFailure,
} from "@/services/checkout-payment-attempts";
import { getOrderById } from "@/lib/db/orders";
import { dispatchAllOrderNotifications, persistPaymentNotificationJobs } from "@/services/notification-service";
import { classifyRazorpayOrderCreateFailure, classifyRazorpayOrderPayments, validateRazorpayOrderLookup, validateRazorpayOrderResponse } from "@/services/razorpay-order-recovery";

export const dynamic = "force-dynamic";
const RequestSchema = CreateCheckoutOrderSchema.extend({ idempotencyKey: CheckoutIdempotencyKeySchema });

async function recoverCapturedAdvance(attempt: NonNullable<Awaited<ReturnType<typeof getCheckoutPaymentAttempt>>>) {
  const converted = await reconcileCapturedCheckoutAttempt(attempt);
  if (!converted?.success || !converted.orderId) {
    return NextResponse.json({ success: false, error: "The advance was captured but needs reconciliation. Do not pay again." }, { status: 409 });
  }
  await persistPaymentNotificationJobs(converted.orderId, async () => {
    const order = await getOrderById(converted.orderId!);
    if (!order) throw new Error("Recovered COD Advance order could not be loaded for notifications.");
    return dispatchAllOrderNotifications(order);
  });
  return NextResponse.json({ success: false, alreadyCompleted: true,
    error: `The ₹200 advance was captured and order ${converted.orderNumber} is confirmed. Check My Orders.` }, { status: 409 });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user?.email || !data.user.id) return NextResponse.json({ success: false, error: "Please sign in before choosing COD Advance." }, { status: 401 });
    const parsed = RequestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid checkout details.", details: parsed.error.flatten().fieldErrors }, { status: 400 });
    const { customerName, customerPhone, address, items, promoCode, idempotencyKey: requestKey } = parsed.data;
    const priced = await calculateConfiguredOrderPricing(items, promoCode);
    if (!priced.success) return NextResponse.json({ success: false, error: priced.error }, { status: 400 });
    const pricing = priced.pricing;
    const amounts = calculateCodAdvanceAmounts(pricing.total);
    if (!amounts.success) return NextResponse.json({ success: false, error: amounts.error }, { status: 400 });
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) return NextResponse.json({ success: false, error: "Online payments are temporarily unavailable." }, { status: 503 });

    const paymentMethod = "COD Advance";
    const customerEmail = data.user.email;
    const snapshot = { customerName, customerEmail, customerPhone, subtotal: pricing.subtotal, shipping: pricing.shipping,
      discount: pricing.discount, total: pricing.total, paymentMethod, userId: data.user.id, items: pricing.items, address };
    const requestHash = createCheckoutRequestHash({ userId: data.user.id, customerEmail, paymentMethod,
      customerName, customerPhone, address, items: pricing.items, subtotal: pricing.subtotal,
      shipping: pricing.shipping, discount: pricing.discount, total: pricing.total });
    const idempotencyKey = scopeCheckoutIdempotencyKey(data.user.id, requestKey);
    const stored = await createCheckoutPaymentAttempt({ idempotencyKey, requestHash, customerEmail,
      userId: data.user.id, paymentMethod, purpose: "cod_advance", expectedAmountPaisa: 20_000, snapshot });
    if (stored.status === "conflict") return NextResponse.json({ success: false, error: "This checkout key was used with different details. Start checkout again." }, { status: 409 });
    const attempt = stored.attempt!;
    if (attempt.attempt_status === "converted") return NextResponse.json({ success: false, error: "This advance is already verified. Check your orders." }, { status: 409 });

    let providerOrderId = attempt.provider_order_id;
    if (providerOrderId && attempt.creation_state === "ready") {
      const outcome = classifyRazorpayOrderPayments(await getRazorpayClient().orders.fetchPayments(providerOrderId), {
        orderId: providerOrderId, amount: attempt.expected_amount_paisa,
      });
      if (outcome === "captured") return recoverCapturedAdvance(attempt);
      if (outcome === "authorized") return NextResponse.json({ success: false, error: "The advance payment is authorized and awaiting capture. Check again shortly." }, { status: 409 });
      if (!["none", "failed"].includes(outcome)) return NextResponse.json({ success: false, error: "Advance payment status needs reconciliation. Do not pay again yet." }, { status: 409 });
    }
    if (!providerOrderId || attempt.creation_state !== "ready") {
      const claim = await claimCheckoutProviderOrder(attempt.id);
      if (claim === "wait") return NextResponse.json({ success: false, error: "The advance payment setup is still processing. Retry shortly." }, { status: 202 });
      if (claim === "reconcile") {
        const current = await getCheckoutPaymentAttempt(attempt.id);
        providerOrderId = current?.provider_order_id ?? null;
        if (!providerOrderId) {
          try {
            const found = validateRazorpayOrderLookup(await findRazorpayOrdersByReceipt(attempt.receipt), {
              receipt: attempt.receipt, amount: attempt.expected_amount_paisa, orderId: attempt.id,
            });
            if (found.status === "found" && await attachCheckoutProviderOrder(attempt.id, found.razorpayOrderId)) providerOrderId = found.razorpayOrderId;
          } catch { /* uncertain provider state remains attached to this attempt for safe retry */ }
          if (!providerOrderId) return NextResponse.json({ success: false, error: "Advance setup needs reconciliation. Do not start another checkout." }, { status: 503 });
        }
      } else if (claim === "claimed") {
        try {
          const expected = { receipt: attempt.receipt, amount: attempt.expected_amount_paisa, orderId: attempt.id };
          const providerOrder = await getRazorpayClient().orders.create({ amount: expected.amount, currency: attempt.currency,
            receipt: expected.receipt, notes: { orderId: attempt.id, checkoutAttemptId: attempt.id, paymentPurpose: "cod_advance", customerEmail } });
          const checked = validateRazorpayOrderResponse(providerOrder, expected);
          if (!checked.valid || !await attachCheckoutProviderOrder(attempt.id, checked.razorpayOrderId)) {
            await setCheckoutAttemptCreationFailure(attempt.id, "unknown");
            return NextResponse.json({ success: false, error: "Advance order details could not be safely matched." }, { status: 503 });
          }
          providerOrderId = checked.razorpayOrderId;
        } catch (providerError) {
          const failure = classifyRazorpayOrderCreateFailure(providerError);
          await setCheckoutAttemptCreationFailure(attempt.id, failure === "retryable" ? "retryable" : "unknown");
          if (failure === "unknown") {
            try {
              const found = validateRazorpayOrderLookup(await findRazorpayOrdersByReceipt(attempt.receipt), { receipt: attempt.receipt, amount: 20_000, orderId: attempt.id });
              if (found.status === "found" && await attachCheckoutProviderOrder(attempt.id, found.razorpayOrderId)) providerOrderId = found.razorpayOrderId;
            } catch { /* keep ambiguous payment setup for reconciliation */ }
          }
          if (!providerOrderId) return NextResponse.json({ success: false, error: "Unable to safely initialize COD Advance. Retry the same checkout shortly." }, { status: failure === "retryable" ? 502 : 503 });
        }
      }
    }
    if (providerOrderId) {
      const outcome = classifyRazorpayOrderPayments(await getRazorpayClient().orders.fetchPayments(providerOrderId), {
        orderId: providerOrderId, amount: attempt.expected_amount_paisa,
      });
      if (outcome === "captured") return recoverCapturedAdvance(attempt);
      if (outcome === "authorized") return NextResponse.json({ success: false, error: "The advance payment is authorized and awaiting capture. Check again shortly." }, { status: 409 });
      if (!["none", "failed"].includes(outcome)) return NextResponse.json({ success: false, error: "Advance payment status needs reconciliation. Do not pay again yet." }, { status: 409 });
    }
    return NextResponse.json({ success: true, orderId: attempt.id, checkoutAttemptId: attempt.id,
      paymentAttemptId: attempt.id, razorpayOrderId: providerOrderId, amount: 20_000, currency: "INR",
      keyId: RAZORPAY_KEY_ID, total: pricing.total, balanceDue: amounts.balanceDue,
      pricing: { subtotal: pricing.subtotal, shipping: pricing.shipping, discount: pricing.discount, total: pricing.total },
      replayed: stored.status === "replayed" }, { status: stored.status === "created" ? 201 : 200 });
  } catch (error) {
    if (error instanceof InventoryUnavailableError) return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    console.error("[COD Advance] Checkout initialization failed.", error);
    return NextResponse.json({ success: false, error: "Unable to initialize COD Advance. Please retry the same checkout." }, { status: 500 });
  }
}
