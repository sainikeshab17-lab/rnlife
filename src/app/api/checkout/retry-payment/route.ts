import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getOrderById,
  getPaymentAttemptById,
  isOrderOwnedByCustomer,
  logPaymentAudit,
  markCodAdvanceAsVerified,
  markOrderAsPaid,
} from "@/lib/db/orders";
import { createClient } from "@/lib/supabase/server";
import {
  getRazorpayClient,
  isVerifiedCapturedPaymentDetails,
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET,
} from "@/lib/razorpay";
import { classifyRazorpayOrderPayments } from "@/services/razorpay-order-recovery";
import { hasRequiredOrderPayment } from "@/services/order-payment-state";
import { dispatchAllOrderNotifications, persistPaymentNotificationJobs } from "@/services/notification-service";

const RequestSchema = z.object({ orderId: z.string().min(1), guestToken: z.string().optional() });

function capturedPaymentId(response: unknown): string | null {
  if (!response || typeof response !== "object") return null;
  const items = (response as { items?: unknown }).items;
  if (!Array.isArray(items)) return null;
  const captured = items.filter((item): item is { id: string; status: string; captured: boolean } =>
    Boolean(item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string" &&
      (item as { status?: unknown }).status === "captured" && (item as { captured?: unknown }).captured === true)
  );
  return captured.length === 1 ? captured[0].id : null;
}

async function persistConfirmedNotifications(orderId: string) {
  await persistPaymentNotificationJobs(orderId, async () => {
    const order = await getOrderById(orderId);
    if (!order) throw new Error("Verified order could not be reloaded for notification processing.");
    return dispatchAllOrderNotifications(order);
  });
}

export async function POST(request: NextRequest) {
  try {
    const parsed = RequestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid retry request." }, { status: 400 });

    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    const order = await getOrderById(parsed.data.orderId);
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    const accountOwner = Boolean(!error && data.user?.id && isOrderOwnedByCustomer(order, {
      userId: data.user.id,
      email: data.user.email,
      emailVerified: Boolean(data.user.email_confirmed_at),
    }));
    const guestOwner = order.user_id === null && Boolean(parsed.data.guestToken && parsed.data.guestToken === order.guest_token);
    if (!accountOwner && !guestOwner) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    const capturedAdvance = order.payment_attempts?.some((attempt) =>
      attempt.id === order.current_payment_attempt_id && attempt.purpose === "cod_advance" && attempt.payment_state === "captured"
    ) ?? false;
    if (hasRequiredOrderPayment(order.payment_method, order.payment_status, capturedAdvance)) {
      return NextResponse.json({ success: true, state: "confirmed" });
    }
    const isAdvance = order.payment_method === "COD Advance";
    if ((isAdvance && (order.payment_status !== "pending_advance" || order.order_status !== "pending_payment")) ||
        (!isAdvance && (order.payment_status !== "pending_payment" || order.order_status !== "pending_payment"))) {
      return NextResponse.json({ state: "reconciliation_required", error: "This order cannot be retried in its current state. Contact support before paying again." }, { status: 409 });
    }
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return NextResponse.json({ state: "verifying", error: "Payment recovery is temporarily unavailable. Check again shortly." }, { status: 503 });
    }

    let razorpayOrderId = order.razorpay_order_id;
    let paymentAttemptId: string | undefined;
    let amountPaisa = Math.round(order.total * 100);
    if (isAdvance) {
      const attempt = order.current_payment_attempt_id
        ? await getPaymentAttemptById(order.current_payment_attempt_id)
        : null;
      if (!attempt || attempt.order_id !== order.id || attempt.purpose !== "cod_advance" ||
          attempt.amount_paisa !== 20000 || attempt.currency !== "INR" ||
          attempt.creation_state !== "ready" || !attempt.razorpay_order_id || attempt.payment_state === "captured") {
        return NextResponse.json({ state: "reconciliation_required", error: "The COD Advance attempt needs reconciliation. Do not pay again." }, { status: 409 });
      }
      razorpayOrderId = attempt.razorpay_order_id;
      paymentAttemptId = attempt.id;
      amountPaisa = attempt.amount_paisa;
    }
    if (!razorpayOrderId) {
      return NextResponse.json({ state: "reconciliation_required", error: "The payment order is not ready. Do not start another checkout." }, { status: 409 });
    }

    const payments = await getRazorpayClient().orders.fetchPayments(razorpayOrderId);
    const outcome = classifyRazorpayOrderPayments(payments, { orderId: razorpayOrderId, amount: amountPaisa });

    if (outcome === "captured") {
      const paymentId = capturedPaymentId(payments);
      if (!paymentId) return NextResponse.json({ state: "verifying", error: "Payment was captured more than once or returned an unclear result. Do not pay again." }, { status: 409 });
      const payment = await getRazorpayClient().payments.fetch(paymentId);
      if (payment.id !== paymentId || !isVerifiedCapturedPaymentDetails(payment, razorpayOrderId, amountPaisa)) {
        await logPaymentAudit(order.id, "retry_payment_capture_mismatch", { paymentId, razorpayOrderId });
        return NextResponse.json({ state: "verifying", error: "Payment details need reconciliation. Do not pay again." }, { status: 409 });
      }

      let result: { success: boolean; transitioned: boolean };
      if (isAdvance) {
        const update = await markCodAdvanceAsVerified({ attemptId: paymentAttemptId!, paymentId, razorpayOrderId });
        result = { success: update.success, transitioned: !update.alreadyVerified };
      } else {
        const update = await markOrderAsPaid(order.id, paymentId, razorpayOrderId);
        result = { success: update.success, transitioned: !update.alreadyPaid };
      }
      if (!result.success) {
        await logPaymentAudit(order.id, "retry_payment_capture_requires_reconciliation", { paymentId, razorpayOrderId });
        return NextResponse.json({ state: "verifying", error: "Payment was captured but the order needs reconciliation. Do not pay again." }, { status: 409 });
      }
      if (result.transitioned) await persistConfirmedNotifications(order.id);
      return NextResponse.json({ success: true, state: "confirmed" });
    }

    if (outcome === "none" || outcome === "failed") {
      return NextResponse.json({
        success: true,
        state: "retryable",
        orderId: order.id,
        razorpayOrderId,
        paymentAttemptId,
        amount: amountPaisa,
        currency: "INR",
        keyId: RAZORPAY_KEY_ID,
        paymentPurpose: isAdvance ? "cod_advance" : "full_payment",
      });
    }

    return NextResponse.json({
      state: "verifying",
      error: outcome === "authorized"
        ? "Payment is authorized and awaiting confirmation. Do not pay again; check this order shortly."
        : "Payment status is unclear. Do not pay again until it is reconciled.",
    }, { status: 409 });
  } catch (error) {
    console.error("[Checkout] Payment retry/reconciliation failed.", error);
    return NextResponse.json({ state: "verifying", error: "Unable to confirm payment status. Do not pay again; check the order shortly." }, { status: 503 });
  }
}
