import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth/admin-auth";
import { getDb, DbRefundRecord } from "@/lib/db/index";
import { getOrderById, recordRefund } from "@/lib/db/orders";
import { createRazorpayRefund } from "@/lib/razorpay";
import { writeAuditLog } from "@/lib/db/audit";
import { sendRefundConfirmationEmail } from "@/services/notification-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/refunds
 * List all refund records across orders.
 */
export async function GET(req: NextRequest) {
  const admin = requireAdminAuth(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const refunds = db
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
  const admin = requireAdminAuth(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { orderId, returnId, amount, reason } = body;

  if (!orderId || !amount || amount <= 0) {
    return NextResponse.json({ error: "Order ID and a positive refund amount are required." }, { status: 400 });
  }

  const order = getOrderById(orderId);
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  if (order.payment_status !== "paid" && !order.razorpay_payment_id) {
    return NextResponse.json(
      { error: "Cannot issue refund for an unpaid order or missing payment ID." },
      { status: 400 }
    );
  }

  const db = getDb();

  // Validate amount does not exceed remaining refundable balance
  const existingRefundsRow = db
    .prepare("SELECT COALESCE(SUM(amount), 0) as total FROM refund_records WHERE order_id = ? AND status != 'failed'")
    .get(orderId) as { total: number };

  const remainingRefundable = order.total - existingRefundsRow.total;
  if (amount > remainingRefundable) {
    return NextResponse.json(
      { error: `Refund amount ₹${amount} exceeds remaining refundable balance ₹${remainingRefundable}.` },
      { status: 400 }
    );
  }

  // Convert amount to paisa for Razorpay
  const amountPaisa = Math.round(amount * 100);

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
    recordRefund({
      orderId: order.id,
      returnId: returnId || null,
      razorpayPaymentId: order.razorpay_payment_id,
      amount,
      status: "failed",
      reason: reason || "Admin refund attempt",
      initiatedBy: admin.email,
      failureReason: rzpResult.error || "Razorpay API error",
    });

    return NextResponse.json(
      { error: `Refund failed: ${rzpResult.error}` },
      { status: 502 }
    );
  }

  // Record successful/pending refund
  const refundRec = recordRefund({
    orderId: order.id,
    returnId: returnId || null,
    razorpayRefundId: rzpResult.refundId,
    razorpayPaymentId: order.razorpay_payment_id,
    amount,
    status: rzpResult.status === "processed" ? "processed" : "pending",
    reason: reason || "Admin customer refund",
    initiatedBy: admin.email,
  });

  // Check if fully refunded
  const newTotalRefunded = existingRefundsRow.total + amount;
  if (newTotalRefunded >= order.total) {
    db.prepare(`
      UPDATE orders
      SET order_status = 'refunded', refund_status = 'refunded', refund_id = ?, updated_at = ?
      WHERE id = ?
    `).run(rzpResult.refundId || null, new Date().toISOString(), order.id);
  } else {
    db.prepare(`
      UPDATE orders
      SET refund_status = 'partially_refunded', refund_id = ?, updated_at = ?
      WHERE id = ?
    `).run(rzpResult.refundId || null, new Date().toISOString(), order.id);
  }

  // If return request linked, update return status to completed
  if (returnId) {
    db.prepare(`
      UPDATE returns
      SET status = 'completed', updated_at = ?
      WHERE id = ?
    `).run(new Date().toISOString(), returnId);
  }

  // Send customer email notification
  sendRefundConfirmationEmail(order, amount, rzpResult.refundId || refundRec.id).catch(console.error);

  writeAuditLog({
    actor: admin.email,
    action: "refund_issued",
    entityType: "order",
    entityId: order.id,
    metadata: {
      amount,
      refundId: rzpResult.refundId,
      reason,
      totalRefunded: newTotalRefunded,
    },
    ipAddress: req.headers.get("x-forwarded-for"),
  });

  return NextResponse.json({
    success: true,
    refund: refundRec,
    message: `Refund of ₹${amount} initiated successfully.`,
  });
}
