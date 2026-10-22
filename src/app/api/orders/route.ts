import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrdersByCustomer } from "@/lib/db/orders";
import { safePostgresDiagnostic } from "@/lib/db/sql";
import { respondWithCustomerOrders } from "@/services/customer-orders-api";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user?.id || !data.user.email) {
      return NextResponse.json({ error: "Please sign in to view your orders." }, { status: 401 });
    }

    const userId = data.user.id;
    const verifiedEmail = data.user.email_confirmed_at ? data.user.email : "";
    return respondWithCustomerOrders(() => getOrdersByCustomer(
      userId,
      verifiedEmail
    ));
  } catch (err: unknown) {
    console.error("[GET /api/orders] Request failed.", JSON.stringify(safePostgresDiagnostic("GET /api/orders", err)));
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}
