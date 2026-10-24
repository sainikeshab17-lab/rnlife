import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth/admin-auth";
import { listDeferredRazorpayRefundWebhooks, retryDeferredRazorpayRefundWebhook } from "@/services/razorpay/refund-webhook-inbox";
import { writeAuditLog } from "@/lib/db/audit";
import { getOrderById } from "@/lib/db/orders";
import { sendRefundConfirmationEmail } from "@/services/notification-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdminAuth(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (admin.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const events = await listDeferredRazorpayRefundWebhooks();
  return NextResponse.json({ events });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminAuth(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (admin.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (typeof body?.eventKey !== "string" || !/^[a-f0-9]{64}$/.test(body.eventKey)) {
    return NextResponse.json({ error: "A valid deferred event key is required." }, { status: 400 });
  }
  const outcome = await retryDeferredRazorpayRefundWebhook(body.eventKey);
  if (outcome.state === "processed" && outcome.refund?.status === "processed" && outcome.orderId && outcome.refund.razorpay_refund_id) {
    const order = await getOrderById(outcome.orderId);
    if (order) {
      sendRefundConfirmationEmail(order, outcome.refund.amount_paisa / 100, outcome.refund.razorpay_refund_id).catch(() => {
        console.error("[Refund webhook retry] Customer notification failed after durable refund processing.");
      });
    }
  }
  await writeAuditLog({
    actor: admin.email,
    action: `razorpay_refund_webhook_retry_${outcome.state}`,
    entityType: "razorpay_refund_webhook",
    entityId: body.eventKey,
    metadata: { state: outcome.state },
    ipAddress: req.headers.get("x-forwarded-for"),
  });
  return NextResponse.json({ status: outcome.state, refundId: outcome.refund?.razorpay_refund_id ?? null });
}
