import "server-only";
import { getDb, withTransaction, type DbConnection } from "@/lib/db";
import { recordRefund } from "@/lib/db/orders";
import { hasUnresolvedShiprocketOperation } from "@/lib/db/shiprocket-operation-guard";
import { getRefundWebhookIdempotencyKey, shouldMarkOrderRefunded } from "@/lib/order-status-machine";
import { isLegalRefundInboxTransition, refundWebhookEventKey } from "./refund-webhook-inbox-policy";

export type RefundWebhookInput = {
  eventType: "refund.processed" | "refund.speed_changed" | "refund.failed";
  refundId: string;
  paymentId: string;
  orderId?: string | null;
  amountPaisa: number;
  currency: string;
  providerStatus: string;
  sourceEventId?: string | null;
  payloadFingerprint?: string;
  quarantineReason?: string | null;
};

type InboxRow = RefundWebhookInput & { event_key: string; state: string; attempts: number };
type InboxDependencies = { transaction: typeof withTransaction };

async function withRefundTransactionRetry<T>(callback: (db: DbConnection) => Promise<T>, transaction = withTransaction): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await transaction(callback);
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (!(["40001", "40P01"].includes(code)) || attempt >= 2) throw error;
    }
  }
}

async function recordInboxAttempt(db: DbConnection, key: string, outcome: string, reason: string | null) {
  await db.prepare(`INSERT INTO razorpay_refund_webhook_attempts(event_key, outcome, reason)
    VALUES (?, ?, ?)`).run(key, outcome, reason);
}

async function transitionInbox(db: DbConnection, key: string, next: "received" | "deferred" | "processed" | "quarantined", reason: string | null) {
  const row = await db.prepare("SELECT state FROM razorpay_refund_webhook_inbox WHERE event_key = ? FOR UPDATE")
    .get<{ state: "received" | "deferred" | "processed" | "quarantined" }>(key);
  if (!row) return "missing" as const;
  if (!isLegalRefundInboxTransition(row.state, next)) {
    await recordInboxAttempt(db, key, "duplicate", "terminal_state_retry_blocked");
    return row.state;
  }
  if (row.state !== next) {
    await db.prepare(`UPDATE razorpay_refund_webhook_inbox SET state = ?, attempts = attempts + 1,
      last_error = ?, processed_at = CASE WHEN ? = 'processed' THEN NOW() ELSE processed_at END,
      updated_at = NOW() WHERE event_key = ? AND state = ?`)
      .run(next, reason, next, key, row.state);
  } else {
    await db.prepare(`UPDATE razorpay_refund_webhook_inbox SET attempts = attempts + 1,
      last_error = ?, processed_at = CASE WHEN ? = 'processed' THEN COALESCE(processed_at, NOW()) ELSE processed_at END,
      updated_at = NOW() WHERE event_key = ? AND state = ?`)
      .run(reason, next, key, row.state);
  }
  await recordInboxAttempt(db, key, next, reason);
  return next;
}

async function applyStoredEvent(db: DbConnection, key: string) {
  const event = await db.prepare(`SELECT event_key, event_type AS "eventType", refund_id AS "refundId",
    payment_id AS "paymentId", order_id AS "orderId", amount_paisa AS "amountPaisa", currency,
    provider_status AS "providerStatus", state, attempts FROM razorpay_refund_webhook_inbox WHERE event_key = ?`)
    .get<InboxRow>(key);
  if (!event) return { state: "missing" as const };
  if (event.state === "processed" || event.state === "quarantined") {
    await recordInboxAttempt(db, key, "retry_blocked", "terminal_state_retry_blocked");
    return { state: event.state as "processed" | "quarantined" };
  }

  const candidate = event.orderId
    ? { id: event.orderId }
    : await db.prepare("SELECT id FROM orders WHERE razorpay_payment_id = ?").get<{ id: string }>(event.paymentId);
  if (!candidate) {
    const state = await transitionInbox(db, key, "deferred", "order_mapping_unavailable");
    return { state };
  }

  // Lock order first everywhere; refund records and inbox rows are locked only after it.
  const order = await db.prepare("SELECT * FROM orders WHERE id = ? FOR UPDATE").get<{
    id: string; payment_status: string; payment_method: string; razorpay_payment_id: string | null;
    total: number; refund_id: string | null; shiprocket_state: string | null; order_status: string;
  }>(candidate.id);
  if (!order || order.razorpay_payment_id !== event.paymentId) {
    await db.prepare("UPDATE razorpay_refund_webhook_inbox SET order_id = ? WHERE event_key = ? AND order_id IS NULL")
      .run(candidate.id, key);
    await transitionInbox(db, key, "quarantined", "payment_order_mapping_mismatch");
    return { state: "quarantined" as const };
  }
  const lockedEvent = await db.prepare("SELECT * FROM razorpay_refund_webhook_inbox WHERE event_key = ? FOR UPDATE")
    .get<InboxRow>(key);
  if (!lockedEvent || lockedEvent.state === "processed" || lockedEvent.state === "quarantined") {
    return { state: lockedEvent?.state ?? "missing" };
  }

  const existing = await db.prepare(`SELECT idempotency_key, amount_paisa, return_id FROM refund_records
    WHERE order_id = ? AND razorpay_refund_id = ? FOR UPDATE`)
    .get<{ idempotency_key: string; amount_paisa: number; return_id: string | null }>(order.id, event.refundId);
  if (existing && existing.amount_paisa !== event.amountPaisa) {
    await transitionInbox(db, key, "quarantined", "stored_refund_amount_conflict");
    return { state: "quarantined" as const };
  }

  const pending = existing ? null : await db.prepare(`SELECT idempotency_key, amount_paisa, return_id FROM refund_records
    WHERE order_id = ? AND razorpay_payment_id = ? AND status = 'pending' AND razorpay_refund_id IS NULL
    ORDER BY created_at ASC LIMIT 1 FOR UPDATE`)
    .get<{ idempotency_key: string; amount_paisa: number; return_id: string | null }>(order.id, event.paymentId);
  if (pending && pending.amount_paisa !== event.amountPaisa) {
    await transitionInbox(db, key, "quarantined", "pending_refund_amount_conflict");
    return { state: "quarantined" as const };
  }
  const keyForRefund = existing?.idempotency_key ?? pending?.idempotency_key ?? getRefundWebhookIdempotencyKey(event.refundId);
  const deferred = hasUnresolvedShiprocketOperation(order.shiprocket_state);
  const targetStatus = deferred ? "pending" : event.eventType === "refund.failed" ? "failed" : "processed";

  const savedRefund = await recordRefund({
    orderId: order.id, returnId: existing?.return_id ?? pending?.return_id ?? null,
    razorpayRefundId: event.refundId, razorpayPaymentId: event.paymentId,
    amount: event.amountPaisa / 100, status: targetStatus,
    reason: deferred ? "Deferred verified Razorpay webhook; shipment operation reconciliation required." : "Razorpay webhook reconciliation",
    initiatedBy: "razorpay_webhook", idempotencyKey: keyForRefund, connection: db,
    failureReason: targetStatus === "failed" ? "Razorpay confirmed refund failure." : null,
  });

  if (deferred) {
    await db.prepare("UPDATE razorpay_refund_webhook_inbox SET order_id = ? WHERE event_key = ? AND order_id IS NULL")
      .run(order.id, key);
    const state = await transitionInbox(db, key, "deferred", "shipment_operation_unresolved_refund_retained_pending");
    return { state, refund: savedRefund };
  }

  if (savedRefund.status !== targetStatus) {
    await transitionInbox(db, key, "quarantined", "stored_refund_state_conflicts_with_provider_event");
    return { state: "quarantined" as const, refund: savedRefund };
  }

  if (order.payment_method === "COD Advance" || order.payment_status === "partially_paid") {
    await transitionInbox(db, key, "quarantined", "refund_on_cod_advance_requires_investigation");
    return { state: "quarantined" as const, refund: savedRefund };
  }

  const totals = await db.prepare(`SELECT COALESCE(SUM(amount_paisa), 0) AS total FROM refund_records
    WHERE order_id = ? AND status = 'processed'`).get<{ total: string | number }>(order.id);
  const processedAmount = Number(totals?.total ?? 0) / 100;
  const fullyRefunded = shouldMarkOrderRefunded(order.payment_method, order.payment_status, processedAmount, order.total);
  if (targetStatus === "processed") {
    const refundStatus = fullyRefunded ? "refunded" : processedAmount > 0 ? "partially_refunded" : null;
    await db.prepare(`UPDATE orders SET order_status = ?, refund_status = ?, refund_id = ?, updated_at = NOW() WHERE id = ?`)
      .run(fullyRefunded ? "refunded" : order.order_status, refundStatus, event.refundId, order.id);
    if (savedRefund.return_id) await db.prepare("UPDATE returns SET status = 'completed', updated_at = NOW() WHERE id = ?").run(savedRefund.return_id);
  } else {
    await db.prepare(`UPDATE orders SET refund_status = ?, refund_id = ?, updated_at = NOW()
      WHERE id = ? AND refund_status = 'pending'`)
      .run(processedAmount > 0 ? "partially_refunded" : null, processedAmount > 0 ? order.refund_id : null, order.id);
  }
  await db.prepare("UPDATE razorpay_refund_webhook_inbox SET order_id = ? WHERE event_key = ? AND order_id IS NULL")
    .run(order.id, key);
  await transitionInbox(db, key, "processed", null);
  return { state: "processed" as const, refund: savedRefund, orderId: order.id };
}

export async function receiveRazorpayRefundWebhook(event: RefundWebhookInput, dependencies: InboxDependencies = { transaction: withTransaction }) {
  const fallbackFingerprint = event.payloadFingerprint ?? JSON.stringify([
    event.eventType, event.refundId, event.paymentId, event.orderId ?? null,
    event.amountPaisa, event.currency, event.providerStatus,
  ]);
  const key = refundWebhookEventKey(event.sourceEventId, fallbackFingerprint);
  return withRefundTransactionRetry(async (tx) => {
    const candidate = event.orderId
      ? await tx.prepare("SELECT id FROM orders WHERE id = ?").get<{ id: string }>(event.orderId)
      : await tx.prepare("SELECT id FROM orders WHERE razorpay_payment_id = ?").get<{ id: string }>(event.paymentId);
    if (candidate) {
      // Lock before persisting receipt so an order claim and webhook have a single, ordered winner.
      await tx.prepare("SELECT id FROM orders WHERE id = ? FOR UPDATE").get<{ id: string }>(candidate.id);
    }
    const inserted = await tx.prepare(`INSERT INTO razorpay_refund_webhook_inbox
      (event_key, provider_event_id, source_payload_hash, event_type, refund_id, payment_id, order_id, amount_paisa, currency, provider_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`)
      .run(key, event.sourceEventId ?? null, event.payloadFingerprint ?? null, event.eventType, event.refundId, event.paymentId, event.orderId ?? null,
        event.amountPaisa, event.currency, event.providerStatus);
    const stored = event.sourceEventId
      ? await tx.prepare(`SELECT event_key, event_type AS "eventType", refund_id AS "refundId",
        payment_id AS "paymentId", order_id AS "orderId", amount_paisa AS "amountPaisa", currency,
        provider_event_id AS "sourceEventId", source_payload_hash AS "payloadFingerprint", provider_status AS "providerStatus", state, attempts
        FROM razorpay_refund_webhook_inbox WHERE event_key = ? OR provider_event_id = ?
        ORDER BY CASE WHEN provider_event_id = ? THEN 0 ELSE 1 END LIMIT 1 FOR UPDATE`)
        .get<InboxRow & { sourceEventId: string | null; payloadFingerprint: string | null }>(key, event.sourceEventId, event.sourceEventId)
      : await tx.prepare(`SELECT event_key, event_type AS "eventType", refund_id AS "refundId",
        payment_id AS "paymentId", order_id AS "orderId", amount_paisa AS "amountPaisa", currency,
        provider_event_id AS "sourceEventId", source_payload_hash AS "payloadFingerprint", provider_status AS "providerStatus", state, attempts
        FROM razorpay_refund_webhook_inbox WHERE event_key = ? FOR UPDATE`)
        .get<InboxRow & { sourceEventId: string | null; payloadFingerprint: string | null }>(key);
    if (!stored) return { state: "missing" as const };
    if (stored.eventType !== event.eventType || stored.refundId !== event.refundId ||
        stored.paymentId !== event.paymentId || Number(stored.amountPaisa) !== event.amountPaisa ||
        stored.currency !== event.currency || stored.providerStatus !== event.providerStatus ||
        (event.payloadFingerprint && stored.payloadFingerprint && stored.payloadFingerprint !== event.payloadFingerprint) ||
        (event.orderId && stored.orderId && stored.orderId !== event.orderId)) {
      if (stored.state === "processed" || stored.state === "quarantined") {
        await recordInboxAttempt(tx, stored.event_key, "duplicate", "duplicate_source_event_payload_conflict_terminal_state_preserved");
        return { state: stored.state as "processed" | "quarantined" };
      }
      await transitionInbox(tx, stored.event_key, "quarantined", "duplicate_source_event_payload_conflict");
      return { state: "quarantined" as const };
    }
    await recordInboxAttempt(tx, stored.event_key, inserted.rowCount === 1 ? "received" : "duplicate", null);
    if (event.quarantineReason) {
      const state = await transitionInbox(tx, stored.event_key, "quarantined", event.quarantineReason);
      return { state };
    }
    return applyStoredEvent(tx, stored.event_key);
  }, dependencies.transaction);
}

export async function retryDeferredRazorpayRefundWebhook(key: string) {
  if (!/^[a-f0-9]{64}$/.test(key)) return { state: "missing" as const };
  return withRefundTransactionRetry(tx => applyStoredEvent(tx, key));
}

export async function listDeferredRazorpayRefundWebhooks() {
  return getDb().prepare(`SELECT inbox.event_key, inbox.provider_event_id, inbox.event_type, inbox.refund_id,
    inbox.order_id, inbox.amount_paisa, inbox.currency, inbox.provider_status,
    inbox.state, inbox.attempts, inbox.last_error, inbox.received_at,
    COALESCE((SELECT json_agg(json_build_object('outcome', audit.outcome, 'reason', audit.reason,
      'attemptedAt', audit.attempted_at) ORDER BY audit.attempted_at)
      FROM razorpay_refund_webhook_attempts audit WHERE audit.event_key = inbox.event_key), '[]'::json) AS attempt_history
    FROM razorpay_refund_webhook_inbox inbox
    WHERE inbox.state IN ('received', 'deferred', 'quarantined') ORDER BY inbox.received_at ASC LIMIT 100`)
    .all<Omit<InboxRow, "paymentId"> & { provider_event_id: string | null; order_id: string | null; last_error: string | null; received_at: string; attempt_history: Array<{ outcome: string; reason: string | null; attemptedAt: string }> }>();
}
