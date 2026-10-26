import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth/admin-auth";
import { getDb, DbInventoryRow } from "@/lib/db/index";
import { getInventoryProductIdsMissingFromCatalog, getInventoryProductLabel } from "@/services/inventory-product-catalog";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/inventory
 * Returns full inventory grouped by product with available/reserved/sold breakdown.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdminAuth(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = getDb();
    const rows = await db.prepare("SELECT * FROM inventory ORDER BY product_id, size").all<DbInventoryRow>();

    // Group by product and enrich with product info
    const productMap: Record<string, {
      product_id: string;
      product_name: string;
      sku: string;
      image: string;
      sizes: Array<{ size: string; stock: number; reserved: number; available: number }>;
      total_stock: number;
      total_reserved: number;
      total_available: number;
    }> = {};

    const missingProductIds = getInventoryProductIdsMissingFromCatalog(rows.map((row) => row.product_id));
    if (missingProductIds.length) {
      console.warn("[admin/inventory] Inventory rows reference products missing from the storefront catalog.", {
        productIds: missingProductIds,
      });
    }

    for (const row of rows) {
      if (!productMap[row.product_id]) {
        const product = getInventoryProductLabel(row.product_id);
        productMap[row.product_id] = {
          product_id: row.product_id,
          product_name: product?.product_name ?? `Product not found (${row.product_id})`,
          sku: product?.sku ?? "",
          image: product?.image ?? "",
          sizes: [],
          total_stock: 0,
          total_reserved: 0,
          total_available: 0,
        };
      }
      const available = Math.max(0, row.stock - row.reserved);
      productMap[row.product_id].sizes.push({
        size: row.size,
        stock: row.stock,
        reserved: row.reserved,
        available,
      });
      productMap[row.product_id].total_stock += row.stock;
      productMap[row.product_id].total_reserved += row.reserved;
      productMap[row.product_id].total_available += available;
    }

    return NextResponse.json({ inventory: Object.values(productMap) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[admin/inventory]", err);
    return NextResponse.json({ error: "Failed to load inventory." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
