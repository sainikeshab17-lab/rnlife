import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth/admin-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Collections are derived from the live products table because this project has no collections table.
export async function GET(req: NextRequest) {
  const admin = await requireAdminAuth(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (admin.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase.from("products")
      .select("id,name,slug,collection_slug,is_active,images,created_at")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[admin/collections GET]", error.message);
      return NextResponse.json({ error: "Unable to load live product collections." }, { status: 500 });
    }
    const groups = new Map<string, { slug:string; products:Array<{id:string;name:string;slug:string;is_active:boolean;image:string}> }>();
    for (const p of data ?? []) {
      const slug = (p.collection_slug || "uncategorized").trim() || "uncategorized";
      if (!groups.has(slug)) groups.set(slug, { slug, products: [] });
      groups.get(slug)!.products.push({
        id:p.id, name:p.name, slug:p.slug, is_active:!!p.is_active,
        image:Array.isArray(p.images) ? (p.images[0] ?? "") : "",
      });
    }
    return NextResponse.json({ collections: Array.from(groups.values()).map(g => ({
      ...g, total_products:g.products.length, active_products:g.products.filter(p=>p.is_active).length,
    })) });
  } catch (error) {
    console.error("[admin/collections GET]", error);
    return NextResponse.json({ error: "Unable to load live product collections." }, { status: 500 });
  }
}
