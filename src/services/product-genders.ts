import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { ProductGender } from "@/types";

const VALID_GENDERS = new Set<ProductGender>(["Men", "Women", "Unisex"]);

/** Reads the optional gender configuration attached to the Supabase product with this storefront slug. */
export async function getConfiguredProductGenders(slug: string): Promise<ProductGender[]> {
  const db = createAdminSupabaseClient();
  const { data, error } = await db.from("products").select("genders").eq("slug", slug).maybeSingle();
  if (error) throw new Error(`Unable to load gender options for product ${slug}: ${error.message}`);
  const values: unknown = data?.genders;
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((value): value is ProductGender =>
    typeof value === "string" && VALID_GENDERS.has(value as ProductGender)
  ))];
}
