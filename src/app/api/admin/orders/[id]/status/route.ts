import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth/admin-auth";
import { getDb, DbOrder } from "@/lib/db/index";
import { isValidAdminTransition, requiresRefund } from "@/lib/order-status-machine";
import { writeAuditLog } from "@/lib/db/audit";
import { releaseInventoryReservation } from "@/lib/db/orders";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/orders/[id]/status
 * Body: { status: string, note?: string }
 *
 * Rules:
 * - Only admin-initiatable transitions are allowed (see order-status-machine.ts).
 * - Transitioning to "paid" is FORBIDDEN — payment status only changes via
 *   Razorpay checkout/webhook verification.
 * - Cancelling a paid/processing order sets order to "cancelled" and marks
 *   refund_status = "refund_pending" (actual refund must be processed separately).
 * - Every transition is recorded in order_status_history and audit_logs.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = requireAdminAuth(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getDb();

  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as DbOrder | undefined;
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  const body = await req.json();
  const { status: newStatus, note } = body ?? {};

  if (typeof newStatus !== "string") {
    return NextResponse.json({ error: "status is required." }, { status: 400 });
  }

  // Hard block: admins cannot set payment-only statuses via this endpoint
  if (newStatus === "paid") {
    return NextResponse.json(
      { error: "Payment status cannot be set by admin. It is controlled by Razorpay webhook verification only." },
      { status: 422 }
    );
  }

  // Validate transition
  if (!isValidAdminTransition(order.order_status, newStatus)) {
    return NextResponse.json(
      {
        error: `Invalid status transition: ${order.order_status} → ${newStatus}`,
        current: order.order_status,
        allowed: [],
      },
      { status: 422 }
    );
  }

  const now = new Date().toISOString();
  const refundNeeded = requiresRefund(order.order_status, newStatus);

  // Run update in a single exec block (SQLite is synchronous)
  db.prepare(`
    UPDATE orders
    SET order_status = ?,
        refund_status = CASE WHEN ? = 1 THEN 'refund_pending' ELSE refund_status END,
        cancelled_reason = CASE WHEN ? = 'cancelled' THEN ? ELSE cancelled_reason END,
        updated_at = ?
    WHERE id = ?
  `).run(
    newStatus,
    refundNeeded ? 1 : 0,
    newStatus,
    note ?? null,
    now,
    id
  );

  // Release inventory reservation for cancellations of unpaid orders
  if (newStatus === "cancelled" && order.payment_status === "pending_payment") {
    const items = db.prepare("SELECT product_id, size, quantity FROM order_items WHERE order_id = ?").all(id) as Array<{ product_id: string; size: string; quantity: number }>;
    releaseInventoryReservation(items.map(i => ({ productId: i.product_id, size: i.size, quantity: i.quantity })));
  }

  // Record status history
  const histId = `sh_${randomBytes(8).toString("hex")}`;
  db.prepare(`
    INSERT INTO order_status_history (id, order_id, from_status, to_status, actor, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(histId, id, order.order_status, newStatus, admin.email, note ?? null, now);

  writeAuditLog({
    actor: admin.email,
    action: "order_status_changed",
    entityType: "order",
    entityId: id,
    before: { status: order.order_status },
    after: { status: newStatus, refund_pending: refundNeeded },
    metadata: { note, order_number: order.order_number },
    ipAddress: req.headers.get("x-forwarded-for"),
  });

  const updated = db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as DbOrder;

  return NextResponse.json({
    success: true,
    order: updated,
    refund_required: refundNeeded,
    message: refundNeeded
      ? `Order cancelled. A refund of ₹${order.total} is pending. Process manually via Razorpay dashboard.`
      : `Order status updated to ${newStatus}.`,
  });
}
