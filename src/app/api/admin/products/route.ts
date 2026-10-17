import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth/admin-auth";
import { getDb, DbProductOverride } from "@/lib/db/index";
import { PRODUCTS } from "@/data/mock-data";
import { writeAuditLog } from "@/lib/db/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/products
 * Returns all 8 products with their DB-backed visibility override status.
 * Price is always ₹999 — it is not returned from DB and cannot be overridden.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdminAuth(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = getDb();
    const overrides = await db.prepare("SELECT * FROM product_overrides").all<DbProductOverride>();
    const overrideMap: Record<string, DbProductOverride> = {};
    for (const o of overrides) overrideMap[o.product_id] = o;

    const products = PRODUCTS.map((p) => {
      const override = overrideMap[p.id];
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        sku: p.sku,
        price: 999, // Always locked
        fit: p.fit,
        image: p.colors[0]?.images[0] ?? "",
        description: override?.custom_description ?? p.description,
        is_active: override ? override.is_active === 1 : true,
        updated_by: override?.updated_by ?? null,
        updated_at: override?.updated_at ?? null,
      };
    });

    return NextResponse.json({ products });
  } catch (err) {
    console.error("[admin/products]", err);
    return NextResponse.json({ error: "Failed to load products." }, { status: 500 });
  }
}

const UpdateProductSchema = z.object({
  is_active: z.boolean().optional(),
  custom_description: z.string().max(2000).optional().nullable(),
});

/**
 * PATCH /api/admin/products/[id]
 * Allows updating visibility (is_active) and custom_description.
 * Price changes are rejected — always ₹999.
 */
export async function PATCH(req: NextRequest) {
  const admin = await requireAdminAuth(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  // Product ID extracted from query param since this is a shared route handler
  const productId = url.searchParams.get("id");
  if (!productId) return NextResponse.json({ error: "Product ID required." }, { status: 400 });

  const product = PRODUCTS.find((p) => p.id === productId);
  if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });

  const body = await req.json();

  // Reject any attempt to change price
  if (body.price !== undefined) {
    return NextResponse.json(
      { error: "Product price cannot be changed. All RIGHTNOWLIFE T-shirts are fixed at ₹999." },
      { status: 422 }
    );
  }

  const parsed = UpdateProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const { is_active, custom_description } = parsed.data;
  const db = getDb();
  const existing = await db.prepare("SELECT * FROM product_overrides WHERE product_id = ?").get<DbProductOverride>(productId);
  const now = new Date().toISOString();

  const newIsActive = is_active !== undefined ? (is_active ? 1 : 0) : (existing?.is_active ?? 1);
  const newDesc = custom_description !== undefined ? custom_description : existing?.custom_description ?? null;

  if (existing) {
    await db.prepare(`
      UPDATE product_overrides SET is_active = ?, custom_description = ?, updated_by = ?, updated_at = ?
      WHERE product_id = ?
    `).run(newIsActive, newDesc, admin.email, now, productId);
  } else {
    await db.prepare(`
      INSERT INTO product_overrides (product_id, is_active, custom_description, updated_by, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(productId, newIsActive, newDesc, admin.email, now);
  }

  await writeAuditLog({
    actor: admin.email,
    action: "product_updated",
    entityType: "product",
    entityId: productId,
    before: { is_active: existing?.is_active ?? 1, custom_description: existing?.custom_description },
    after: { is_active: newIsActive, custom_description: newDesc },
    ipAddress: req.headers.get("x-forwarded-for"),
  });

  return NextResponse.json({ success: true, product_id: productId, is_active: newIsActive === 1 });
}
