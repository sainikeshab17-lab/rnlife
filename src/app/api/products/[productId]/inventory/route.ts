import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId } = await params;
  try {
    const rows = await getDb().prepare(
      "SELECT size, stock, reserved FROM inventory WHERE product_id = ?"
    ).all<{ size: string; stock: number; reserved: number }>(productId);
    const bySize = new Map(rows.map((row) => [row.size, row]));
    return NextResponse.json({
      sizes: SIZES.map((size) => {
        const row = bySize.get(size);
        const available = row ? Math.max(0, row.stock - row.reserved) : 0;
        return { size, available, status: !row || available === 0 ? "sold_out" : available <= 5 ? "low_stock" : "in_stock" };
      }),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[products/inventory] Unable to read availability.", error);
    return NextResponse.json({ error: "Availability is temporarily unavailable." }, { status: 503 });
  }
}
