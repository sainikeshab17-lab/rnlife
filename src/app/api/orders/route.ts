import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrdersByCustomer } from "@/lib/db/orders";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user?.id || !data.user.email) {
      return NextResponse.json({ error: "Please sign in to view your orders." }, { status: 401 });
    }

    const orders = await getOrdersByCustomer(
      data.user.id,
      data.user.email_confirmed_at ? data.user.email : ""
    );
    return NextResponse.json({ orders });
  } catch (err: unknown) {
    console.error("Error in GET /api/orders:", err);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}
