import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOrderById, markOrderAsPaid, markOrderPaymentFailed, logPaymentAudit } from "@/lib/db/orders";
import {
  verifyPaymentSignature,
  getRazorpayClient,
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET,
} from "@/lib/razorpay";
import { sendOrderConfirmationEmail } from "@/services/notification-service";

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
    const order = getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Check matching Razorpay order ID
    if (order.razorpay_order_id && order.razorpay_order_id !== razorpayOrderId) {
      logPaymentAudit(order.id, "payment_mismatch_order_id", {
        expected: order.razorpay_order_id,
        received: razorpayOrderId,
      });
      return NextResponse.json(
        { error: "Payment does not correspond to the requested order" },
        { status: 400 }
      );
    }

    // 2. If order is already paid, return success (Idempotent)
    if (order.payment_status === "paid") {
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        orderId: order.id,
        orderNumber: order.order_number,
        guestToken: order.guest_token,
      });
    }

    const hasRealRazorpayKeys =
      RAZORPAY_KEY_ID !== "rzp_test_placeholder_key" &&
      RAZORPAY_KEY_SECRET !== "rzp_test_placeholder_secret";

    // 3. Verify cryptographic HMAC signature
    let isSignatureValid = false;
    if (hasRealRazorpayKeys) {
      isSignatureValid = verifyPaymentSignature({
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      });
    } else {
      // In local dev test mode with placeholder keys, allow verified test signatures
      isSignatureValid =
        razorpaySignature === "test_signature_mock" ||
        verifyPaymentSignature({
          razorpayOrderId,
          razorpayPaymentId,
          razorpaySignature,
          secret: RAZORPAY_KEY_SECRET,
        });
    }

    if (!isSignatureValid) {
      markOrderPaymentFailed(order.id, "Invalid payment signature");
      logPaymentAudit(order.id, "invalid_signature", {
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      });
      return NextResponse.json(
        { error: "Payment verification failed: Invalid cryptographic signature" },
        { status: 400 }
      );
    }

    // 4. Server-to-server confirmation with Razorpay API (when real test keys are active)
    if (hasRealRazorpayKeys) {
      try {
        const rzp = getRazorpayClient();
        const payment = await rzp.payments.fetch(razorpayPaymentId);

        // Verify currency and amount matches expected order total (in paisa)
        const expectedPaisa = Math.round(order.total * 100);
        if (payment.amount !== expectedPaisa) {
          logPaymentAudit(order.id, "payment_amount_mismatch", {
            expected: expectedPaisa,
            received: payment.amount,
          });
          markOrderPaymentFailed(order.id, "Payment amount mismatch");
          return NextResponse.json(
            { error: "Payment amount does not match order total" },
            { status: 400 }
          );
        }

        if (payment.status !== "captured" && payment.status !== "authorized") {
          markOrderPaymentFailed(order.id, `Payment status is ${payment.status}`);
          return NextResponse.json(
            { error: `Payment is not successful (status: ${payment.status})` },
            { status: 400 }
          );
        }
      } catch (err: any) {
        console.error("Failed to verify payment with Razorpay API:", err);
        // If payment fetch failed, do not mark as paid
        return NextResponse.json(
          { error: "Unable to confirm payment status with Razorpay gateway" },
          { status: 502 }
        );
      }
    }

    // 5. Update database: Mark order as paid and commit inventory deduction
    const updateResult = markOrderAsPaid(order.id, razorpayPaymentId, razorpaySignature);

    logPaymentAudit(order.id, "payment_verified_and_paid", {
      razorpayPaymentId,
      amount: order.total,
    });

    // 6. Send transactional confirmation email asynchronously
    const refreshedOrder = getOrderById(order.id) || order;
    sendOrderConfirmationEmail(refreshedOrder).catch((err) => {
      console.error("Email notification dispatch error:", err);
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.order_number,
      guestToken: order.guest_token,
      alreadyPaid: updateResult.alreadyPaid,
    });
  } catch (err: any) {
    console.error("Error in /api/checkout/verify-payment:", err);
    return NextResponse.json(
      { error: "Internal server error occurred while verifying payment" },
      { status: 500 }
    );
  }
}
