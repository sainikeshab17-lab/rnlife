import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, isVerifiedCapturedWebhookPayment, RAZORPAY_WEBHOOK_SECRET } from "@/lib/razorpay";
import {
  getOrderByRazorpayOrderId,
  getOrderById,
  markOrderAsPaid,
  logPaymentAudit,
} from "@/lib/db/orders";
import { dispatchAllOrderNotifications } from "@/services/notification-service";
import { getDb } from "@/lib/db";

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
      const rzpPaymentId = paymentEntity?.id;
      const notesOrderId = paymentEntity?.notes?.orderId || orderEntity?.notes?.orderId;

      // Only a signed, captured payment entity can transition an order to paid.
      // `order.paid` snapshots may not contain the payment entity, so those are
      // acknowledged without changing local payment state.
      if (
        !isVerifiedCapturedWebhookPayment(paymentEntity)
      ) {
        await logPaymentAudit(null, `webhook_unverified_${eventType}`, {
          rzpOrderId,
          rzpPaymentId,
          status: paymentEntity?.status,
        });
        return NextResponse.json({ status: "ignored_unverified_payment" });
      }
      if (orderEntity?.id && orderEntity.id !== rzpOrderId) {
        await logPaymentAudit(null, "webhook_entities_order_id_mismatch", {
          paymentOrderId: rzpOrderId,
          orderEntityId: orderEntity.id,
        });
        return NextResponse.json({ error: "Webhook payment and order entities do not match." }, { status: 400 });
      }

      let order = notesOrderId ? await getOrderById(notesOrderId) : null;
      if (!order && rzpOrderId) {
        order = await getOrderByRazorpayOrderId(rzpOrderId);
      }

      if (order) {
        if (order.razorpay_order_id !== rzpOrderId) {
          const expectedPaisa = Math.round(order.total * 100);
          if (paymentEntity.amount === expectedPaisa) {
            await logPaymentAudit(order.id, "stale_payment_attempt_captured", {
              expected: order.razorpay_order_id,
              received: rzpOrderId,
              paymentId: rzpPaymentId,
              requiresManualReconciliation: true,
            });
            return NextResponse.json({ status: "stale_payment_attempt_requires_reconciliation" });
          }
          await logPaymentAudit(order.id, "webhook_order_id_mismatch", {
            expected: order.razorpay_order_id,
            received: rzpOrderId,
          });
          return NextResponse.json({ error: "Payment order does not match." }, { status: 400 });
        }

        await logPaymentAudit(order.id, `webhook_${eventType}`, {
          event: eventType,
          paymentId: rzpPaymentId,
        });

        const expectedPaisa = Math.round(order.total * 100);
        if (paymentEntity.amount !== expectedPaisa) {
          await logPaymentAudit(order.id, "webhook_amount_mismatch", {
            expected: expectedPaisa,
            received: paymentEntity.amount,
          });
          return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
        }

        const result = await markOrderAsPaid(order.id, rzpPaymentId, rzpOrderId);
        if (!result.success) {
          await logPaymentAudit(order.id, "captured_payment_requires_reconciliation", {
            paymentId: rzpPaymentId,
            alreadyPaid: result.alreadyPaid,
          });
          return NextResponse.json({ status: "captured_payment_requires_reconciliation" });
        }
        const refreshed = await getOrderById(order.id);
        if (!refreshed) throw new Error("Paid order could not be reloaded for notification processing.");
        const notificationJobs = await dispatchAllOrderNotifications(refreshed);
        if (notificationJobs.failed > 0) {
          return NextResponse.json({ error: "Payment recorded; notification jobs require retry." }, { status: 500 });
        }
      } else {
        await logPaymentAudit(null, `webhook_unmatched_${eventType}`, { rzpOrderId, notesOrderId });
      }
    } else if (eventType === "payment.failed") {
      const paymentEntity = payload.payment?.entity;
      const rzpOrderId = paymentEntity?.order_id;
      const notesOrderId = paymentEntity?.notes?.orderId;

      let order = notesOrderId ? await getOrderById(notesOrderId) : null;
      if (!order && rzpOrderId) {
        order = await getOrderByRazorpayOrderId(rzpOrderId);
      }

        if (order) {
        await logPaymentAudit(order.id, "webhook_payment_failed", {
          paymentId: paymentEntity?.id,
          status: paymentEntity?.status,
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

      let order = notesOrderId ? await getOrderById(notesOrderId) : null;
      if (!order && paymentId) {
        const found = await getDb().prepare("SELECT * FROM orders WHERE razorpay_payment_id = ?").get<{ id: string }>(paymentId);
        if (found) order = await getOrderById(found.id);
      }

      if (order) {
        await logPaymentAudit(order.id, `webhook_${eventType}`, { refundId, amount, paymentId });

        if (typeof refundId !== "string" || typeof paymentId !== "string" || !Number.isFinite(amount) || amount <= 0) {
          return NextResponse.json({ error: "Invalid refund event details" }, { status: 400 });
        }
        const db = getDb();
        const now = new Date().toISOString();

        // Update refund record status if exists, or insert
        const existingRef = await db
          .prepare("SELECT * FROM refund_records WHERE razorpay_refund_id = ? AND order_id = ?")
          .get<{ id: string }>(refundId, order.id);

        if (existingRef) {
          await db.prepare(`
            UPDATE refund_records
            SET status = 'processed', updated_at = ?
            WHERE razorpay_refund_id = ? AND order_id = ?
          `).run(now, refundId, order.id);
        } else {
          await db.prepare(`
            INSERT INTO refund_records (
              id, order_id, razorpay_refund_id, razorpay_payment_id,
              amount, amount_paisa, currency, status, reason, idempotency_key,
              initiated_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'INR', 'processed', 'Webhook reconciliation',
              ?, 'razorpay_webhook', ?, ?)
            ON CONFLICT (idempotency_key) DO UPDATE
            SET status = 'processed', updated_at = EXCLUDED.updated_at
          `).run(
            `ref_${refundId}`,
            order.id,
            refundId,
            paymentId,
            amount,
            Math.round(amount * 100),
            `rzp_refund_${refundId}`,
            now,
            now
          );
        }

        // If total refunds equal or exceed order total, mark order as refunded
        const totalRefundedRow = await db
          .prepare("SELECT COALESCE(SUM(amount), 0) as total FROM refund_records WHERE order_id = ? AND status = 'processed'")
          .get<{ total: string | number }>(order.id);

        if (Number(totalRefundedRow?.total ?? 0) >= order.total) {
          await db.prepare(`
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
        const db = getDb();
        await db.prepare(`
          UPDATE refund_records
          SET status = 'failed', failure_reason = ?, updated_at = ?
          WHERE razorpay_refund_id = ?
        `).run(failureReason, new Date().toISOString(), refundId);
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (err: unknown) {
    console.error("Error processing Razorpay webhook:", err);
    return NextResponse.json(
      { error: "Internal server error processing webhook" },
      { status: 500 }
    );
  }
}
