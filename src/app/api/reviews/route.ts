import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getDb } from "@/lib/db";
import { isTransientDatabaseCapacityError } from "@/services/inventory-read";
import { safePostgresDiagnostic } from "@/lib/db/sql";

export const dynamic = "force-dynamic";
async function retryCapacityRead<T>(read: () => Promise<T>): Promise<T> {
  try { return await read(); }
  catch (error) {
    if (!isTransientDatabaseCapacityError(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 150));
    return read();
  }
}
const ReviewInput = z.object({
  productId: z.string().regex(/^rnl-design-0[1-8]$/),
  orderItemId: z.string().min(1).max(100),
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(10).max(2000),
}).strict();

export async function GET(request: Request) {
  const productId = new URL(request.url).searchParams.get("productId");
  if (!productId || !/^rnl-design-0[1-8]$/.test(productId)) return NextResponse.json({ error: "Invalid product." }, { status: 400 });
  try {
    const db = getDb();
    const summaryQuery = db.prepare(`SELECT COUNT(*)::int AS count, AVG(rating)::float AS average
      FROM product_reviews WHERE product_id = ? AND status = 'approved' AND verified_purchase = TRUE`);
    const summary = await retryCapacityRead(() => summaryQuery.get<{ count: number; average: number | null }>(productId));
    if (!summary || summary.count < 5) return NextResponse.json({ visible: false });
    const reviewsQuery = db.prepare(`SELECT rating, body, created_at FROM product_reviews
      WHERE product_id = ? AND status = 'approved' AND verified_purchase = TRUE ORDER BY created_at DESC`);
    const reviews = await retryCapacityRead(() => reviewsQuery.all<{ rating: number; body: string; created_at: string }>(productId));
    return NextResponse.json({ visible: true, count: summary.count, average: summary.average, reviews });
  } catch (error) {
    console.error("[reviews] Unable to load approved reviews.", JSON.stringify(safePostgresDiagnostic("SELECT approved verified reviews", error)));
    return NextResponse.json({ error: "Reviews are temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) return NextResponse.json({ error: "Sign in to submit a review." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid review." }, { status: 400 }); }
  const parsed = ReviewInput.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check the review fields and try again." }, { status: 400 });
  try {
    const db = getDb();
    const purchase = await db.prepare(`SELECT oi.id FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE oi.id = ? AND oi.product_id = ? AND o.user_id = ? AND o.order_status = 'delivered' LIMIT 1`)
      .get<{ id: string }>(parsed.data.orderItemId, parsed.data.productId, data.user.id);
    if (!purchase) return NextResponse.json({ error: "A delivered purchase of this design is required." }, { status: 403 });
    await db.prepare(`INSERT INTO product_reviews (id, product_id, user_id, order_item_id, rating, body)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .run(`rev_${randomUUID().replace(/-/g, "")}`, parsed.data.productId, data.user.id, purchase.id, parsed.data.rating, parsed.data.body);
    return NextResponse.json({ success: true, status: "pending_moderation" }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error as { code: unknown }).code === "23505") {
      return NextResponse.json({ error: "A review for this purchased item has already been submitted." }, { status: 409 });
    }
    console.error("[reviews] Unable to save review.", JSON.stringify(safePostgresDiagnostic("INSERT verified product review", error)));
    return NextResponse.json({ error: "Review submission is temporarily unavailable." }, { status: 503 });
  }
}
