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
    } else if (eventType === "refund.processed" || eventType === "refund.speed_changed") {
      const refundEntity = payload.refund?.entity;
      const paymentId = refundEntity?.payment_id;
      const refundId = refundEntity?.id;
      const amount = refundEntity?.amount ? refundEntity.amount / 100 : 0;
      const notesOrderId = refundEntity?.notes?.orderId;

      let order = notesOrderId ? getOrderById(notesOrderId) : null;
      if (!order && paymentId) {
        const db = (await import("@/lib/db")).getDb();
        const found = db.prepare("SELECT * FROM orders WHERE razorpay_payment_id = ?").get(paymentId) as any;
        if (found) order = getOrderById(found.id);
      }

      if (order) {
        logPaymentAudit(order.id, `webhook_${eventType}`, { refundId, amount, paymentId });

        const db = (await import("@/lib/db")).getDb();
        const now = new Date().toISOString();

        // Update refund record status if exists, or insert
        const existingRef = db
          .prepare("SELECT * FROM refund_records WHERE razorpay_refund_id = ?")
          .get(refundId) as any;

        if (existingRef) {
          db.prepare(`
            UPDATE refund_records
            SET status = 'processed', updated_at = ?
            WHERE razorpay_refund_id = ?
          `).run(now, refundId);
        } else {
          db.prepare(`
            INSERT INTO refund_records (
              id, order_id, razorpay_refund_id, razorpay_payment_id,
              amount, currency, status, reason, initiated_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 'INR', 'processed', 'Webhook reconciliation', 'razorpay_webhook', ?, ?)
          `).run(
            `ref_${refundId}`,
            order.id,
            refundId,
            paymentId || null,
            amount,
            now,
            now
          );
        }

        // If total refunds equal or exceed order total, mark order as refunded
        const totalRefundedRow = db
          .prepare("SELECT COALESCE(SUM(amount), 0) as total FROM refund_records WHERE order_id = ? AND status = 'processed'")
          .get(order.id) as { total: number };

        if (totalRefundedRow.total >= order.total) {
          db.prepare(`
            UPDATE orders
            SET order_status = 'refunded', refund_status = 'refunded', updated_at = ?
            WHERE id = ?
          `).run(now, order.id);
        }
      }
    } else if (eventType === "refund.failed") {
      const refundEntity = payload.refund?.entity;
      const refundId = refundEntity?.id;
      const failureReason = refundEntity?.error_description || "Refund failed by bank";

      if (refundId) {
        const db = (await import("@/lib/db")).getDb();
        db.prepare(`
          UPDATE refund_records
          SET status = 'failed', failure_reason = ?, updated_at = ?
          WHERE razorpay_refund_id = ?
        `).run(failureReason, new Date().toISOString(), refundId);
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
