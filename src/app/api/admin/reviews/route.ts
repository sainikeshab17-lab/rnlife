import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth/admin-auth";
import { getDb } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";
const ModerationInput = z.object({ id: z.string().min(1).max(100), status: z.enum(["approved", "rejected"]) }).strict();

export async function GET(request: NextRequest) {
  const admin = await requireAdminAuth(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const reviews = await getDb().prepare("SELECT id, product_id, user_id, order_item_id, rating, body, status, created_at FROM product_reviews ORDER BY created_at DESC LIMIT 500").all();
    return NextResponse.json({ reviews });
  } catch (error) {
    console.error("[admin/reviews] Unable to load reviews.", error);
    return NextResponse.json({ error: "Unable to load reviews." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdminAuth(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = ModerationInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid moderation request." }, { status: 400 });
  try {
    const result = await getDb().prepare("UPDATE product_reviews SET status = ?, moderated_by = ?, moderated_at = NOW() WHERE id = ?")
      .run(parsed.data.status, admin.email, parsed.data.id);
    if (result.rowCount !== 1) return NextResponse.json({ error: "Review not found." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/reviews] Unable to moderate review.", error);
    return NextResponse.json({ error: "Unable to update review." }, { status: 503 });
  }
}
