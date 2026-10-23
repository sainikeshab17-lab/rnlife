import { randomUUID } from "crypto";
import { getDb, type DbCheckoutPaymentAttempt, type DbConnection } from "@/lib/db";
import { withTransaction } from "@/lib/db";
import {
  checkAndReserveInventory,
  lockInventoryVariants,
  createCodAdvanceAttempt,
  createPendingOrder,
  getOrderById,
  logPaymentAudit,
  recordOrderStatusHistory,
  type CreateOrderParams,
} from "@/lib/db/orders";
import { generateOrderNumber } from "@/services/checkout-service";
import { getRazorpayClient, isVerifiedCapturedPaymentDetails } from "@/lib/razorpay";
import { classifyRazorpayOrderPayments } from "@/services/razorpay-order-recovery";

export type CheckoutAttemptSnapshot = Omit<CreateOrderParams, "orderNumber" | "razorpayOrderId">;

export async function createCheckoutPaymentAttempt(params: {
  idempotencyKey: string;
  requestHash: string;
  customerEmail: string;
  userId: string | null;
  paymentMethod: string;
  purpose: DbCheckoutPaymentAttempt["purpose"];
  expectedAmountPaisa: number;
  snapshot: CheckoutAttemptSnapshot;
}): Promise<{ status: "created" | "replayed" | "conflict"; attempt?: DbCheckoutPaymentAttempt }> {
  return withTransaction(async (db) => {
    await db.prepare("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))").get(params.idempotencyKey);
    const existing = await db.prepare("SELECT * FROM checkout_payment_attempts WHERE idempotency_key = ? FOR UPDATE")
      .get<DbCheckoutPaymentAttempt>(params.idempotencyKey);
    if (existing) {
      return existing.request_hash === params.requestHash
        ? { status: "replayed", attempt: existing }
        : { status: "conflict" };
    }

    const stockItems = params.snapshot.items.filter((item) => item.fulfillmentType !== "made_to_order")
      .map((item) => ({ productId: item.productId, size: item.size, quantity: item.quantity }));
    const inventory = await checkAndReserveInventory(stockItems, db);
    if (!inventory.ok) throw new Error(inventory.error || "Insufficient stock.");

    const id = `cpa_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
    const guestToken = randomUUID();
    const receipt = `rnl_${id}`.slice(0, 40);
    const now = new Date().toISOString();
    await db.prepare(`INSERT INTO checkout_payment_attempts (
      id, idempotency_key, request_hash, user_id, customer_email, guest_token,
      payment_method, purpose, receipt, expected_amount_paisa, checkout_snapshot,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?)`)
      .run(id, params.idempotencyKey, params.requestHash, params.userId,
        params.customerEmail.toLowerCase().trim(), guestToken, params.paymentMethod,
        params.purpose, receipt, params.expectedAmountPaisa, JSON.stringify(params.snapshot), now, now);
    const attempt = await db.prepare("SELECT * FROM checkout_payment_attempts WHERE id = ?")
      .get<DbCheckoutPaymentAttempt>(id);
    if (!attempt) throw new Error("Checkout payment attempt could not be retrieved.");
    await logPaymentAudit(null, "checkout_payment_attempt_created", {
      attemptId: id, paymentMethod: params.paymentMethod, purpose: params.purpose,
      expectedAmountPaisa: params.expectedAmountPaisa,
    }, db);
    return { status: "created", attempt };
  });
}

export async function getCheckoutPaymentAttempt(id: string): Promise<DbCheckoutPaymentAttempt | null> {
  return (await getDb().prepare("SELECT * FROM checkout_payment_attempts WHERE id = ?")
    .get<DbCheckoutPaymentAttempt>(id)) ?? null;
}

export async function getCheckoutPaymentAttemptByProviderOrderId(orderId: string): Promise<DbCheckoutPaymentAttempt | null> {
  return (await getDb().prepare("SELECT * FROM checkout_payment_attempts WHERE provider_order_id = ?")
    .get<DbCheckoutPaymentAttempt>(orderId)) ?? null;
}

export async function claimCheckoutProviderOrder(id: string): Promise<"claimed" | "ready" | "wait" | "reconcile"> {
  return withTransaction(async (db) => {
    const attempt = await db.prepare("SELECT * FROM checkout_payment_attempts WHERE id = ? FOR UPDATE")
      .get<DbCheckoutPaymentAttempt>(id);
    if (!attempt || attempt.attempt_status === "converted" || attempt.attempt_status === "captured" ||
      attempt.attempt_status === "expired" || attempt.reservation_state !== "held") return "reconcile";
    if (attempt.provider_order_id && attempt.creation_state === "ready") return "ready";
    if (attempt.creation_state === "creating") {
      if (Date.now() - Date.parse(attempt.updated_at) < 120_000) return "wait";
      await db.prepare("UPDATE checkout_payment_attempts SET creation_state = 'unknown', updated_at = NOW() WHERE id = ?").run(id);
      return "reconcile";
    }
    if (!(["pending", "retryable"].includes(attempt.creation_state))) return "reconcile";
    await db.prepare("UPDATE checkout_payment_attempts SET creation_state = 'creating', updated_at = NOW() WHERE id = ?").run(id);
    return "claimed";
  });
}

export async function attachCheckoutProviderOrder(id: string, providerOrderId: string): Promise<boolean> {
  const result = await getDb().prepare(`UPDATE checkout_payment_attempts
    SET provider_order_id = ?, creation_state = 'ready', updated_at = NOW()
    WHERE id = ? AND creation_state IN ('creating', 'unknown') AND provider_order_id IS NULL`)
    .run(providerOrderId, id);
  if (result.rowCount === 1) return true;
  return (await getCheckoutPaymentAttempt(id))?.provider_order_id === providerOrderId;
}

export async function setCheckoutAttemptCreationFailure(id: string, state: "retryable" | "unknown"): Promise<void> {
  await getDb().prepare(`UPDATE checkout_payment_attempts SET creation_state = ?, updated_at = NOW()
    WHERE id = ? AND creation_state = 'creating'`).run(state, id);
}

export async function updateCheckoutAttemptPaymentState(
  id: string,
  paymentId: string | null,
  state: "authorized" | "failed" | "cancelled" | "captured" | "reconciliation_required",
  signature?: string
): Promise<void> {
  await getDb().prepare(`UPDATE checkout_payment_attempts
    SET attempt_status = ?,
        provider_payment_id = CASE WHEN ? = 'captured' THEN COALESCE(?, provider_payment_id) ELSE provider_payment_id END,
        provider_signature = COALESCE(?, provider_signature), updated_at = NOW()
    WHERE id = ? AND attempt_status != 'converted'`)
    .run(state, state, paymentId, signature ?? null, id);
}

export async function convertCapturedCheckoutAttempt(params: {
  attemptId: string;
  providerOrderId: string;
  providerPaymentId: string;
  signature?: string;
}): Promise<{ success: boolean; alreadyConverted: boolean; orderId?: string; orderNumber?: string; guestToken?: string }> {
  const converted = await withTransaction(async (db) => {
    const attempt = await db.prepare("SELECT * FROM checkout_payment_attempts WHERE id = ? FOR UPDATE")
      .get<DbCheckoutPaymentAttempt>(params.attemptId);
    if (!attempt || attempt.provider_order_id !== params.providerOrderId ||
      attempt.expected_amount_paisa <= 0 || attempt.currency !== "INR") {
      return { success: false, alreadyConverted: false };
    }
    if (attempt.attempt_status === "converted" && attempt.order_id) {
      if (attempt.provider_payment_id !== params.providerPaymentId) return { success: false, alreadyConverted: false };
      const existing = await db.prepare("SELECT id, order_number, guest_token FROM orders WHERE id = ?")
        .get<{ id: string; order_number: string; guest_token: string }>(attempt.order_id);
      return existing
        ? { success: true, alreadyConverted: true, orderId: existing.id, orderNumber: existing.order_number, guestToken: existing.guest_token }
        : { success: false, alreadyConverted: false };
    }
    if (attempt.attempt_status !== "captured" ||
      (attempt.provider_payment_id && attempt.provider_payment_id !== params.providerPaymentId)) {
      return { success: false, alreadyConverted: false };
    }
    if (attempt.reservation_state !== "held") {
      await db.prepare(`UPDATE checkout_payment_attempts SET attempt_status = 'reconciliation_required', updated_at = NOW()
        WHERE id = ? AND attempt_status = 'captured'`).run(attempt.id);
      await logPaymentAudit(null, "captured_checkout_without_held_reservation", {
        attemptId: attempt.id, paymentId: params.providerPaymentId, reservationState: attempt.reservation_state,
      }, db);
      return { success: false, alreadyConverted: false };
    }

    const snapshot = attempt.checkout_snapshot as CheckoutAttemptSnapshot;
    const stockItems = snapshot.items.filter((item) => item.fulfillmentType !== "made_to_order");
    await db.prepare(`SELECT product_id FROM inventory WHERE (product_id, size) IN (
      ${stockItems.map(() => "(?, ?)").join(", ") || "(NULL, NULL)"}
    ) ORDER BY product_id COLLATE "C", size COLLATE "C" FOR UPDATE`)
      .all(...stockItems.flatMap((item) => [item.productId, item.size]));
    for (const item of stockItems) {
      const moved = await db.prepare(`UPDATE inventory SET stock = stock - ?, reserved = GREATEST(0, reserved - ?)
        WHERE product_id = ? AND size = ? AND stock >= ? AND reserved >= ?`)
        .run(item.quantity, item.quantity, item.productId, item.size, item.quantity, item.quantity);
      if (moved.rowCount !== 1) throw new Error("Checkout inventory reservation is missing at payment confirmation.");
    }

    const created = await createPendingOrder({
      ...snapshot,
      orderNumber: generateOrderNumber(),
      razorpayOrderId: params.providerOrderId,
      paymentMethod: attempt.payment_method,
    }, db);
    const now = new Date().toISOString();
    if (attempt.purpose === "full_payment") {
      await db.prepare(`UPDATE orders SET payment_status = 'paid', order_status = 'paid', is_confirmed = TRUE,
        razorpay_payment_id = ?, razorpay_signature = ?, updated_at = ? WHERE id = ?`)
        .run(params.providerPaymentId, params.signature ?? null, now, created.order.id);
    } else {
      const advanceAttempt = await createCodAdvanceAttempt(created.order.id, attempt.id, db);
      await db.prepare(`UPDATE razorpay_payment_attempts SET razorpay_order_id = ?, razorpay_payment_id = ?,
        creation_state = 'ready', payment_state = 'captured', updated_at = ? WHERE id = ?`)
        .run(params.providerOrderId, params.providerPaymentId, now, advanceAttempt.id);
      await db.prepare(`UPDATE orders SET payment_status = 'partially_paid', order_status = 'advance_paid',
        is_confirmed = TRUE, razorpay_order_id = ?, razorpay_payment_id = ?, razorpay_signature = ?, updated_at = ?
        WHERE id = ?`).run(params.providerOrderId, params.providerPaymentId, params.signature ?? null, now, created.order.id);
      await recordOrderStatusHistory(created.order.id, "pending_payment", "advance_paid", "razorpay", "₹200 COD Advance verified", db);
    }
    await db.prepare(`UPDATE checkout_payment_attempts SET attempt_status = 'converted',
      provider_payment_id = ?, provider_signature = COALESCE(?, provider_signature), order_id = ?,
      reservation_state = 'consumed', updated_at = ? WHERE id = ?`)
      .run(params.providerPaymentId, params.signature ?? null, created.order.id, now, attempt.id);
    await logPaymentAudit(created.order.id, "checkout_attempt_converted_to_order", {
      attemptId: attempt.id, purpose: attempt.purpose, paymentId: params.providerPaymentId,
      expectedAmountPaisa: attempt.expected_amount_paisa,
      balanceDue: attempt.purpose === "cod_advance" ? created.order.total - 200 : 0,
    }, db);
    return {
      success: true, alreadyConverted: false, orderId: created.order.id,
      orderNumber: created.order.order_number, guestToken: created.guestToken,
    };
  });

  if (!converted.success || !converted.orderId) return converted;
  const order = await getOrderById(converted.orderId);
  return { ...converted, guestToken: converted.guestToken ?? order?.guest_token };
}

export async function reconcileCapturedCheckoutAttempt(attempt: DbCheckoutPaymentAttempt) {
  if (!attempt.provider_order_id || attempt.attempt_status === "converted") return null;
  const provider = getRazorpayClient();
  const payments = await provider.orders.fetchPayments(attempt.provider_order_id);
  const outcome = classifyRazorpayOrderPayments(payments, {
    orderId: attempt.provider_order_id, amount: attempt.expected_amount_paisa,
  });
  if (outcome !== "captured") return null;
  const collection = payments as { items: Array<{ id: string; status: string; captured: boolean }> };
  const captured = collection.items.filter((payment) => payment.status === "captured" && payment.captured === true);
  if (captured.length !== 1) return null;
  const payment = await provider.payments.fetch(captured[0].id);
  if (payment.id !== captured[0].id ||
    !isVerifiedCapturedPaymentDetails(payment, attempt.provider_order_id, attempt.expected_amount_paisa)) return null;
  await updateCheckoutAttemptPaymentState(attempt.id, payment.id, "captured");
  return convertCapturedCheckoutAttempt({
    attemptId: attempt.id, providerOrderId: attempt.provider_order_id, providerPaymentId: payment.id,
  });
}

export type CheckoutAttemptExpiryResult = {
  released: number;
  reconciled: number;
  deferred: number;
};

/**
 * Expire safely abandoned reservations and reconcile expired provider orders.
 * Razorpay Orders have no close operation in the supported API: `created` and
 * `attempted` orders can still accept payments. Their reservations therefore
 * remain held until captured/converted or manually reconciled; freeing those
 * reservations would make a late valid capture unsafe.
 */
export async function processCheckoutAttemptExpiryBatch(
  limit = 100,
  reconcile: typeof reconcileCapturedCheckoutAttempt = reconcileCapturedCheckoutAttempt
): Promise<CheckoutAttemptExpiryResult> {
  const db = getDb();
  const expiredWithoutProvider = await withTransaction(async (tx) => {
    const candidates = await tx.prepare(`SELECT * FROM checkout_payment_attempts
      WHERE reservation_state = 'held' AND attempt_status = 'pending'
        AND creation_state IN ('pending', 'retryable') AND provider_order_id IS NULL
        AND expires_at <= NOW() AND updated_at <= NOW() - INTERVAL '5 minutes'
      ORDER BY expires_at, created_at
      LIMIT ? FOR UPDATE SKIP LOCKED`).all<DbCheckoutPaymentAttempt>(limit);

    let released = 0;
    for (const attempt of candidates) {
      const snapshot = checkoutSnapshot(attempt.checkout_snapshot);
      if (!snapshot) continue;
      const stockItems = snapshot.items.filter((item) => item.fulfillmentType !== "made_to_order")
        .map((item) => ({ productId: item.productId, size: item.size, quantity: item.quantity }));
      await lockInventoryVariants(tx, stockItems);
      for (const item of stockItems) {
        const result = await tx.prepare(`UPDATE inventory SET reserved = reserved - ?
          WHERE product_id = ? AND size = ? AND reserved >= ?`)
          .run(item.quantity, item.productId, item.size, item.quantity);
        if (result.rowCount !== 1) throw new Error(`Reservation ledger mismatch for expired checkout ${attempt.id}.`);
      }
      const marked = await tx.prepare(`UPDATE checkout_payment_attempts
        SET attempt_status = 'expired', reservation_state = 'released',
            reservation_released_at = NOW(), updated_at = NOW()
        WHERE id = ? AND reservation_state = 'held' AND provider_order_id IS NULL
          AND creation_state IN ('pending', 'retryable') AND attempt_status = 'pending'`)
        .run(attempt.id);
      if (marked.rowCount !== 1) throw new Error(`Checkout expiry state changed while processing ${attempt.id}.`);
      await logPaymentAudit(null, "checkout_attempt_expired_reservation_released", { attemptId: attempt.id }, tx);
      released += 1;
    }
    return released;
  });

  const providerAttempts = await db.prepare(`SELECT * FROM checkout_payment_attempts
    WHERE expires_at <= NOW() AND provider_order_id IS NOT NULL
      AND attempt_status IN ('pending', 'authorized', 'failed', 'cancelled', 'captured', 'reconciliation_required')
    ORDER BY expires_at, created_at LIMIT ?`).all<DbCheckoutPaymentAttempt>(limit);
  let reconciled = 0;
  let deferred = 0;
  for (const attempt of providerAttempts) {
    try {
      const result = await reconcile(attempt);
      if (result?.success) reconciled += 1;
      else deferred += 1;
    } catch (error) {
      deferred += 1;
      await logPaymentAudit(null, "checkout_attempt_expiry_reconciliation_deferred", {
        attemptId: attempt.id, reason: error instanceof Error ? error.message : "provider reconciliation failed",
      });
    }
  }
  return { released: expiredWithoutProvider, reconciled, deferred };
}

export function checkoutSnapshot(value: unknown): CheckoutAttemptSnapshot | null {
  if (!value || typeof value !== "object") return null;
  return value as CheckoutAttemptSnapshot;
}
