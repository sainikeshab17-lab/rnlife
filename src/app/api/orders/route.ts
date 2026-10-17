import { NextRequest, NextResponse } from "next/server";
import { getOrdersByEmail, getAllOrders } from "@/lib/db/orders";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    const role = searchParams.get("role");

    // If staff/admin role requested
    if (role === "admin" || role === "seller") {
      const all = getAllOrders();
      return NextResponse.json({ orders: all });
    }

    if (!email) {
      return NextResponse.json(
        { error: "Email query parameter is required to retrieve customer order history" },
        { status: 400 }
      );
    }

    const orders = getOrdersByEmail(email);
    return NextResponse.json({ orders });
  } catch (err: any) {
    console.error("Error in GET /api/orders:", err);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}
