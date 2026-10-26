import "server-only";
import type { z } from "zod";
import { PRODUCTS } from "@/data/mock-data";
import { CheckoutItemSchema, calculateTrustedOrderPricing } from "@/services/checkout-service";
import { getConfiguredProductGenders } from "@/services/product-genders";

export async function calculateConfiguredOrderPricing(
  items: z.infer<typeof CheckoutItemSchema>[],
  promoCode?: string,
) {
  const productIds = [...new Set(items.map((item) => item.productId).filter((id) => id !== "rnl-custom-quote-tee"))];
  const options = await Promise.all(productIds.map(async (id) => {
    const product = PRODUCTS.find((candidate) => candidate.id === id);
    return product ? [id, await getConfiguredProductGenders(product.slug)] as const : null;
  }));
  return calculateTrustedOrderPricing(items, promoCode, Object.fromEntries(options.filter((entry) => entry !== null)));
}
