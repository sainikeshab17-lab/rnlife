import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth/admin-auth";
import { getOrderById, decideOrderCancellation } from "@/lib/db/orders";
import { writeAuditLog } from "@/lib/db/audit";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/orders/[id]/cancel
 * Admin decision on cancellation request.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = requireAdminAuth(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const order = getOrderById(id);
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  const body = await req.json();
  const { approved, note } = body;

  if (typeof approved !== "boolean") {
    return NextResponse.json({ error: "Field 'approved' must be a boolean." }, { status: 400 });
  }

  const result = decideOrderCancellation(id, approved, admin.email, note);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  writeAuditLog({
    actor: admin.email,
    action: approved ? "order_cancellation_approved" : "order_cancellation_rejected",
    entityType: "order",
    entityId: id,
    before: { order_status: order.order_status, cancellation_requested: order.cancellation_requested },
    after: { order_status: result.newStatus, cancellation_requested: 0, note },
    ipAddress: req.headers.get("x-forwarded-for"),
  });

  const updated = getOrderById(id);
  return NextResponse.json({ success: true, order: updated });
}
