import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getInventoryProductLabel } from "@/services/inventory-product-catalog";
import { calculateSizeAvailability } from "@/services/product-inventory-availability";
import { isTransientDatabaseCapacityError, readInventoryWithRetry } from "@/services/inventory-read";

export const dynamic = "force-dynamic";

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId } = await params;
  if (!getInventoryProductLabel(productId)) {
    return NextResponse.json({ error: "Product inventory is not available." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const rows = await readInventoryWithRetry(() => getDb().prepare(
      "SELECT size, stock, reserved FROM inventory WHERE product_id = ?"
    ).all<{ size: string; stock: number; reserved: number }>(productId));
    if (rows.length === 0) {
      console.error(`[products/inventory] No inventory variants are configured for product ${productId}.`);
      return NextResponse.json({ error: "Inventory is not configured for this product." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({
      sizes: calculateSizeAvailability(SIZES, rows),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const databaseCode = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
    const capacityLimited = isTransientDatabaseCapacityError(error);
    console.error(`[products/inventory] Unable to read availability (database code ${databaseCode}, capacity_limited=${capacityLimited}).`);
    return NextResponse.json({
      error: capacityLimited ? "Inventory is temporarily at database connection capacity. Please retry shortly." : "Inventory is temporarily unavailable. Please retry shortly.",
      code: capacityLimited ? "database_capacity" : "inventory_unavailable",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
