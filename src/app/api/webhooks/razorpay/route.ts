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
} from "@/lib/db/orders";
import { dispatchAllOrderNotifications, persistPaymentNotificationJobs, sendRefundConfirmationEmail } from "@/services/notification-service";
import { receiveRazorpayRefundWebhook } from "@/services/razorpay/refund-webhook-inbox";
import { classifyRefundWebhook, stablePayloadFingerprint } from "@/services/razorpay/refund-webhook-inbox-policy";
import { convertCapturedCheckoutAttempt, getCheckoutPaymentAttemptByProviderOrderId, updateCheckoutAttemptPaymentState } from "@/services/checkout-payment-attempts";

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

      const checkoutAttempt = rzpOrderId ? await getCheckoutPaymentAttemptByProviderOrderId(rzpOrderId) : null;
      if (checkoutAttempt) {
        const paymentNotes = (paymentEntity as unknown as { notes?: Record<string, string> } | undefined)?.notes;
        if (!rzpPaymentId || paymentEntity.amount !== checkoutAttempt.expected_amount_paisa ||
          paymentEntity.currency !== checkoutAttempt.currency ||
          (paymentNotes?.checkoutAttemptId && paymentNotes.checkoutAttemptId !== checkoutAttempt.id) ||
          (paymentNotes?.customerEmail && paymentNotes.customerEmail.toLowerCase() !== checkoutAttempt.customer_email.toLowerCase()) ||
          (notesOrderId && notesOrderId !== checkoutAttempt.id) ||
          (paymentAttemptId && paymentAttemptId !== checkoutAttempt.id)) {
          await logPaymentAudit(null, "checkout_attempt_webhook_mismatch", {
            attemptId: checkoutAttempt.id, providerOrderId: rzpOrderId, paymentId: rzpPaymentId,
            receivedAmount: paymentEntity.amount, receivedCurrency: paymentEntity.currency,
          });
          return NextResponse.json({ error: "Webhook payment details do not match the checkout attempt." }, { status: 400 });
        }
        await updateCheckoutAttemptPaymentState(checkoutAttempt.id, rzpPaymentId, "captured");
        const converted = await convertCapturedCheckoutAttempt({ attemptId: checkoutAttempt.id,
          providerOrderId: rzpOrderId, providerPaymentId: rzpPaymentId });
        if (!converted.success || !converted.orderId) {
          await logPaymentAudit(null, "checkout_attempt_webhook_capture_requires_reconciliation", {
            attemptId: checkoutAttempt.id, paymentId: rzpPaymentId,
          });
          return NextResponse.json({ status: "captured_payment_requires_reconciliation" });
        }
        await persistPaymentNotificationJobs(converted.orderId, async () => {
          const refreshed = await getOrderById(converted.orderId!);
          if (!refreshed) throw new Error("Webhook-converted order could not be reloaded.");
          return dispatchAllOrderNotifications(refreshed);
        });
        return NextResponse.json({ status: converted.alreadyConverted ? "already_converted" : "checkout_attempt_converted" });
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
        const checkoutAttempt = await getCheckoutPaymentAttemptByProviderOrderId(rzpOrderId);
        if (checkoutAttempt) {
          if (paymentEntity?.amount !== checkoutAttempt.expected_amount_paisa || paymentEntity?.currency !== checkoutAttempt.currency ||
            (paymentEntity?.notes?.checkoutAttemptId && paymentEntity.notes.checkoutAttemptId !== checkoutAttempt.id)) {
            await logPaymentAudit(null, "checkout_attempt_failed_webhook_mismatch", {
              attemptId: checkoutAttempt.id, paymentId: paymentEntity?.id,
              amount: paymentEntity?.amount, currency: paymentEntity?.currency,
            });
            return NextResponse.json({ status: "checkout_attempt_failure_requires_reconciliation" });
          }
          await updateCheckoutAttemptPaymentState(checkoutAttempt.id, paymentEntity?.id ?? null,
            paymentEntity?.status === "cancelled" ? "cancelled" : "failed");
          await logPaymentAudit(null, "checkout_attempt_payment_failed", { attemptId: checkoutAttempt.id,
            paymentId: paymentEntity?.id, status: paymentEntity?.status });
          return NextResponse.json({ status: "checkout_attempt_payment_failed" });
        }
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
      const refundId = refundEntity?.id;
      const paymentId = refundEntity?.payment_id;
      const amountPaisa = refundEntity?.amount;
      if (typeof refundId !== "string" || typeof paymentId !== "string" || !Number.isSafeInteger(amountPaisa) ||
          amountPaisa <= 0 || refundEntity?.currency !== "INR") {
        return NextResponse.json({ error: "Invalid refund event details" }, { status: 400 });
      }
      const sourceEventIdHeader = req.headers.get("x-razorpay-event-id");
      const sourceEventId = sourceEventIdHeader && sourceEventIdHeader.length <= 255 && /^[\x21-\x7e]+$/.test(sourceEventIdHeader)
        ? sourceEventIdHeader
        : null;
      const outcome = await receiveRazorpayRefundWebhook({
        eventType, refundId, paymentId, orderId: refundEntity?.notes?.orderId ?? null,
        amountPaisa, currency: refundEntity.currency,
        providerStatus: typeof refundEntity.status === "string" ? refundEntity.status : "missing",
        sourceEventId, payloadFingerprint: stablePayloadFingerprint(event),
        quarantineReason: classifyRefundWebhook(eventType, refundEntity.status),
      });
      if (outcome.state === "missing") return NextResponse.json({ error: "Refund event was not durably recorded." }, { status: 503 });
      if (outcome.state === "deferred") return NextResponse.json({ status: "refund_durably_deferred", retryRequired: true });
      if (outcome.state === "quarantined") return NextResponse.json({ status: "refund_requires_reconciliation" });
      if (outcome.state === "processed" && outcome.orderId) {
        const refreshedOrder = await getOrderById(outcome.orderId);
        if (refreshedOrder) {
          sendRefundConfirmationEmail(refreshedOrder, amountPaisa / 100, refundId).catch(() => {
            console.error("[Razorpay Webhook] Refund notification failed after durable refund processing.");
          });
        }
      }
    } else if (eventType === "refund.failed") {
      const refundEntity = payload.refund?.entity;
      const refundId = refundEntity?.id;
      const paymentId = refundEntity?.payment_id;
      const amountPaisa = refundEntity?.amount;
      if (typeof refundId !== "string" || typeof paymentId !== "string" || !Number.isSafeInteger(amountPaisa) ||
          amountPaisa <= 0 || refundEntity?.currency !== "INR") {
        return NextResponse.json({ error: "Invalid refund event details" }, { status: 400 });
      }
      const sourceEventIdHeader = req.headers.get("x-razorpay-event-id");
      const sourceEventId = sourceEventIdHeader && sourceEventIdHeader.length <= 255 && /^[\x21-\x7e]+$/.test(sourceEventIdHeader)
        ? sourceEventIdHeader
        : null;
      const outcome = await receiveRazorpayRefundWebhook({
        eventType, refundId, paymentId, orderId: refundEntity?.notes?.orderId ?? null,
        amountPaisa, currency: refundEntity.currency,
        providerStatus: typeof refundEntity.status === "string" ? refundEntity.status : "missing",
        sourceEventId, payloadFingerprint: stablePayloadFingerprint(event),
        quarantineReason: classifyRefundWebhook(eventType, refundEntity.status),
      });
      if (outcome.state === "missing") return NextResponse.json({ error: "Refund event was not durably recorded." }, { status: 503 });
      if (outcome.state === "deferred") return NextResponse.json({ status: "refund_durably_deferred", retryRequired: true });
      if (outcome.state === "quarantined") return NextResponse.json({ status: "refund_requires_reconciliation" });
    }

    return NextResponse.json({ status: "ok" });
  } catch {
    console.error("Error processing Razorpay webhook; durable processing was not confirmed.");
    return NextResponse.json(
      { error: "Internal server error processing webhook" },
      { status: 500 }
    );
  }
}
