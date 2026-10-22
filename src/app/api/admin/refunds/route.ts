import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth/admin-auth";
import { getDb } from "@/lib/db/index";
import { getOrderById, recordRefund, reserveRefund } from "@/lib/db/orders";
import { createRazorpayRefund } from "@/lib/razorpay";
import { writeAuditLog } from "@/lib/db/audit";
import { sendRefundConfirmationEmail } from "@/services/notification-service";
import { canInitiateRefund, shouldMarkOrderRefunded } from "@/lib/order-status-machine";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/refunds
 * List all refund records across orders.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdminAuth(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const refunds = await db
    .prepare(`
      SELECT r.*, o.order_number, o.customer_name, o.customer_email
      FROM refund_records r
      JOIN orders o ON r.order_id = o.id
      ORDER BY r.created_at DESC
    `)
    .all();

  return NextResponse.json({ refunds });
}

/**
 * POST /api/admin/refunds
 * Admin initiates an online refund for an order via Razorpay API.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdminAuth(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { orderId, returnId, amount, reason } = body;

  if (typeof orderId !== "string" || !orderId || typeof amount !== "number" || !Number.isFinite(amount) ||
      amount <= 0 || !Number.isSafeInteger(Math.round(amount * 100)) || Math.round(amount * 100) !== amount * 100) {
    return NextResponse.json({ error: "Order ID and a positive refund amount are required." }, { status: 400 });
  }

  const order = await getOrderById(orderId);
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  if (!canInitiateRefund(order.payment_method) || order.payment_status === "partially_paid") {
    return NextResponse.json({ error: "The ₹200 COD Advance is non-refundable." }, { status: 422 });
  }

  if (!["paid", "partially_paid"].includes(order.payment_status) || !order.razorpay_payment_id) {
    return NextResponse.json(
      { error: "Cannot issue refund for an unpaid order or missing payment ID." },
      { status: 400 }
    );
  }

  const db = getDb();

  // Convert amount to paisa for Razorpay
  const amountPaisa = Math.round(amount * 100);

  // Reserve under an order row lock. A pending reservation blocks concurrent
  // requests and remains in place after an uncertain provider timeout.
  const reserveResult = await reserveRefund({
    orderId: order.id, returnId: returnId || null, paymentId: order.razorpay_payment_id,
    amount, reason: reason || "Admin customer refund", initiatedBy: admin.email,
  });
  if (!reserveResult.reservation) {
    const status = reserveResult.reason === "exceeds_balance" ? 400 : 409;
    return NextResponse.json({
      error: reserveResult.reason === "exceeds_balance"
        ? "Refund amount exceeds the remaining refundable balance."
        : reserveResult.reason === "pending"
          ? "A refund is already pending provider confirmation; reconcile it before retrying."
          : "Order payment state changed; reload the order before retrying.",
    }, { status });
  }
  const reservation = reserveResult.reservation;
  const collected = order.total;

  // Invoke server-side Razorpay API
  const rzpResult = await createRazorpayRefund({
    paymentId: order.razorpay_payment_id!,
    amountPaisa,
    notes: {
      orderId: order.id,
      orderNumber: order.order_number,
      reason: reason || "Admin customer refund",
    },
  });

  if (!rzpResult.success) {
    return NextResponse.json(
      { error: "Refund outcome is uncertain. The refund remains pending reconciliation; do not retry until provider status is checked." },
      { status: 502 }
    );
  }

  // Record successful/pending refund
  const refundRec = await recordRefund({
    orderId: order.id,
    returnId: returnId || null,
    razorpayRefundId: rzpResult.refundId,
    razorpayPaymentId: order.razorpay_payment_id,
    amount,
    status: rzpResult.status === "processed" ? "processed" : rzpResult.status === "failed" ? "failed" : "pending",
    reason: reason || "Admin customer refund",
    initiatedBy: admin.email,
    idempotencyKey: reservation.idempotency_key,
  });

  if (refundRec.status === "failed") {
    const processed = await db.prepare(`SELECT COALESCE(SUM(amount_paisa), 0) AS total
      FROM refund_records WHERE order_id = ? AND status = 'processed'`).get<{ total: string | number }>(order.id);
    const processedTotal = Number(processed?.total ?? 0) / 100;
    const refunded = shouldMarkOrderRefunded(order.payment_method, order.payment_status, processedTotal, order.total);
    await db.prepare(`UPDATE orders SET refund_status = ?, refund_id = ?, updated_at = ?
      WHERE id = ? AND refund_status = 'pending'`).run(
      refunded ? "refunded" : processedTotal > 0 ? "partially_refunded" : null,
      refunded ? rzpResult.refundId || null : null,
      new Date().toISOString(), order.id
    );
    return NextResponse.json({
      success: false,
      refund: refundRec,
      error: "Razorpay confirmed that the refund failed. No refund was processed; a new attempt may be made.",
    }, { status: 502 });
  }

  const processedTotalRow = await db.prepare(`
    SELECT COALESCE(SUM(amount_paisa), 0) AS total
    FROM refund_records WHERE order_id = ? AND status = 'processed'
  `).get<{ total: string | number }>(order.id);
  const processedTotal = Number(processedTotalRow?.total ?? 0) / 100;
  const refundIsComplete = shouldMarkOrderRefunded(order.payment_method, order.payment_status, processedTotal, collected);
  const now = new Date().toISOString();
  if (refundIsComplete) {
    await db.prepare(`
      UPDATE orders
      SET order_status = 'refunded', refund_status = 'refunded', refund_id = ?, updated_at = ?
      WHERE id = ?
    `).run(rzpResult.refundId || null, now, order.id);
  } else if (refundRec.status === "processed") {
    await db.prepare(`
      UPDATE orders SET refund_status = 'partially_refunded', refund_id = ?, updated_at = ? WHERE id = ?
    `).run(rzpResult.refundId || null, now, order.id);
  } else {
    await db.prepare(`
      UPDATE orders SET refund_status = CASE
        WHEN refund_status IN ('partially_refunded', 'refunded') THEN refund_status ELSE 'pending' END,
        refund_id = ?, updated_at = ? WHERE id = ?
    `).run(rzpResult.refundId || null, now, order.id);
  }

  // A return is complete only after the provider confirms the refund is processed.
  if (returnId && refundRec.status === "processed") {
    await db.prepare(`
      UPDATE returns
      SET status = 'completed', updated_at = ?
      WHERE id = ?
    `).run(new Date().toISOString(), returnId);
  }

  // Never describe a pending provider refund as processed in customer email.
  if (refundRec.status === "processed") {
    sendRefundConfirmationEmail(order, amount, rzpResult.refundId || refundRec.id).catch((error) => {
      console.error(`[Refund] Processed refund notification failed for order ${order.id}.`, error);
    });
  }

  await writeAuditLog({
    actor: admin.email,
    action: "refund_issued",
    entityType: "order",
    entityId: order.id,
    metadata: {
      amount,
      refundId: rzpResult.refundId,
      reason,
      totalRefunded: processedTotal,
    },
    ipAddress: req.headers.get("x-forwarded-for"),
  });

  return NextResponse.json({
    success: true,
    refund: refundRec,
    message: refundRec.status === "processed"
      ? `Refund of ₹${amount} processed successfully.`
      : `Refund of ₹${amount} initiated; awaiting provider confirmation.`,
  });
}
