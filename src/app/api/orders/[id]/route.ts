import { NextRequest, NextResponse } from "next/server";
import { getOrderById, getOrderByNumber } from "@/lib/db/orders";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const email = searchParams.get("email");

    // Lookup by internal ID or Order Number
    let order = await getOrderById(id);
    if (!order) {
      order = await getOrderByNumber(id);
    }

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Authorization check: Must provide either matching guest_token, matching customer_email, or be an admin
    const isAuthorized =
      (token && order.guest_token === token) ||
      (email && order.customer_email.toLowerCase() === email.toLowerCase()) ||
      searchParams.get("role") === "admin";

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Unauthorized access to order details. Please provide authentication or guest token." },
        { status: 403 }
      );
    }

    return NextResponse.json({ order });
  } catch (err: any) {
    console.error("Error in GET /api/orders/[id]:", err);
    return NextResponse.json({ error: "Failed to fetch order details" }, { status: 500 });
  }
}
