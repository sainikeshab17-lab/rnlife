import { NextRequest, NextResponse } from "next/server";
import {
  CheckoutIdempotencyKeySchema, CreateCheckoutOrderSchema,
  createCheckoutRequestHash,
} from "@/services/checkout-service";
import { calculateConfiguredOrderPricing } from "@/services/configured-checkout-pricing";
import { scopeCheckoutIdempotencyKey } from "@/lib/db/orders";
import { createClient } from "@/lib/supabase/server";
import { findRazorpayOrdersByReceipt, getRazorpayClient, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } from "@/lib/razorpay";
import {
  attachCheckoutProviderOrder, claimCheckoutProviderOrder, createCheckoutPaymentAttempt,
  getCheckoutPaymentAttempt, reconcileCapturedCheckoutAttempt, setCheckoutAttemptCreationFailure,
} from "@/services/checkout-payment-attempts";
import { dispatchAllOrderNotifications, persistPaymentNotificationJobs } from "@/services/notification-service";
import { getOrderById } from "@/lib/db/orders";
import {
  classifyRazorpayOrderCreateFailure, classifyRazorpayOrderPayments,
  validateRazorpayOrderLookup, validateRazorpayOrderResponse,
} from "@/services/razorpay-order-recovery";

const RequestSchema = CreateCheckoutOrderSchema.extend({ idempotencyKey: CheckoutIdempotencyKeySchema });
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const parsed = RequestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid checkout request", details: parsed.error.flatten().fieldErrors }, { status: 400 });
    const { customerName, customerEmail: submittedEmail, customerPhone, address, items, promoCode, idempotencyKey: requestKey } = parsed.data;
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const customerEmail = data.user?.email ?? submittedEmail;
    const userId = data.user?.id ?? null;
    const priced = await calculateConfiguredOrderPricing(items, promoCode);
    if (!priced.success) return NextResponse.json({ error: priced.error }, { status: 400 });
    const pricing = priced.pricing;
    const amountPaisa = Math.round(pricing.total * 100);
    if (!Number.isSafeInteger(amountPaisa) || amountPaisa < 100) return NextResponse.json({ error: "The minimum online payment is ₹1." }, { status: 400 });
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) return NextResponse.json({ error: "Online payments are temporarily unavailable." }, { status: 503 });

    const paymentMethod = "Razorpay (UPI / Cards / NetBanking)";
    const snapshot = {
      customerName, customerEmail, customerPhone,
      subtotal: pricing.subtotal, shipping: pricing.shipping, discount: pricing.discount, total: pricing.total,
      paymentMethod, userId, items: pricing.items, address,
    };
    const requestHash = createCheckoutRequestHash({
      userId, customerEmail, paymentMethod, customerName, customerPhone, address,
      items: pricing.items, subtotal: pricing.subtotal, shipping: pricing.shipping,
      discount: pricing.discount, total: pricing.total,
    });
    const idempotencyKey = scopeCheckoutIdempotencyKey(userId ?? customerEmail, requestKey);
    const stored = await createCheckoutPaymentAttempt({
      idempotencyKey, requestHash, customerEmail, userId, paymentMethod,
      purpose: "full_payment", expectedAmountPaisa: amountPaisa, snapshot,
    });
    if (stored.status === "conflict") return NextResponse.json({ error: "This checkout key was already used with different details. Start a new checkout." }, { status: 409 });
    const attempt = stored.attempt!;
    if (attempt.attempt_status === "converted") return NextResponse.json({ error: "This payment is already complete. Check your orders." }, { status: 409 });

    let providerOrderId = attempt.provider_order_id;
    if (providerOrderId && attempt.creation_state === "ready") {
      const outcome = classifyRazorpayOrderPayments(await getRazorpayClient().orders.fetchPayments(providerOrderId), {
        orderId: providerOrderId, amount: attempt.expected_amount_paisa,
      });
      if (outcome === "captured") {
        const confirmed = await reconcileCapturedCheckoutAttempt(attempt);
        if (confirmed?.success && confirmed.orderId) {
          await persistPaymentNotificationJobs(confirmed.orderId, async () => {
            const order = await getOrderById(confirmed.orderId!);
            if (!order) throw new Error("Recovered order could not be loaded for notifications.");
            return dispatchAllOrderNotifications(order);
          });
          return NextResponse.json({ error: `Payment was captured and order ${confirmed.orderNumber} is confirmed. Check My Orders.` }, { status: 409 });
        }
        return NextResponse.json({ error: "Payment was captured but needs reconciliation. Do not pay again." }, { status: 409 });
      }
      if (outcome === "authorized") return NextResponse.json({ error: "Payment is authorized and awaiting confirmation. Check again shortly." }, { status: 409 });
      if (!["none", "failed"].includes(outcome)) return NextResponse.json({ error: "Payment status needs reconciliation. Do not pay again yet." }, { status: 409 });
    } else {
      const claim = await claimCheckoutProviderOrder(attempt.id);
      if (claim === "wait") return NextResponse.json({ error: "Payment setup is still processing. Retry shortly." }, { status: 202 });
      if (claim === "reconcile") {
        const latest = await getCheckoutPaymentAttempt(attempt.id);
        if (latest?.provider_order_id && latest.creation_state === "ready") providerOrderId = latest.provider_order_id;
        else {
          try {
            const lookup = validateRazorpayOrderLookup(await findRazorpayOrdersByReceipt(attempt.receipt), {
              receipt: attempt.receipt, amount: attempt.expected_amount_paisa, orderId: attempt.id,
            });
            if (lookup.status === "found" && await attachCheckoutProviderOrder(attempt.id, lookup.razorpayOrderId)) providerOrderId = lookup.razorpayOrderId;
          } catch { /* uncertain provider state remains attached to this attempt for safe retry */ }
          if (!providerOrderId) return NextResponse.json({ error: "Payment setup needs reconciliation. Do not start another checkout." }, { status: 503 });
        }
      } else if (claim === "claimed") {
        try {
          const expected = { receipt: attempt.receipt, amount: attempt.expected_amount_paisa, orderId: attempt.id };
          const providerOrder = await getRazorpayClient().orders.create({
            amount: expected.amount, currency: attempt.currency, receipt: expected.receipt,
            notes: { orderId: attempt.id, checkoutAttemptId: attempt.id, customerEmail: attempt.customer_email },
          });
          const checked = validateRazorpayOrderResponse(providerOrder, expected);
          if (!checked.valid || !await attachCheckoutProviderOrder(attempt.id, checked.razorpayOrderId)) {
            await setCheckoutAttemptCreationFailure(attempt.id, "unknown");
            return NextResponse.json({ error: "Razorpay order details could not be safely matched." }, { status: 503 });
          }
          providerOrderId = checked.razorpayOrderId;
        } catch (error) {
          const failure = classifyRazorpayOrderCreateFailure(error);
          await setCheckoutAttemptCreationFailure(attempt.id, failure === "retryable" ? "retryable" : "unknown");
          if (failure === "unknown") {
            try {
              const lookup = validateRazorpayOrderLookup(await findRazorpayOrdersByReceipt(attempt.receipt), {
                receipt: attempt.receipt, amount: attempt.expected_amount_paisa, orderId: attempt.id,
              });
              if (lookup.status === "found" && await attachCheckoutProviderOrder(attempt.id, lookup.razorpayOrderId)) providerOrderId = lookup.razorpayOrderId;
            } catch { /* ambiguous provider state stays durable for reconciliation */ }
          }
          if (!providerOrderId) return NextResponse.json({ error: "Unable to safely initialize payment. Retry this same checkout shortly." }, { status: failure === "retryable" ? 502 : 503 });
        }
      }
    }
    if (!providerOrderId) return NextResponse.json({ error: "Payment order is not ready." }, { status: 503 });
    const latest = await getCheckoutPaymentAttempt(attempt.id);
    return NextResponse.json({
      success: true, checkoutAttemptId: attempt.id, orderId: attempt.id,
      razorpayOrderId: providerOrderId, amount: attempt.expected_amount_paisa, currency: attempt.currency,
      keyId: RAZORPAY_KEY_ID, guestToken: attempt.user_id === null ? attempt.guest_token : undefined,
      pricing: { subtotal: pricing.subtotal, shipping: pricing.shipping, discount: pricing.discount, total: pricing.total },
      customer: { name: customerName, email: customerEmail, phone: customerPhone },
      replayed: stored.status === "replayed", attemptStatus: latest?.attempt_status,
    }, { status: stored.status === "created" ? 201 : 200 });
  } catch (error) {
    console.error("Error in /api/checkout/create-order:", error);
    return NextResponse.json({ error: "Unable to initiate payment. Please retry the same checkout." }, { status: 500 });
  }
}
