import { NextRequest, NextResponse } from "next/server";
import { getOrderById, getOrderByNumber, isOrderOwnedByCustomer, stripGuestToken } from "@/lib/db/orders";
import { createClient } from "@/lib/supabase/server";
import { requireAdminAuth } from "@/lib/auth/admin-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    // Lookup by internal ID or Order Number
    let order = await getOrderById(id);
    if (!order) {
      order = await getOrderByNumber(id);
    }

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (!order.is_confirmed || (["pending_payment", "pending_advance"].includes(order.payment_status) && !["COD", "Cash on Delivery"].includes(order.payment_method))) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const isAccountOwner = Boolean(data.user && isOrderOwnedByCustomer(order, {
      userId: data.user.id,
      email: data.user.email,
      emailVerified: Boolean(data.user.email_confirmed_at),
    }));
    const isAdmin = Boolean(await requireAdminAuth(req));
    const isAuthorized = Boolean((token && order.guest_token === token) || isAccountOwner || isAdmin);

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Unauthorized access to order details. Please provide authentication or guest token." },
        { status: 403 }
      );
    }

    return NextResponse.json({ order: stripGuestToken(order) });
  } catch (err: unknown) {
    console.error("Error in GET /api/orders/[id]:", err);
    return NextResponse.json({ error: "Failed to fetch order details" }, { status: 500 });
  }
}
