
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth/admin-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { PRODUCTS } from "@/data/mock-data";

export const dynamic = "force-dynamic";

const ProductSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(220),
  description: z.string().max(10000).nullable().optional(),
  category: z.string().trim().min(1).max(100),
  collection_slug: z.string().trim().min(1).max(100).nullable().optional(),
  tagline: z.string().max(500).nullable().optional(),
  fit: z.enum(["Regular", "Relaxed", "Oversized"]).nullable().optional(),
  gsm: z.coerce.number().int().min(1).max(1000).nullable().optional(),
  sleeve: z.string().max(100).nullable().optional(),
  neck: z.string().max(100).nullable().optional(),
  fabric_composition: z.string().max(300).nullable().optional(),
  print_technique: z.string().max(300).nullable().optional(),
  sku: z.string().trim().min(1).max(100).nullable().optional(),
  price: z.coerce.number().finite().min(0),
  compare_at_price: z.coerce.number().finite().min(0).nullable().optional(),
  images: z.array(z.string().url().or(z.string().regex(/^\/products\/[A-Za-z0-9/_\-.]+$/))).max(20).optional(),
  sizes: z.array(z.string().trim().min(1).max(20)).max(30).optional(),
  genders: z.array(z.enum(["Men", "Women", "Unisex"])).max(3).optional(),
  colors: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
  color_variants: z.array(z.object({ name: z.string().trim().min(1).max(100), hex: z.string().regex(/^#[0-9a-fA-F]{6}$/) })).max(30).optional(),
  stock: z.coerce.number().int().min(0).max(100000).optional(),
  is_active: z.boolean().optional(),
});

const UpdateProductSchema = ProductSchema.partial().extend({
  description: z.string().max(10000).nullable().optional(),
  compare_at_price: z.coerce.number().finite().min(0).nullable().optional(),
  storefront_slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).nullable().optional(),
});

async function authorizedAdmin(req: NextRequest) {
  const user = await requireAdminAuth(req);

  if (!user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (user.role !== "admin") {
    return {
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { user };
}

// GET /api/admin/products — list all products, including drafts.
export async function GET(req: NextRequest) {
  try {
    const auth = await authorizedAdmin(req);
    if (auth.response) return auth.response;

    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[admin/products GET]", error.message);
      return NextResponse.json(
        { error: "Failed to load products." },
        { status: 500 }
      );
    }

    return NextResponse.json({ products: (data ?? []).map((product) => ({
      ...product,
      image: product.image ?? (Array.isArray(product.images) ? product.images[0] ?? "" : ""),
    })) });
  } catch (error) {
    console.error("[admin/products GET]", error);
    return NextResponse.json(
      { error: "Failed to load products." },
      { status: 500 }
    );
  }
}

// POST /api/admin/products — create a product.
export async function POST(req: NextRequest) {
  try {
    const auth = await authorizedAdmin(req);
    if (auth.response) return auth.response;

    const body = await req.json();
    const parsed = ProductSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid product data.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const supabase = createAdminSupabaseClient();

    // Guard both canonical keys before insert so an admin does not create a second
    // database row for a storefront product that already exists under another slug.
    const [slugMatch, skuMatch, nameMatch] = await Promise.all([
      supabase.from("products").select("id,name,slug,sku,storefront_slug").or(`slug.eq.${input.slug},storefront_slug.eq.${input.slug}`).limit(2),
      input.sku ? supabase.from("products").select("id,name,slug,sku,storefront_slug").eq("sku", input.sku).limit(1) : Promise.resolve({ data: [], error: null }),
      supabase.from("products").select("id,name,slug,sku,storefront_slug").eq("name", input.name).limit(1),
    ]);
    const duplicate = [slugMatch, skuMatch, nameMatch].some((result) => result.error);
    if (duplicate) {
      console.error("[admin/products POST] Unable to check for an existing product before insert.");
      return NextResponse.json({ error: "Could not safely check for an existing product. Try again." }, { status: 503 });
    }
    const candidates = new Map<string, { id: string; name: string; slug: string; sku: string | null; storefront_slug: string | null }>();
    for (const result of [slugMatch, skuMatch, nameMatch]) {
      for (const row of result.data ?? []) candidates.set(row.id, row);
    }
    if (candidates.size) {
      return NextResponse.json({
        error: "A matching database product already exists. Link that row to the storefront product instead of creating a duplicate.",
        candidates: [...candidates.values()],
      }, { status: 409 });
    }

    const { data, error } = await supabase
      .from("products")
      .insert({
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        category: input.category,
        collection_slug: input.collection_slug ?? null,
        tagline: input.tagline ?? null,
        fit: input.fit ?? null,
        gsm: input.gsm ?? null,
        sleeve: input.sleeve ?? null,
        neck: input.neck ?? null,
        fabric_composition: input.fabric_composition ?? null,
        print_technique: input.print_technique ?? null,
        sku: input.sku ?? null,
        price: input.price,
        compare_at_price: input.compare_at_price ?? null,
        images: input.images ?? [],
        sizes: input.sizes ?? [],
        colors: input.colors ?? [],
        color_variants: input.color_variants ?? [],
        genders: input.genders ?? [],
        stock: input.stock ?? 0,
        is_active: input.is_active ?? false,
      })
      .select("*")
      .single();

    if (error) {
      console.error("[admin/products POST]", error.message);
      const conflict = error.code === "23505";

      return NextResponse.json(
        {
          error: conflict
            ? "A product with this slug or SKU already exists."
            : "Failed to create product.",
        },
        { status: conflict ? 409 : 500 }
      );
    }

    return NextResponse.json({ product: data }, { status: 201 });
  } catch (error) {
    console.error("[admin/products POST]", error);
    return NextResponse.json(
      { error: "Failed to create product." },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/products?id=<uuid> — update a product.
export async function PATCH(req: NextRequest) {
  try {
    const auth = await authorizedAdmin(req);
    if (auth.response) return auth.response;

    const productId = new URL(req.url).searchParams.get("id");

    if (!productId) {
      return NextResponse.json(
        { error: "Product ID is required." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const parsed = UpdateProductSchema.safeParse(body);

    if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
      return NextResponse.json(
        { error: "Provide valid product fields to update." },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();
    if (parsed.data.storefront_slug !== undefined && parsed.data.storefront_slug !== null) {
      const storefrontProduct = PRODUCTS.find((product) => product.slug === parsed.data.storefront_slug);
      if (!storefrontProduct) {
        return NextResponse.json({ error: "Choose a canonical storefront product." }, { status: 400 });
      }
      const { data: conflicts, error: conflictError } = await supabase
        .from("products")
        .select("id,slug,storefront_slug")
        .neq("id", productId)
        .or(`slug.eq.${parsed.data.storefront_slug},storefront_slug.eq.${parsed.data.storefront_slug}`)
        .limit(1);
      if (conflictError) throw conflictError;
      if (conflicts?.length) {
        return NextResponse.json({ error: "Another database product already claims this storefront slug." }, { status: 409 });
      }
    }
    const { data, error } = await supabase
      .from("products")
      .update(parsed.data)
      .eq("id", productId)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("[admin/products PATCH]", error.message);
      if (error.code === "23505") {
        return NextResponse.json({ error: "Another product already uses this storefront mapping." }, { status: 409 });
      }
      return NextResponse.json(
        { error: "Failed to update product." },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Product not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ product: data });
  } catch (error) {
    console.error("[admin/products PATCH]", error);
    return NextResponse.json(
      { error: "Failed to update product." },
      { status: 500 }
    );
  }
}
