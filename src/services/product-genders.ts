import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { ProductGender } from "@/types";

const VALID_GENDERS = new Set<ProductGender>(["Men", "Women", "Unisex"]);

export interface ProductGenderConfiguration {
  productFound: boolean;
  genders: ProductGender[];
}

/** Reads the optional gender configuration attached to the Supabase product with this storefront slug. */
export async function getProductGenderConfiguration(slug: string): Promise<ProductGenderConfiguration> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`Invalid storefront product slug: ${slug}`);
  const db = createAdminSupabaseClient();
  const { data, error } = await db
    .from("products")
    .select("slug,storefront_slug,genders")
    .or(`slug.eq.${slug},storefront_slug.eq.${slug}`)
    .limit(2);
  if (error) throw new Error(`Unable to load gender options for product ${slug}: ${error.message}`);
  if (!data?.length) return { productFound: false, genders: [] };
  if (data.length !== 1) throw new Error(`Ambiguous database mapping for storefront product ${slug}.`);
  if (!Array.isArray(data[0].genders) || data[0].genders.some((value: unknown) => typeof value !== "string" || !VALID_GENDERS.has(value as ProductGender))) {
    throw new Error(`Invalid gender configuration for product ${slug}.`);
  }
  return { productFound: true, genders: [...new Set(data[0].genders as ProductGender[])] };
}

export async function getConfiguredProductGenders(slug: string): Promise<ProductGender[]> {
  return (await getProductGenderConfiguration(slug)).genders;
}
