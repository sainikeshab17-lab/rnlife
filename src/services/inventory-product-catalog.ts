import { PRODUCTS } from "@/data/mock-data";
import type { Product } from "@/types";

export interface InventoryProductLabel {
  product_name: string;
  sku: string;
  image: string;
}

const PRODUCTS_BY_ID: ReadonlyMap<string, Product> = new Map(
  PRODUCTS.map((product) => [product.id, product])
);

/** Resolve inventory IDs from the same catalog used by the storefront. */
export function getInventoryProductLabel(productId: string): InventoryProductLabel | null {
  const product = PRODUCTS_BY_ID.get(productId);
  if (!product) return null;
  const productName = getCatalogDisplayName(product);
  if (!productName) return null;

  return {
    product_name: productName,
    sku: product.sku,
    image: product.colors.flatMap((color) => color.images).find(Boolean) ?? "",
  };
}

/** Prefer a product name, while accepting title-shaped records at boundaries. */
export function getCatalogDisplayName(record: { name?: unknown; title?: unknown }): string | null {
  for (const candidate of [record.name, record.title]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

export function getInventoryProductIdsMissingFromCatalog(productIds: Iterable<string>): string[] {
  return [...new Set(productIds)].filter((productId) => !getInventoryProductLabel(productId));
}
