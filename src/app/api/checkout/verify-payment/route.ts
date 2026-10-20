import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOrderById, markOrderAsPaid, markOrderPaymentFailed, logPaymentAudit } from "@/lib/db/orders";
import {
  verifyPaymentSignature,
  getRazorpayClient,
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET,
} from "@/lib/razorpay";
import { dispatchAllOrderNotifications } from "@/services/notification-service";

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

    // Check matching Razorpay order ID
    if (!order.razorpay_order_id || order.razorpay_order_id !== razorpayOrderId) {
      await logPaymentAudit(order.id, "payment_mismatch_order_id", {
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
      await markOrderPaymentFailed(order.id, "Invalid payment signature");
      await logPaymentAudit(order.id, "invalid_signature", {
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      });
      return NextResponse.json(
        { error: "Payment verification failed: Invalid cryptographic signature" },
        { status: 400 }
      );
    }

    // Confirm payment details with Razorpay before updating the local order.
    try {
      const rzp = getRazorpayClient();
      const payment = await rzp.payments.fetch(razorpayPaymentId);
      const expectedPaisa = Math.round(order.total * 100);

      if (
        payment.order_id !== razorpayOrderId ||
        payment.amount !== expectedPaisa ||
        payment.currency !== "INR"
      ) {
        await logPaymentAudit(order.id, "payment_details_mismatch", {
          razorpayOrderId,
          paymentOrderId: payment.order_id,
          expectedAmount: expectedPaisa,
          receivedAmount: payment.amount,
          receivedCurrency: payment.currency,
        });
        await markOrderPaymentFailed(order.id, "Payment details do not match order");
        return NextResponse.json(
          { error: "Payment details do not match the order." },
          { status: 400 }
        );
      }

      if (payment.status !== "captured" && payment.status !== "authorized") {
        await markOrderPaymentFailed(order.id, `Payment status is ${payment.status}`);
        return NextResponse.json(
          { error: `Payment is not successful (status: ${payment.status})` },
          { status: 400 }
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
    const updateResult = await markOrderAsPaid(order.id, razorpayPaymentId, razorpaySignature);

    await logPaymentAudit(order.id, "payment_verified_and_paid", {
      razorpayPaymentId,
      amount: order.total,
    });

    // 6. Send transactional confirmation email asynchronously (Customer, Admin, Seller)
    const refreshedOrder = await getOrderById(order.id) || order;
    dispatchAllOrderNotifications(refreshedOrder).catch((err) => {
      console.error("Order notification dispatch error:", err);
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
