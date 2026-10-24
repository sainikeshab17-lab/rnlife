import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth/admin-auth";
import { getDb } from "@/lib/db";
import { applyRefundReconciliation, getOrderById } from "@/lib/db/orders";
import { getRazorpayClient } from "@/lib/razorpay";
import { sendRefundConfirmationEmail } from "@/services/notification-service";
import { reconcileRefundReservation, type RefundProviderResolution, type RefundReconciliationReservation } from "@/services/refund-reconciliation";
import { writeAuditLog } from "@/lib/db/audit";

type ReconciliationRouteDependencies = {
  requireAdminAuth: typeof requireAdminAuth;
  getDb: typeof getDb;
  getOrderById: typeof getOrderById;
  getRazorpayClient: typeof getRazorpayClient;
  applyRefundReconciliation: typeof applyRefundReconciliation;
  sendRefundConfirmationEmail: typeof sendRefundConfirmationEmail;
  reconcileRefundReservation: typeof reconcileRefundReservation;
  writeAuditLog: typeof writeAuditLog;
};

const routeDependencies: ReconciliationRouteDependencies = {
  requireAdminAuth, getDb, getOrderById, getRazorpayClient, applyRefundReconciliation,
  sendRefundConfirmationEmail, reconcileRefundReservation, writeAuditLog,
};

export function createRefundReconciliationPost(deps = routeDependencies) {
  return async function POST(
    req: NextRequest,
    context: { params: Promise<{ refundId: string }> }
  ) {
    const admin = await deps.requireAdminAuth(req);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (admin.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { refundId } = await context.params;
    const reservation = await deps.getDb().prepare(`
      SELECT r.*, o.order_number FROM refund_records r
      JOIN orders o ON o.id = r.order_id WHERE r.id = ?
    `).get<RefundReconciliationReservation>(refundId);
    if (!reservation) return NextResponse.json({ error: "Refund record not found." }, { status: 404 });

    const order = await deps.getOrderById(reservation.order_id);
    if (!order) return NextResponse.json({ error: "Refund order not found." }, { status: 404 });

    if (reservation.status !== "pending") {
      if (reservation.status === "processed") {
        await deps.sendRefundConfirmationEmail(order, reservation.amount_paisa / 100, reservation.razorpay_refund_id || reservation.id);
      }
      return NextResponse.json({ status: reservation.status, refund: reservation });
    }

    let applied: Awaited<ReturnType<typeof deps.applyRefundReconciliation>> | undefined;
    const reconciliation = await deps.reconcileRefundReservation({
      reservation,
      provider: {
        fetchRefund: (paymentId, providerRefundId) => deps.getRazorpayClient().payments.fetchRefund(paymentId, providerRefundId),
        fetchRefunds: async (paymentId) => (await deps.getRazorpayClient().payments.fetchMultipleRefund(paymentId, { count: 100 })).items,
      },
      apply: async (resolution: RefundProviderResolution) => {
        if (resolution.outcome !== "processed" && resolution.outcome !== "failed" && resolution.outcome !== "pending") return undefined;
        if (!resolution.refund || typeof resolution.refund.id !== "string") return undefined;
        applied = await deps.applyRefundReconciliation({
          orderId: order.id,
          refundRecordId: reservation.id,
          providerRefundId: resolution.refund.id,
          providerStatus: resolution.outcome,
          failureReason: resolution.outcome === "failed" ? "Razorpay confirmed refund failure." : undefined,
        });
        return applied.refund;
      },
      notifyProcessed: async (refund) => deps.sendRefundConfirmationEmail(order, refund.amount_paisa / 100, refund.razorpay_refund_id!),
    });
    const resolution = reconciliation.resolution;

    if (["missing", "uncertain", "contradictory"].includes(resolution.outcome)) {
      await deps.writeAuditLog({
        actor: admin.email,
        action: `refund_reconciliation_${resolution.outcome}`,
        entityType: "refund",
        entityId: reservation.id,
        metadata: { orderId: order.id, paymentId: reservation.razorpay_payment_id, refundId: reservation.razorpay_refund_id, reason: resolution.reason },
        ipAddress: req.headers.get("x-forwarded-for"),
      });
      return NextResponse.json({ status: resolution.outcome, error: resolution.reason, reservationRemainsPending: true }, {
        status: resolution.outcome === "contradictory" ? 409 : 202,
      });
    }

    if (!resolution.refund || !["processed", "failed", "pending"].includes(resolution.outcome)) {
      return NextResponse.json({ status: "uncertain", reservationRemainsPending: true }, { status: 202 });
    }

    if (!applied) return NextResponse.json({ status: "uncertain", reservationRemainsPending: true }, { status: 202 });

    if (applied.outcome === "not_found") return NextResponse.json({ error: "Refund reservation not found." }, { status: 404 });
    if (applied.outcome === "deferred") return NextResponse.json({ status: "deferred", error: "Shipment operation is unresolved; retry refund reconciliation after the shipment state is resolved." }, { status: 202 });
    if (applied.outcome === "conflict") {
      await deps.writeAuditLog({ actor: admin.email, action: "refund_reconciliation_state_conflict", entityType: "refund", entityId: reservation.id,
        metadata: { orderId: order.id, providerRefundId: resolution.refund.id, providerStatus: resolution.outcome, storedStatus: applied.refund?.status } });
      return NextResponse.json({ status: "contradictory", refund: applied.refund }, { status: 409 });
    }

    await deps.writeAuditLog({ actor: admin.email, action: `refund_reconciled_${applied.refund?.status ?? "unknown"}`, entityType: "refund",
      entityId: reservation.id, metadata: { orderId: order.id, providerRefundId: resolution.refund.id, providerStatus: resolution.outcome } });

    return NextResponse.json({ status: applied.refund?.status ?? resolution.outcome, refund: applied.refund });
  };
}
