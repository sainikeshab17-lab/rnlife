import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth/admin-auth";
import { getDb, DbInventoryRow } from "@/lib/db/index";
import { PRODUCTS } from "@/data/mock-data";

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

    const productInfo: Record<string, { name: string; sku: string; image: string }> = {};
    for (const p of PRODUCTS) {
      productInfo[p.id] = {
        name: p.name,
        sku: p.sku,
        image: p.colors[0]?.images[0] ?? "",
      };
    }

    for (const row of rows) {
      if (!productMap[row.product_id]) {
        productMap[row.product_id] = {
          product_id: row.product_id,
          product_name: productInfo[row.product_id]?.name ?? row.product_id,
          sku: productInfo[row.product_id]?.sku ?? "",
          image: productInfo[row.product_id]?.image ?? "",
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

    return NextResponse.json({ inventory: Object.values(productMap) });
  } catch (err) {
    console.error("[admin/inventory]", err);
    return NextResponse.json({ error: "Failed to load inventory." }, { status: 500 });
  }
}
