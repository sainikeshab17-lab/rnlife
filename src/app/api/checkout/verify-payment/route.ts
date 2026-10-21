import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOrderById, markOrderAsPaid, logPaymentAudit, recordPaymentAttemptFailure } from "@/lib/db/orders";
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

const VerifyPaymentSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  razorpayOrderId: z.string().min(1, "Razorpay Order ID is required"),
  razorpayPaymentId: z.string().min(1, "Razorpay Payment ID is required"),
  razorpaySignature: z.string().min(1, "Razorpay Signature is required"),
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

    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = validation.data;

    // 1. Fetch order from database
    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
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

      if (!isVerifiedPaymentDetails(payment, razorpayOrderId, expectedPaisa)) {
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
          { error: `Payment is not captured (status: ${payment.status}). The order remains pending; reopen checkout to retry the same order.` },
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
