import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, RAZORPAY_WEBHOOK_SECRET } from "@/lib/razorpay";
import {
  getOrderByRazorpayOrderId,
  getOrderById,
  markOrderAsPaid,
  markOrderPaymentFailed,
  logPaymentAudit,
} from "@/lib/db/orders";
import { sendOrderConfirmationEmail } from "@/services/notification-service";

export async function POST(req: NextRequest) {
  try {
    // 1. Extract raw request body for cryptographic signature verification
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing x-razorpay-signature header" }, { status: 400 });
    }

    // 2. Verify signature against raw body using HMAC SHA256
    const isValid = verifyWebhookSignature(rawBody, signature, RAZORPAY_WEBHOOK_SECRET);
    if (!isValid) {
      console.warn("[Razorpay Webhook] Rejected webhook with invalid signature.");
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
    }

    // 3. Parse JSON event payload
    const event = JSON.parse(rawBody);
    const eventType = event.event;
    const payload = event.payload;

    console.info(`[Razorpay Webhook] Received verified event: ${eventType}`);

    // Handle payment.captured or order.paid
    if (eventType === "payment.captured" || eventType === "order.paid") {
      const paymentEntity = payload.payment?.entity;
      const orderEntity = payload.order?.entity;

      const rzpOrderId = paymentEntity?.order_id || orderEntity?.id;
      const rzpPaymentId = paymentEntity?.id || "webhook_captured";
      const notesOrderId = paymentEntity?.notes?.orderId || orderEntity?.notes?.orderId;

      let order = notesOrderId ? getOrderById(notesOrderId) : null;
      if (!order && rzpOrderId) {
        order = getOrderByRazorpayOrderId(rzpOrderId);
      }

      if (order) {
        logPaymentAudit(order.id, `webhook_${eventType}`, {
          event: eventType,
          paymentId: rzpPaymentId,
        });

        // Verify amount if payment entity exists
        if (paymentEntity?.amount) {
          const expectedPaisa = Math.round(order.total * 100);
          if (paymentEntity.amount !== expectedPaisa) {
            logPaymentAudit(order.id, "webhook_amount_mismatch", {
              expected: expectedPaisa,
              received: paymentEntity.amount,
            });
            return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
          }
        }

        const result = markOrderAsPaid(order.id, rzpPaymentId);
        if (!result.alreadyPaid) {
          const refreshed = getOrderById(order.id);
          if (refreshed) {
            sendOrderConfirmationEmail(refreshed).catch(console.error);
          }
        }
      } else {
        logPaymentAudit(null, `webhook_unmatched_${eventType}`, { rzpOrderId, notesOrderId });
      }
    } else if (eventType === "payment.failed") {
      const paymentEntity = payload.payment?.entity;
      const rzpOrderId = paymentEntity?.order_id;
      const notesOrderId = paymentEntity?.notes?.orderId;

      let order = notesOrderId ? getOrderById(notesOrderId) : null;
      if (!order && rzpOrderId) {
        order = getOrderByRazorpayOrderId(rzpOrderId);
      }

      if (order) {
        markOrderPaymentFailed(order.id, paymentEntity?.error_description || "Payment failed");
        logPaymentAudit(order.id, "webhook_payment_failed", {
          errorCode: paymentEntity?.error_code,
          description: paymentEntity?.error_description,
        });
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (err: any) {
    console.error("Error processing Razorpay webhook:", err);
    return NextResponse.json(
      { error: "Internal server error processing webhook" },
      { status: 500 }
    );
  }
}
