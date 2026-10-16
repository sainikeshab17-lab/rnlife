import { PRODUCTS, COLLECTIONS, SIZE_CHART_OVERSIZED, SIZE_CHART_RELAXED, SIZE_CHART_REGULAR } from "@/data/mock-data";
import { Product, Collection, TShirtFit, SizeMeasurement } from "@/types";

export interface ProductFilterOptions {
  collection?: string;
  fit?: TShirtFit;
  size?: string;
  color?: string;
  minPrice?: number;
  maxPrice?: number;
  isGraphic?: boolean;
  sleeve?: string;
  query?: string;
  sortBy?: "featured" | "newest" | "price-asc" | "price-desc";
}

export const productService = {
  getAllProducts: async (filters?: ProductFilterOptions): Promise<Product[]> => {
    // Simulating API latency / async service abstraction for future NestJS integration
    let results = [...PRODUCTS];

    if (!filters) return results;

    if (filters.collection && filters.collection !== "all") {
      results = results.filter((p) => p.collectionSlug === filters.collection);
    }

    if (filters.fit) {
      results = results.filter((p) => p.fit === filters.fit);
    }

    if (filters.size) {
      results = results.filter((p) => p.sizes.includes(filters.size as any));
    }

    if (filters.color) {
      results = results.filter((p) =>
        p.colors.some((c) => c.name.toLowerCase().includes(filters.color!.toLowerCase()))
      );
    }

    if (filters.minPrice !== undefined) {
      results = results.filter((p) => p.price >= filters.minPrice!);
    }

    if (filters.maxPrice !== undefined) {
      results = results.filter((p) => p.price <= filters.maxPrice!);
    }

    if (filters.isGraphic !== undefined) {
      results = results.filter((p) => p.isGraphic === filters.isGraphic);
    }

    if (filters.sleeve) {
      results = results.filter((p) => p.sleeve === filters.sleeve);
    }

    if (filters.query) {
      const q = filters.query.toLowerCase();
      results = results.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.tagline.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Sorting
    if (filters.sortBy === "newest") {
      results.sort((a, b) => (b.isNewDrop ? 1 : 0) - (a.isNewDrop ? 1 : 0));
    } else if (filters.sortBy === "price-asc") {
      results.sort((a, b) => a.price - b.price);
    } else if (filters.sortBy === "price-desc") {
      results.sort((a, b) => b.price - a.price);
    }

    return results;
  },

  getProductBySlug: async (slug: string): Promise<Product | undefined> => {
    return PRODUCTS.find((p) => p.slug === slug);
  },

  getProductById: async (id: string): Promise<Product | undefined> => {
    return PRODUCTS.find((p) => p.id === id);
  },

  getCollections: async (): Promise<Collection[]> => {
    return COLLECTIONS;
  },

  getCollectionBySlug: async (slug: string): Promise<Collection | undefined> => {
    return COLLECTIONS.find((c) => c.slug === slug);
  },

  getRelatedProducts: async (currentProductId: string, limit = 4): Promise<Product[]> => {
    const current = PRODUCTS.find((p) => p.id === currentProductId);
    if (!current) return PRODUCTS.slice(0, limit);

    return PRODUCTS.filter(
      (p) => p.id !== currentProductId && (p.collectionSlug === current.collectionSlug || p.fit === current.fit)
    ).slice(0, limit);
  },

  getSizeChart: (fit: TShirtFit): SizeMeasurement[] => {
    if (fit === "Oversized") return SIZE_CHART_OVERSIZED;
    if (fit === "Relaxed") return SIZE_CHART_RELAXED;
    return SIZE_CHART_REGULAR;
  },
};
