import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ProductSchema = z.object({
  name: z.string().trim().min(1, "Product name is required").max(200),
  slug: z.string().trim().min(1, "Slug is required").max(220),
  tagline: z.string().max(500).nullable().optional(),
  description: z.string().max(10000).nullable().optional(),
  category: z.string().trim().min(1, "Category is required").max(100),
  collection_slug: z.string().max(100).nullable().optional(),
  sku: z.string().trim().min(1, "SKU is required").max(100),
  price: z.coerce.number().default(999),
  compare_at_price: z.coerce.number().finite().min(0).nullable().optional(),
  fit: z.string().max(50).nullable().optional(),
  gsm: z.coerce.number().int().min(1).max(1000).nullable().optional(),
  sleeve: z.string().max(100).nullable().optional(),
  neck: z.string().max(100).nullable().optional(),
  fabric_composition: z.string().max(300).nullable().optional(),
  print_technique: z.string().max(300).nullable().optional(),
  images: z.array(z.string().min(1)).max(20).optional(),
  sizes: z.array(z.string().trim().min(1).max(20)).max(30).optional(),
  genders: z.array(z.enum(["Men", "Women", "Unisex"])).max(3).optional(),
  colors: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
  color_variants: z.array(
    z.object({
      name: z.string().trim().min(1).max(100),
      hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    })
  ).max(30).optional(),
  stock: z.coerce.number().int().min(0).max(100000).optional(),
  is_active: z.boolean().optional(),
});

const UpdateSchema = ProductSchema.partial();

async function getSeller() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (data.user.app_metadata?.role !== "seller" && data.user.app_metadata?.role !== "admin") {
    return {
      user: null,
      response: NextResponse.json({ error: "Seller access required" }, { status: 403 }),
    };
  }

  return { user: data.user, response: null };
}

function handleDatabaseError(error: { code?: string; message: string }) {
  if (error.code === "23505") {
    return NextResponse.json(
      { error: "A product with this slug or SKU already exists. Use a unique value." },
      { status: 409 }
    );
  }

  console.error("Seller products database error:", error.code, error.message);

  return NextResponse.json(
    { error: "Unable to process the product request." },
    { status: 500 }
  );
}

export async function GET() {
  const auth = await getSeller();
  if (auth.response || !auth.user) return auth.response!;

  const db = createAdminSupabaseClient();
  const { data, error } = await db
    .from("products")
    .select("*")
    .eq("seller_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (error) return handleDatabaseError(error);

  return NextResponse.json({ products: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await getSeller();
  if (auth.response || !auth.user) return auth.response!;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = ProductSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid product details.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const db = createAdminSupabaseClient();

  // Enforce authoritative ₹999 price server-side
  const { data, error } = await db
    .from("products")
    .insert({
      ...input,
      price: 999, // Strict fixed ₹999 price per Section 7 & 9
      seller_id: auth.user.id,
      description: input.description ?? null,
      tagline: input.tagline ?? null,
      collection_slug: input.collection_slug ?? null,
      compare_at_price: input.compare_at_price ?? null,
      fit: input.fit ?? null,
      gsm: input.gsm ?? null,
      sleeve: input.sleeve ?? null,
      neck: input.neck ?? null,
      fabric_composition: input.fabric_composition ?? null,
      print_technique: input.print_technique ?? null,
      images: input.images ?? [],
      sizes: input.sizes ?? [],
      colors: input.colors ?? [],
      color_variants: input.color_variants ?? [],
      stock: input.stock ?? 0,
      is_active: input.is_active ?? false,
    })
    .select("*")
    .single();

  if (error) return handleDatabaseError(error);

  return NextResponse.json({ product: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await getSeller();
  if (auth.response || !auth.user) return auth.response!;

  const productId = request.nextUrl.searchParams.get("id");

  if (!productId) {
    return NextResponse.json({ error: "Product ID is required." }, { status: 400 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = UpdateSchema.safeParse(body);

  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
    return NextResponse.json({ error: "Invalid or empty product update." }, { status: 400 });
  }

  const updateData = { ...parsed.data };
  // Fixed ₹999 price enforcement: price cannot be changed
  if ("price" in updateData) {
    updateData.price = 999;
  }

  const db = createAdminSupabaseClient();

  const { data, error } = await db
    .from("products")
    .update(updateData)
    .eq("id", productId)
    .eq("seller_id", auth.user.id)
    .select("*")
    .maybeSingle();

  if (error) return handleDatabaseError(error);

  if (!data) {
    return NextResponse.json(
      { error: "Product not found or you do not own this product." },
      { status: 404 }
    );
  }

  return NextResponse.json({ product: data });
}
