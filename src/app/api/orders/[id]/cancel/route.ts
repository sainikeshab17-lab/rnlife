import { NextRequest, NextResponse } from "next/server";
import { getOrderById, isOrderOwnedByCustomer, requestOrderCancellation, stripGuestToken } from "@/lib/db/orders";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/orders/[id]/cancel
 * Customer-initiated cancellation request.
 * Authenticated via guest_token header/query or customer_email match.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const order = await getOrderById(id);

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const body = await req.json();
    const { reason, token } = body;

    // Authorization check: guest_token or customer_email
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

    if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
      return NextResponse.json(
        { error: "Please provide a valid cancellation reason (at least 5 characters)." },
        { status: 400 }
      );
    }

    const result = await requestOrderCancellation(order.id, reason.trim());
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const updated = await getOrderById(order.id);
    return NextResponse.json({
      success: true,
      message: "Cancellation request received and pending store review.",
      order: updated ? stripGuestToken(updated) : null,
    });
  } catch (err: unknown) {
    console.error("Cancellation request failed:", err);
    return NextResponse.json(
      { error: "Failed to process cancellation request." },
      { status: 500 }
    );
  }
}
