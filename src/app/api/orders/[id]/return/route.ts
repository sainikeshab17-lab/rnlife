import { NextRequest, NextResponse } from "next/server";
import { getOrderById, requestReturnOrExchange } from "@/lib/db/orders";
import { RETURN_REASONS } from "@/lib/policies";

export const dynamic = "force-dynamic";

/**
 * POST /api/orders/[id]/return
 * Customer-initiated return or exchange request.
 * Authenticated via guest_token or matching email.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const order = await getOrderById(id);

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const body = await req.json();
    const { type, reason, customerNote, items, token, email } = body;

    // Authorization
    const authHeader = req.headers.get("x-order-token");
    const providedToken = token || authHeader;
    const providedEmail = email ? email.toLowerCase().trim() : null;

    const isAuthorized =
      (providedToken && providedToken === order.guest_token) ||
      (providedEmail && providedEmail === order.customer_email.toLowerCase().trim());

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid access credentials for this order." },
        { status: 403 }
      );
    }

    if (type !== "return" && type !== "exchange") {
      return NextResponse.json(
        { error: "Invalid type: must be 'return' or 'exchange'." },
        { status: 400 }
      );
    }

    if (!reason || !RETURN_REASONS.includes(reason as any)) {
      return NextResponse.json(
        { error: `Invalid return reason. Must be one of: ${RETURN_REASONS.join(", ")}` },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Please specify at least one order item to return or exchange." },
        { status: 400 }
      );
    }

    const result = await requestReturnOrExchange({
      orderId: order.id,
      type,
      reason,
      customerNote,
      items: items.map((it: any) => ({
        orderItemId: it.orderItemId,
        quantity: Number(it.quantity) || 1,
        requestedExchangeSize: it.requestedExchangeSize || null,
      })),
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const updated = await getOrderById(order.id);
    return NextResponse.json({
      success: true,
      returnId: result.returnId,
      message: `${type === "exchange" ? "Exchange" : "Return"} request submitted successfully.`,
      order: updated,
    });
  } catch (err: any) {
    console.error("Return request failed:", err);
    return NextResponse.json(
      { error: "Failed to process return request." },
      { status: 500 }
    );
  }
}
