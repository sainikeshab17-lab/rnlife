import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth/admin-auth";
import { getDb } from "@/lib/db/index";
import { applyRefundReconciliation, getOrderById, reserveRefund } from "@/lib/db/orders";
import { createRazorpayRefund } from "@/lib/razorpay";
import { writeAuditLog } from "@/lib/db/audit";
import { sendRefundConfirmationEmail } from "@/services/notification-service";
import { canInitiateRefund } from "@/lib/order-status-machine";

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

  if (!rzpResult.refundId) {
    return NextResponse.json({ error: "Refund outcome is uncertain; retain the reservation and reconcile with Razorpay." }, { status: 502 });
  }
  const providerStatus = rzpResult.status === "processed" ? "processed" : rzpResult.status === "failed" ? "failed" : "pending";
  const reconciliation = await applyRefundReconciliation({
    orderId: order.id, refundRecordId: reservation.id, providerRefundId: rzpResult.refundId,
    providerStatus, failureReason: providerStatus === "failed" ? "Razorpay confirmed refund failure." : undefined,
  });
  if (reconciliation.outcome === "deferred") {
    return NextResponse.json({ error: "Refund result is durably reserved and deferred until shipment reconciliation completes." }, { status: 202 });
  }
  if (!reconciliation.refund || ["conflict", "not_found"].includes(reconciliation.outcome)) {
    return NextResponse.json({ error: "Refund result requires manual reconciliation; do not retry the refund." }, { status: 409 });
  }
  const refundRec = reconciliation.refund;
  const processedTotalRow = await db.prepare("SELECT COALESCE(SUM(amount_paisa), 0) AS total FROM refund_records WHERE order_id = ? AND status = 'processed'").get<{ total: string | number }>(order.id);
  const processedTotal = Number(processedTotalRow?.total ?? 0) / 100;
  if (refundRec.status === "failed") {
    return NextResponse.json({ success: false, refund: refundRec,
      error: "Razorpay confirmed that the refund failed. No refund was processed; a new attempt may be made." }, { status: 502 });
  }
  if (returnId && refundRec.status === "processed") {
    await db.prepare("UPDATE returns SET status = 'completed', updated_at = ? WHERE id = ?").run(new Date().toISOString(), returnId);
  }
  if (refundRec.status === "processed") {
    sendRefundConfirmationEmail(order, amount, rzpResult.refundId).catch((error) => {
      console.error("[Refund] Processed refund notification failed for order " + order.id + ".", error);
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
