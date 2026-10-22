import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, isVerifiedCapturedWebhookPayment, RAZORPAY_WEBHOOK_SECRET } from "@/lib/razorpay";
import {
  getOrderByRazorpayOrderId,
  getOrderById,
  markOrderAsPaid,
  logPaymentAudit,
  getPaymentAttemptByRazorpayOrderId,
  markCodAdvanceAsVerified,
  updateCodAdvancePaymentState,
  recordRefund,
} from "@/lib/db/orders";
import { dispatchAllOrderNotifications, persistPaymentNotificationJobs, sendRefundConfirmationEmail } from "@/services/notification-service";
import { getDb } from "@/lib/db";
import { classifyRefundWebhook, getRefundWebhookIdempotencyKey, isProcessedRefundEvent, refundPaymentMatchesOrder, shouldMarkOrderRefunded } from "@/lib/order-status-machine";

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
      const paymentAttemptId = (paymentEntity as (typeof paymentEntity & { notes?: Record<string, string> }) | undefined)?.notes?.paymentAttemptId;

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

      const advanceAttempt = rzpOrderId ? await getPaymentAttemptByRazorpayOrderId(rzpOrderId) : null;
      if (advanceAttempt?.purpose === "cod_advance") {
        if (advanceAttempt.amount_paisa !== paymentEntity.amount || advanceAttempt.currency !== paymentEntity.currency ||
          (notesOrderId && notesOrderId !== advanceAttempt.order_id) ||
          (paymentAttemptId && paymentAttemptId !== advanceAttempt.id)) {
          await logPaymentAudit(advanceAttempt.order_id, "cod_advance_webhook_mismatch", {
            attemptId: advanceAttempt.id, paymentId: rzpPaymentId, amount: paymentEntity.amount, currency: paymentEntity.currency,
          });
          return NextResponse.json({ error: "COD Advance payment details do not match." }, { status: 400 });
        }
        const result = await markCodAdvanceAsVerified({
          attemptId: advanceAttempt.id, paymentId: rzpPaymentId, razorpayOrderId: rzpOrderId,
        });
        if (!result.success) {
          await logPaymentAudit(advanceAttempt.order_id, "cod_advance_captured_requires_reconciliation", { attemptId: advanceAttempt.id, paymentId: rzpPaymentId });
          return NextResponse.json({ status: "captured_payment_requires_reconciliation" });
        }
        if (!result.alreadyVerified) {
          await persistPaymentNotificationJobs(advanceAttempt.order_id, async () => {
            const refreshedOrder = await getOrderById(advanceAttempt.order_id);
            if (!refreshedOrder) throw new Error("COD Advance order could not be reloaded for notification.");
            return dispatchAllOrderNotifications(refreshedOrder);
          });
        }
        return NextResponse.json({ status: result.alreadyVerified ? "already_verified" : "cod_advance_verified" });
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

      if (typeof rzpOrderId === "string") {
        const attempt = await getPaymentAttemptByRazorpayOrderId(rzpOrderId);
        if (attempt?.purpose === "cod_advance") {
          if (paymentEntity?.amount !== attempt.amount_paisa || paymentEntity?.currency !== attempt.currency || typeof paymentEntity?.id !== "string") {
            await logPaymentAudit(attempt.order_id, "cod_advance_failed_webhook_mismatch", {
              attemptId: attempt.id, paymentId: paymentEntity?.id, amount: paymentEntity?.amount, currency: paymentEntity?.currency,
            });
            return NextResponse.json({ status: "cod_advance_failure_requires_reconciliation" });
          }
          await updateCodAdvancePaymentState(attempt.id, paymentEntity?.id ?? null, "failed", paymentEntity?.error_description || "provider_payment_failed");
          await logPaymentAudit(attempt.order_id, "cod_advance_payment_failed", { attemptId: attempt.id, paymentId: paymentEntity?.id, status: paymentEntity?.status });
          return NextResponse.json({ status: "cod_advance_payment_failed" });
        }
      }

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
      const amountPaisa = refundEntity?.amount;
      const amount = typeof amountPaisa === "number" ? amountPaisa / 100 : 0;
      const notesOrderId = refundEntity?.notes?.orderId;

      let order = notesOrderId ? await getOrderById(notesOrderId) : null;
      if (!order && paymentId) {
        const found = await getDb().prepare("SELECT * FROM orders WHERE razorpay_payment_id = ?").get<{ id: string }>(paymentId);
        if (found) order = await getOrderById(found.id);
      }

      const refundAction = order ? classifyRefundWebhook(order, paymentId) : null;
      if (order && refundAction === "quarantine") {
        await logPaymentAudit(order.id, "refund_webhook_payment_mismatch_quarantined", {
          eventType, refundId, receivedPaymentId: paymentId,
        });
        return NextResponse.json({ status: "refund_requires_reconciliation" });
      }

      if (!isProcessedRefundEvent(eventType, refundEntity?.status)) {
        if (order) await logPaymentAudit(order.id, `webhook_${eventType}_not_processed`, { refundId, status: refundEntity?.status });
        return NextResponse.json({ status: "refund_pending_provider_confirmation" });
      }

      if (order) {
        await logPaymentAudit(order.id, `webhook_${eventType}`, { refundId, amount, paymentId });

        if (typeof refundId !== "string" || typeof paymentId !== "string" || !Number.isSafeInteger(amountPaisa) || amountPaisa <= 0 || refundEntity?.currency !== "INR") {
          return NextResponse.json({ error: "Invalid refund event details" }, { status: 400 });
        }
        const db = getDb();
        const now = new Date().toISOString();

        // Update refund record status if exists, or insert
        const existingRef = await db
          .prepare("SELECT * FROM refund_records WHERE razorpay_refund_id = ? AND order_id = ?")
          .get<{ id: string; amount_paisa: number; return_id: string | null; idempotency_key: string }>(refundId, order.id);

        if (existingRef && existingRef.amount_paisa !== amountPaisa) {
          await logPaymentAudit(order.id, "refund_webhook_amount_mismatch_quarantined", {
            refundId, expectedAmountPaisa: existingRef.amount_paisa, receivedAmountPaisa: amountPaisa,
          });
          return NextResponse.json({ status: "refund_requires_reconciliation" });
        }

        const pendingForPayment = existingRef ? null : await db.prepare(`
          SELECT idempotency_key, amount_paisa, return_id FROM refund_records
          WHERE order_id = ? AND razorpay_payment_id = ? AND status = 'pending' AND razorpay_refund_id IS NULL
          ORDER BY created_at ASC LIMIT 1
        `).get<{ idempotency_key: string; amount_paisa: number; return_id: string | null }>(order.id, paymentId, amountPaisa);

        if (pendingForPayment && pendingForPayment.amount_paisa !== amountPaisa) {
          await logPaymentAudit(order.id, "refund_webhook_reservation_amount_mismatch_quarantined", {
            refundId, reservedAmountPaisa: pendingForPayment.amount_paisa, receivedAmountPaisa: amountPaisa,
          });
          return NextResponse.json({ status: "refund_requires_reconciliation" });
        }
        const pendingReservation = pendingForPayment;

        if (refundAction === "record_non_refundable") {
          if (existingRef) {
            await db.prepare(`
              UPDATE refund_records SET status = 'processed', updated_at = ?
              WHERE razorpay_refund_id = ? AND order_id = ? AND razorpay_payment_id = ?
            `).run(now, refundId, order.id, paymentId);
          } else {
            await db.prepare(`
              INSERT INTO refund_records (
                id, order_id, razorpay_refund_id, razorpay_payment_id,
                amount, amount_paisa, currency, status, reason, idempotency_key,
                initiated_by, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, 'INR', 'processed', 'Unexpected provider-side refund for non-refundable COD Advance; investigate',
                ?, 'razorpay_webhook_reconciliation', ?, ?)
              ON CONFLICT (idempotency_key) DO UPDATE
              SET status = 'processed', updated_at = EXCLUDED.updated_at
            `).run(
              `ref_${refundId}`, order.id, refundId, paymentId, amount, Math.round(amount * 100),
              getRefundWebhookIdempotencyKey(refundId), now, now
            );
          }
          await logPaymentAudit(order.id, "unexpected_cod_advance_refund_requires_investigation", {
            refundId, paymentId, amount, providerRefundAlreadyProcessed: true,
          });
          return NextResponse.json({ status: "unexpected_cod_advance_refund_requires_investigation" });
        }

        const reconciledRefund = await recordRefund({
          orderId: order.id,
          returnId: existingRef?.return_id ?? pendingReservation?.return_id ?? null,
          razorpayRefundId: refundId,
          razorpayPaymentId: paymentId,
          amount,
          status: "processed",
          reason: "Webhook reconciliation",
          initiatedBy: "razorpay_webhook",
          idempotencyKey: existingRef
            ? existingRef.idempotency_key
            : pendingReservation?.idempotency_key ?? getRefundWebhookIdempotencyKey(refundId),
        });

        // A terminal failed local record must never be described as processed
        // solely because a delayed or contradictory event says otherwise.
        if (reconciledRefund.status !== "processed") {
          await logPaymentAudit(order.id, "refund_processed_event_state_conflict", {
            refundId, localStatus: reconciledRefund.status,
          });
          return NextResponse.json({ status: "refund_requires_reconciliation" });
        }

        // If total refunds equal or exceed order total, mark order as refunded
        const totalRefundedRow = await db
          .prepare("SELECT COALESCE(SUM(amount_paisa), 0) as total FROM refund_records WHERE order_id = ? AND status = 'processed'")
          .get<{ total: string | number }>(order.id);

        const totalRefunded = Number(totalRefundedRow?.total ?? 0) / 100;
        if (shouldMarkOrderRefunded(order.payment_method, order.payment_status, totalRefunded, order.total)) {
          await db.prepare(`
            UPDATE orders
            SET order_status = 'refunded', refund_status = 'refunded', updated_at = ?
            WHERE id = ?
          `).run(now, order.id);
        } else if (totalRefunded > 0) {
          await db.prepare(`UPDATE orders SET refund_status = 'partially_refunded', refund_id = ?, updated_at = ? WHERE id = ?`)
            .run(refundId, now, order.id);
        }
        if (existingRef?.return_id) {
          await db.prepare("UPDATE returns SET status = 'completed', updated_at = ? WHERE id = ?")
            .run(now, existingRef.return_id);
        }
        await sendRefundConfirmationEmail(order, amount, refundId);
      }
    } else if (eventType === "refund.failed") {
      const refundEntity = payload.refund?.entity;
      const refundId = refundEntity?.id;
      const paymentId = refundEntity?.payment_id;
      const failureReason = refundEntity?.error_description || "Refund failed by bank";

      if (typeof refundId === "string" && typeof paymentId === "string") {
        const db = getDb();
        const amountPaisa = refundEntity?.amount;
        const refund = await db.prepare(`SELECT * FROM refund_records
          WHERE razorpay_refund_id = ? AND razorpay_payment_id = ?
          UNION ALL
          SELECT * FROM refund_records
          WHERE razorpay_payment_id = ? AND amount_paisa = ? AND status = 'pending' AND razorpay_refund_id IS NULL
          LIMIT 1`).get<{ id: string; order_id: string; razorpay_payment_id: string; amount_paisa: number; idempotency_key: string }>(
            refundId, paymentId, paymentId, amountPaisa
          );
        const refundOrder = refund ? await getOrderById(refund.order_id) : null;
        if (!Number.isSafeInteger(amountPaisa) || amountPaisa <= 0 || refundEntity?.currency !== "INR" ||
            !refund || refund.amount_paisa !== amountPaisa || !refundOrder || !refundPaymentMatchesOrder(paymentId, refund.razorpay_payment_id) ||
            !refundPaymentMatchesOrder(paymentId, refundOrder.razorpay_payment_id)) {
          await logPaymentAudit(refund?.order_id ?? null, "refund_failed_webhook_payment_mismatch_quarantined", {
            refundId, receivedPaymentId: paymentId,
          });
          return NextResponse.json({ status: "refund_requires_reconciliation" });
        }
        const failedTransition = await db.prepare(`
          UPDATE refund_records
          SET razorpay_refund_id = ?, status = 'failed', failure_reason = ?, updated_at = ?
          WHERE id = ? AND status = 'pending'
          RETURNING order_id
        `).run(refundId, failureReason, new Date().toISOString(), refund.id);
        if (failedTransition.rowCount === 1) {
          const processed = await db.prepare(`SELECT COALESCE(SUM(amount_paisa), 0) AS total
            FROM refund_records WHERE order_id = ? AND status = 'processed'`).get<{ total: string | number }>(refund.order_id);
          const processedTotal = Number(processed?.total ?? 0) / 100;
          const complete = shouldMarkOrderRefunded(refundOrder.payment_method, refundOrder.payment_status, processedTotal, refundOrder.total);
          await db.prepare(`UPDATE orders SET refund_status = ?, refund_id = ?, updated_at = ?
            WHERE id = ? AND refund_status = 'pending'`).run(
            complete ? "refunded" : processedTotal > 0 ? "partially_refunded" : null,
            complete ? refundOrder.refund_id : null,
            new Date().toISOString(), refund.order_id
          );
        }
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
