import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOrderById, markOrderAsPaid, logPaymentAudit, recordPaymentAttemptFailure, isOrderOwnedByCustomer } from "@/lib/db/orders";
import {
  verifyPaymentSignature,
  getRazorpayClient,
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET,
  isPaymentCaptured,
  isVerifiedCapturedPaymentDetails,
  isVerifiedPaymentDetails,
} from "@/lib/razorpay";
import { dispatchAllOrderNotifications, persistPaymentNotificationJobs } from "@/services/notification-service";
import { createClient } from "@/lib/supabase/server";
import { convertCapturedCheckoutAttempt, getCheckoutPaymentAttempt, updateCheckoutAttemptPaymentState } from "@/services/checkout-payment-attempts";

const VerifyPaymentSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  razorpayOrderId: z.string().min(1, "Razorpay Order ID is required"),
  razorpayPaymentId: z.string().min(1, "Razorpay Payment ID is required"),
  razorpaySignature: z.string().min(1, "Razorpay Signature is required"),
  guestToken: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = VerifyPaymentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid payment verification payload", details: validation.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature, guestToken } = validation.data;

    // New checkout sessions live outside orders until the provider confirms capture.
    const checkoutAttempt = await getCheckoutPaymentAttempt(orderId);
    if (checkoutAttempt) {
      if (checkoutAttempt.user_id) {
        const supabase = await createClient();
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || authData.user?.id !== checkoutAttempt.user_id) return NextResponse.json({ error: "Payment attempt not found." }, { status: 404 });
      } else if (!guestToken || guestToken !== checkoutAttempt.guest_token) {
        return NextResponse.json({ error: "Payment attempt not found." }, { status: 404 });
      }
      if (!checkoutAttempt.provider_order_id || checkoutAttempt.provider_order_id !== razorpayOrderId) {
        return NextResponse.json({ error: "Payment does not match this checkout attempt." }, { status: 400 });
      }
      if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) return NextResponse.json({ error: "Payment verification is temporarily unavailable." }, { status: 503 });
      if (!verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature })) {
        await logPaymentAudit(null, "checkout_attempt_invalid_signature", { attemptId: checkoutAttempt.id, razorpayOrderId, razorpayPaymentId });
        return NextResponse.json({ error: "Payment verification failed: Invalid cryptographic signature" }, { status: 400 });
      }
      try {
        const payment = await getRazorpayClient().payments.fetch(razorpayPaymentId);
        if (!isVerifiedPaymentDetails(payment, razorpayOrderId, checkoutAttempt.expected_amount_paisa, razorpayPaymentId) ||
          payment.currency !== checkoutAttempt.currency) {
          await logPaymentAudit(null, "checkout_attempt_payment_details_mismatch", {
            attemptId: checkoutAttempt.id, expectedAmount: checkoutAttempt.expected_amount_paisa,
            receivedAmount: payment.amount, expectedCurrency: checkoutAttempt.currency,
            receivedCurrency: payment.currency, providerOrderId: payment.order_id,
          });
          return NextResponse.json({ error: "Payment details do not match this checkout." }, { status: 400 });
        }
        if (!isPaymentCaptured(payment.status) || payment.captured !== true) {
          const providerStatus = String(payment.status);
          const state = providerStatus === "failed" ? "failed" : providerStatus === "cancelled" ? "cancelled" : providerStatus === "authorized" ? "authorized" : "reconciliation_required";
          await updateCheckoutAttemptPaymentState(checkoutAttempt.id, razorpayPaymentId, state);
          return NextResponse.json({ error: providerStatus === "failed" || providerStatus === "cancelled"
            ? "Payment failed or was cancelled. No order was created; retry checkout if you still want to purchase."
            : "Payment is not captured yet. No order was created; check again shortly." }, { status: 409 });
        }
        await updateCheckoutAttemptPaymentState(checkoutAttempt.id, razorpayPaymentId, "captured", razorpaySignature);
        const conversion = await convertCapturedCheckoutAttempt({
          attemptId: checkoutAttempt.id, providerOrderId: razorpayOrderId,
          providerPaymentId: razorpayPaymentId, signature: razorpaySignature,
        });
        if (!conversion.success || !conversion.orderId) {
          await logPaymentAudit(null, "checkout_attempt_capture_requires_reconciliation", { attemptId: checkoutAttempt.id, razorpayPaymentId });
          return NextResponse.json({ error: "Payment was captured but the order needs reconciliation. Contact support; do not pay again." }, { status: 409 });
        }
        await persistPaymentNotificationJobs(conversion.orderId, async () => {
          const refreshed = await getOrderById(conversion.orderId!);
          if (!refreshed) throw new Error("Converted order could not be reloaded for notification processing.");
          return dispatchAllOrderNotifications(refreshed);
        });
        return NextResponse.json({ success: true, orderId: conversion.orderId, orderNumber: conversion.orderNumber,
          guestToken: checkoutAttempt.user_id === null ? conversion.guestToken : undefined,
          alreadyPaid: conversion.alreadyConverted, notificationStatus: "persisted" });
      } catch (error) {
        console.error("Failed to verify checkout attempt with Razorpay:", error);
        return NextResponse.json({ error: "Unable to confirm payment status with Razorpay gateway" }, { status: 503 });
      }
    }

    // 1. Fetch order from database
    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.user_id) {
      const supabase = await createClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user || !isOrderOwnedByCustomer(order, {
        userId: authData.user.id,
        email: authData.user.email,
        emailVerified: Boolean(authData.user.email_confirmed_at),
      })) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    } else if (!guestToken || guestToken !== order.guest_token) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      console.error("Razorpay server credentials are missing.");
      return NextResponse.json(
        { error: "Payment verification is temporarily unavailable." },
        { status: 500 }
      );
    }

    // 3. Verify cryptographic HMAC signature
    const isSignatureValid = verifyPaymentSignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    if (!isSignatureValid) {
      await logPaymentAudit(order.id, "invalid_signature", {
        razorpayOrderId,
        razorpayPaymentId,
      });
      return NextResponse.json(
        { error: "Payment verification failed: Invalid cryptographic signature" },
        { status: 400 }
      );
    }

    if (!order.razorpay_order_id || order.razorpay_order_id !== razorpayOrderId) {
      try {
        const stalePayment = await getRazorpayClient().payments.fetch(razorpayPaymentId);
        if (isVerifiedCapturedPaymentDetails(stalePayment, razorpayOrderId, Math.round(order.total * 100)) &&
            isPaymentCaptured(stalePayment.status) && stalePayment.captured === true) {
          await logPaymentAudit(order.id, "stale_payment_attempt_captured", { razorpayOrderId, razorpayPaymentId });
          return NextResponse.json({ error: "A prior payment attempt was captured and needs reconciliation." }, { status: 409 });
        }
      } catch (error: unknown) {
        console.error(`[Payment] Could not reconcile stale attempt for order ${order.id}.`, error);
      }
      await logPaymentAudit(order.id, "payment_mismatch_order_id", {
        expected: order.razorpay_order_id,
        received: razorpayOrderId,
      });
      return NextResponse.json({ error: "Payment does not correspond to the current order attempt." }, { status: 400 });
    }

    // Confirm payment details with Razorpay before updating the local order.
    try {
      const rzp = getRazorpayClient();
      const payment = await rzp.payments.fetch(razorpayPaymentId);
      const expectedPaisa = Math.round(order.total * 100);

      if (!isVerifiedPaymentDetails(payment, razorpayOrderId, expectedPaisa, razorpayPaymentId)) {
        await logPaymentAudit(order.id, "payment_details_mismatch", {
          razorpayOrderId,
          paymentOrderId: payment.order_id,
          expectedAmount: expectedPaisa,
          receivedAmount: payment.amount,
          receivedCurrency: payment.currency,
        });
        return NextResponse.json(
          { error: "Payment details do not match the order." },
          { status: 400 }
        );
      }

      if (!isPaymentCaptured(payment.status) || payment.captured !== true) {
        if (payment.status === "authorized") {
          await logPaymentAudit(order.id, "payment_authorized_pending_capture", {
            razorpayOrderId,
            razorpayPaymentId,
          });
          return NextResponse.json(
            { error: "Payment is authorized but not captured yet. Do not retry; check your order status shortly." },
            { status: 409 }
          );
        }
        await recordPaymentAttemptFailure(order.id, razorpayPaymentId, payment.status);
        return NextResponse.json(
          { error: String(payment.status) === "failed" || String(payment.status) === "cancelled"
            ? "Payment failed or was cancelled. The order remains pending; you can retry payment for this same order."
            : `Payment is not captured (status: ${payment.status}). The order remains pending; check its status before retrying.` },
          { status: 409 }
        );
      }
    } catch (error: unknown) {
      console.error("Failed to verify payment with Razorpay API:", error);
      return NextResponse.json(
        { error: "Unable to confirm payment status with Razorpay gateway" },
        { status: 500 }
      );
    }

    // 5. Update database: Mark order as paid and commit inventory deduction
    const updateResult = await markOrderAsPaid(order.id, razorpayPaymentId, razorpayOrderId, razorpaySignature);
    if (!updateResult.success) {
      await logPaymentAudit(order.id, "captured_payment_requires_reconciliation", {
        razorpayPaymentId,
        alreadyPaid: updateResult.alreadyPaid,
      });
      return NextResponse.json({ error: "Unable to record the verified payment." }, { status: 409 });
    }

    try {
      await logPaymentAudit(order.id, "payment_verified_and_paid", {
        razorpayPaymentId,
        amount: order.total,
      });
    } catch (error: unknown) {
      console.error(`[Payment] Captured order ${order.id} was committed, but its audit event could not be persisted:`, error);
    }

    // 6. Send transactional confirmation email asynchronously (Customer, Admin, Seller)
    const notificationJobsPersisted = await persistPaymentNotificationJobs(order.id, async () => {
      const refreshedOrder = await getOrderById(order.id);
      if (!refreshedOrder) throw new Error("Paid order could not be reloaded for notification processing.");
      return dispatchAllOrderNotifications(refreshedOrder);
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.order_number,
      ...(order.user_id === null ? { guestToken: order.guest_token } : {}),
      alreadyPaid: updateResult.alreadyPaid,
      notificationStatus: notificationJobsPersisted ? "persisted" : "reconciliation_required",
    });
  } catch (err: unknown) {
    console.error("Error in /api/checkout/verify-payment:", err);
    return NextResponse.json(
      { error: "Internal server error occurred while verifying payment" },
      { status: 500 }
    );
  }
}
