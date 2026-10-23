import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOrderById, getPaymentAttemptById, logPaymentAudit, markCodAdvanceAsVerified, updateCodAdvancePaymentState } from "@/lib/db/orders";
import { getRazorpayClient, isPaymentCaptured, isVerifiedPaymentDetails, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, verifyPaymentSignature } from "@/lib/razorpay";
import { dispatchAllOrderNotifications, persistPaymentNotificationJobs } from "@/services/notification-service";
import { createClient } from "@/lib/supabase/server";
import { convertCapturedCheckoutAttempt, getCheckoutPaymentAttempt, updateCheckoutAttemptPaymentState } from "@/services/checkout-payment-attempts";

const VerifySchema = z.object({
  orderId: z.string().min(1), paymentAttemptId: z.string().min(1),
  razorpayOrderId: z.string().min(1), razorpayPaymentId: z.string().min(1), razorpaySignature: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = VerifySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid payment verification request." }, { status: 400 });
    const { orderId, paymentAttemptId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = parsed.data;
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user?.id) return NextResponse.json({ error: "Please sign in to verify this COD Advance payment." }, { status: 401 });
    const checkoutAttempt = await getCheckoutPaymentAttempt(orderId);
    if (checkoutAttempt) {
      if (checkoutAttempt.user_id !== authData.user.id || checkoutAttempt.id !== paymentAttemptId ||
        checkoutAttempt.purpose !== "cod_advance" || checkoutAttempt.expected_amount_paisa !== 20_000 ||
        checkoutAttempt.currency !== "INR" || checkoutAttempt.provider_order_id !== razorpayOrderId) {
        return NextResponse.json({ error: "Payment attempt does not match this COD Advance checkout." }, { status: 400 });
      }
      if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) return NextResponse.json({ error: "Payment verification is temporarily unavailable." }, { status: 503 });
      if (!verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature })) {
        await logPaymentAudit(null, "cod_advance_checkout_invalid_signature", { attemptId: checkoutAttempt.id, razorpayOrderId, razorpayPaymentId });
        return NextResponse.json({ error: "Payment signature could not be verified." }, { status: 400 });
      }
      try {
        const payment = await getRazorpayClient().payments.fetch(razorpayPaymentId);
        if (!isVerifiedPaymentDetails(payment, razorpayOrderId, checkoutAttempt.expected_amount_paisa, razorpayPaymentId) || payment.currency !== checkoutAttempt.currency) {
          await logPaymentAudit(null, "cod_advance_checkout_payment_mismatch", {
            attemptId: checkoutAttempt.id, receivedAmount: payment.amount, receivedCurrency: payment.currency,
          });
          return NextResponse.json({ error: "Payment details do not match the ₹200 COD Advance." }, { status: 400 });
        }
        if (!isPaymentCaptured(payment.status) || payment.captured !== true) {
          const providerStatus = String(payment.status);
          const state = providerStatus === "failed" ? "failed" : providerStatus === "cancelled" ? "cancelled" : providerStatus === "authorized" ? "authorized" : "reconciliation_required";
          await updateCheckoutAttemptPaymentState(checkoutAttempt.id, payment.id, state);
          return NextResponse.json({ error: "The advance payment is not captured. No order was created; do not pay again until status is clear." }, { status: 409 });
        }
        await updateCheckoutAttemptPaymentState(checkoutAttempt.id, payment.id, "captured", razorpaySignature);
        const converted = await convertCapturedCheckoutAttempt({ attemptId: checkoutAttempt.id,
          providerOrderId: razorpayOrderId, providerPaymentId: payment.id, signature: razorpaySignature });
        if (!converted.success || !converted.orderId) {
          await logPaymentAudit(null, "cod_advance_checkout_capture_requires_reconciliation", { attemptId: checkoutAttempt.id, paymentId: payment.id });
          return NextResponse.json({ error: "The ₹200 was captured but the order needs reconciliation. Contact support; do not pay again." }, { status: 409 });
        }
        await persistPaymentNotificationJobs(converted.orderId, async () => {
          const refreshed = await getOrderById(converted.orderId!);
          if (!refreshed) throw new Error("Converted COD Advance order could not be reloaded.");
          return dispatchAllOrderNotifications(refreshed);
        });
        const snapshot = checkoutAttempt.checkout_snapshot as { total: number };
        return NextResponse.json({ success: true, orderId: converted.orderId, orderNumber: converted.orderNumber,
          advancePaid: 200, balanceDue: snapshot.total - 200, total: snapshot.total, alreadyVerified: converted.alreadyConverted });
      } catch (providerError) {
        console.error("[COD Advance] Unable to verify provider payment.", providerError);
        return NextResponse.json({ error: "Unable to verify COD Advance payment." }, { status: 503 });
      }
    }
    const order = await getOrderById(orderId);
    const attempt = await getPaymentAttemptById(paymentAttemptId);
    if (!order || order.user_id !== authData.user.id || !attempt || attempt.order_id !== order.id || attempt.purpose !== "cod_advance" ||
      attempt.amount_paisa !== 20000 || attempt.currency !== "INR" || attempt.razorpay_order_id !== razorpayOrderId ||
      order.current_payment_attempt_id !== attempt.id || order.payment_method !== "COD Advance") {
      return NextResponse.json({ error: "Payment attempt does not match this COD Advance order." }, { status: 400 });
    }
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) return NextResponse.json({ error: "Payment verification is temporarily unavailable." }, { status: 503 });
    if (!verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature })) {
      await logPaymentAudit(order.id, "cod_advance_invalid_signature", { attemptId: attempt.id, razorpayOrderId, razorpayPaymentId });
      return NextResponse.json({ error: "Payment signature could not be verified." }, { status: 400 });
    }

    let payment;
    try { payment = await getRazorpayClient().payments.fetch(razorpayPaymentId); }
    catch { await updateCodAdvancePaymentState(attempt.id, razorpayPaymentId, "unknown", "provider_fetch_failed");
      return NextResponse.json({ error: "Payment status is unclear. Do not retry yet; we are checking the payment." }, { status: 503 }); }

    if (!isVerifiedPaymentDetails(payment, razorpayOrderId, 20000, razorpayPaymentId)) {
      await logPaymentAudit(order.id, "cod_advance_payment_details_mismatch", {
        attemptId: attempt.id, paymentOrderId: payment.order_id, receivedAmount: payment.amount, receivedCurrency: payment.currency,
      });
      return NextResponse.json({ error: "Payment details do not match the ₹200 COD Advance." }, { status: 400 });
    }
    if (!isPaymentCaptured(payment.status) || payment.captured !== true) {
      if (payment.status === "authorized") {
        await updateCodAdvancePaymentState(attempt.id, payment.id, "authorized", "awaiting_capture");
        return NextResponse.json({ error: "Payment is authorized but not captured yet. Do not pay again; check order status shortly." }, { status: 409 });
      }
      await updateCodAdvancePaymentState(attempt.id, payment.id, payment.status === "failed" ? "failed" : "unknown", payment.status);
      return NextResponse.json({ error: payment.status === "failed" ? "Advance payment failed. You can retry this same checkout." : "Payment is still pending or unclear. Do not retry until status is confirmed." }, { status: 409 });
    }

    const result = await markCodAdvanceAsVerified({ attemptId: attempt.id, paymentId: payment.id, razorpayOrderId, signature: razorpaySignature });
    if (!result.success) {
      await logPaymentAudit(order.id, "cod_advance_captured_requires_reconciliation", { attemptId: attempt.id, paymentId: payment.id });
      return NextResponse.json({ error: "The ₹200 was captured but the order needs reconciliation. Contact support; do not pay again." }, { status: 409 });
    }
    if (!result.alreadyVerified) {
      await persistPaymentNotificationJobs(order.id, async () => {
        const refreshed = await getOrderById(order.id);
        if (!refreshed) throw new Error("Verified COD Advance order could not be reloaded.");
        return dispatchAllOrderNotifications(refreshed);
      });
    }
    return NextResponse.json({ success: true, orderId: order.id, orderNumber: order.order_number,
      advancePaid: 200, balanceDue: order.total - 200, total: order.total,
      alreadyVerified: result.alreadyVerified,
    });
  } catch (error) {
    console.error("[COD Advance] Payment verification failed.", error);
    return NextResponse.json({ error: "Unable to verify COD Advance payment." }, { status: 500 });
  }
}
