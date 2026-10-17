import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth/admin-auth";
import { getDb, DbInventoryRow, withTransaction } from "@/lib/db/index";
import { writeAuditLog } from "@/lib/db/audit";
import { randomBytes } from "crypto";
import { z } from "zod";

export const dynamic = "force-dynamic";

const AdjustSchema = z.object({
  new_stock: z.number().int().min(0).max(10_000),
  reason: z.string().trim().min(3, "Reason must be at least 3 characters").max(200),
});

/**
 * POST /api/admin/inventory/[productId]/[size]/adjust
 * Body: { new_stock: number, reason: string }
 *
 * Sets the absolute stock level for a product+size variant.
 * Cannot reduce stock below current reserved amount.
 * Records full adjustment history.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string; size: string }> }
) {
  const admin = await requireAdminAuth(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { productId, size } = await params;
  const db = getDb();

  const row = await db.prepare("SELECT * FROM inventory WHERE product_id = ? AND size = ?").get<DbInventoryRow>(productId, size);
  if (!row) return NextResponse.json({ error: "Inventory row not found." }, { status: 404 });

  const body = await req.json();
  const parsed = AdjustSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const { new_stock, reason } = parsed.data;

  // Cannot set stock below current reserved amount (would create negative available)
  if (new_stock < row.reserved) {
    return NextResponse.json({
      error: `Cannot set stock to ${new_stock}: ${row.reserved} units are currently reserved by pending orders. Cancel those orders first.`,
    }, { status: 422 });
  }

  const prev_stock = row.stock;
  const delta = new_stock - prev_stock;
  const now = new Date().toISOString();

  // Update inventory
  // Record adjustment
  const adjId = `iadj_${randomBytes(8).toString("hex")}`;
  await withTransaction(async (transaction) => {
    const locked = await transaction.prepare(
      "SELECT stock, reserved FROM inventory WHERE product_id = ? AND size = ? FOR UPDATE"
    ).get<DbInventoryRow>(productId, size);
    if (!locked) throw new Error("Inventory row disappeared during adjustment.");
    if (new_stock < locked.reserved) {
      throw new Error("Stock adjustment would go below the currently reserved quantity.");
    }
    await transaction.prepare("UPDATE inventory SET stock = ? WHERE product_id = ? AND size = ?")
      .run(new_stock, productId, size);
    await transaction.prepare(`
      INSERT INTO inventory_adjustments (id, product_id, size, prev_stock, new_stock, delta, reason, actor, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(adjId, productId, size, locked.stock, new_stock, new_stock - locked.stock, reason, admin.email, now);
  });

  await writeAuditLog({
    actor: admin.email,
    action: "inventory_adjusted",
    entityType: "inventory",
    entityId: `${productId}:${size}`,
    before: { stock: prev_stock },
    after: { stock: new_stock },
    metadata: { delta, reason, product_id: productId, size },
    ipAddress: req.headers.get("x-forwarded-for"),
  });

  return NextResponse.json({
    success: true,
    adjustment: { product_id: productId, size, prev_stock, new_stock, delta, reason },
  });
}

/**
 * GET /api/admin/inventory/[productId]/[size]/adjust
 * Returns adjustment history for a product+size.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string; size: string }> }
) {
  const admin = await requireAdminAuth(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { productId, size } = await params;
  const db = getDb();

  const history = await db.prepare(`
    SELECT * FROM inventory_adjustments
    WHERE product_id = ? AND size = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(productId, size);

  return NextResponse.json({ history });
}
