import { NextRequest, NextResponse } from "next/server";
import { getOrderById, isOrderOwnedByCustomer, requestReturnOrExchange, stripGuestToken } from "@/lib/db/orders";
import { RETURN_REASONS } from "@/lib/policies";
import { createClient } from "@/lib/supabase/server";

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
    const { type, reason, customerNote, items, token } = body;

    // Authorization
    const authHeader = req.headers.get("x-order-token");
    const providedToken = token || authHeader;

    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const isAccountOwner = Boolean(authData.user && isOrderOwnedByCustomer(order, {
      userId: authData.user.id,
      email: authData.user.email,
      emailVerified: Boolean(authData.user.email_confirmed_at),
    }));
    const isAuthorized = Boolean((providedToken && providedToken === order.guest_token) || isAccountOwner);

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

    if (typeof reason !== "string" || !(RETURN_REASONS as readonly string[]).includes(reason)) {
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
      items: items.map((item: unknown) => {
        const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
        const requestedExchangeSize = typeof record.requestedExchangeSize === "string"
          ? record.requestedExchangeSize
          : undefined;
        return {
          orderItemId: typeof record.orderItemId === "string" ? record.orderItemId : "",
          quantity: Number(record.quantity) || 1,
          ...(requestedExchangeSize ? { requestedExchangeSize } : {}),
        };
      }),
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const updated = await getOrderById(order.id);
    return NextResponse.json({
      success: true,
      returnId: result.returnId,
      message: `${type === "exchange" ? "Exchange" : "Return"} request submitted successfully.`,
      order: updated ? stripGuestToken(updated) : null,
    });
  } catch (err: unknown) {
    console.error("Return request failed:", err);
    return NextResponse.json(
      { error: "Failed to process return request." },
      { status: 500 }
    );
  }
}
