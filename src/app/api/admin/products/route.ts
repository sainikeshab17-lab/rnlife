
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth/admin-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ProductSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(220),
  description: z.string().max(10000).nullable().optional(),
  category: z.string().trim().min(1).max(100),
  sku: z.string().trim().min(1).max(100).nullable().optional(),
  price: z.coerce.number().finite().min(0),
  compare_at_price: z.coerce.number().finite().min(0).nullable().optional(),
  images: z.array(z.string().url()).max(20).optional(),
  sizes: z.array(z.string().trim().min(1).max(20)).max(30).optional(),
  genders: z.array(z.enum(["Men", "Women", "Unisex"])).max(3).optional(),
  colors: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
  stock: z.coerce.number().int().min(0).max(100000).optional(),
  is_active: z.boolean().optional(),
});

const UpdateProductSchema = ProductSchema.partial().extend({
  description: z.string().max(10000).nullable().optional(),
  compare_at_price: z.coerce.number().finite().min(0).nullable().optional(),
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

    return NextResponse.json({ products: data ?? [] });
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

    const { data, error } = await supabase
      .from("products")
      .insert({
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        category: input.category,
        sku: input.sku ?? null,
        price: input.price,
        compare_at_price: input.compare_at_price ?? null,
        images: input.images ?? [],
        sizes: input.sizes ?? [],
        colors: input.colors ?? [],
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
    const { data, error } = await supabase
      .from("products")
      .update(parsed.data)
      .eq("id", productId)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("[admin/products PATCH]", error.message);
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
