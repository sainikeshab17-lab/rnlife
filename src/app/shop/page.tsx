"use client";

import React, { useState, useMemo, useEffect, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { ProductGrid } from "@/components/product/ProductGrid";
import { FilterSidebar, FilterState } from "@/components/product/FilterSidebar";
import { PRODUCT_CATEGORIES, PRODUCTS } from "@/data/mock-data";
import { normalizeProductCategory } from "@/data/product-categories";

const DEFAULT_PRODUCT_ORDER: Record<string, number> = {
  "go-crazy-about-me": 0,
  "friday-mode": 1,
  "bitch-i-am-the-secret-ingredient": 2,
  "monday-tired-messy-no-motivation": 3,
  "phirse-bolo": 4,
  "prayers-become-reality": 5,
  "i-love-sarcasm": 6,
  "hot-girls-do-yoga": 7,
};

function ShopContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const initialCollection = searchParams.get("collection") || "all";
  const categoryParam = searchParams.get("category");
  const initialCategory: FilterState["category"] =
    normalizeProductCategory(categoryParam) ?? "all";

  const [filterState, setFilterState] = useState<FilterState>({
    collection: initialCollection,
    category: "all",
    fit: "all",
    size: "all",
    color: "all",
    price: "all",
    sleeve: "all",
    isGraphic: "all",
    sortBy: "featured",
  });

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const filters = { ...filterState, category: initialCategory };
  useEffect(() => {
    if (categoryParam === null || categoryParam === initialCategory) return;

    const params = new URLSearchParams(searchParams.toString());
    if (initialCategory === "all") {
      params.delete("category");
    } else {
      params.set("category", initialCategory);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [categoryParam, initialCategory, pathname, router, searchParams]);

  const updateSearchParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  // Filter & Sort Logic
  const filteredProducts = useMemo(() => {
    const filters = { ...filterState, category: initialCategory };
    let result = [...PRODUCTS];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.tagline.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (filters.collection !== "all") {
      result = result.filter((p) => p.collectionSlug === filters.collection);
    }

    if (filters.category !== "all") {
      result = result.filter((p) => p.category === filters.category);
    }

    if (filters.fit !== "all") {
      result = result.filter((p) => p.fit === filters.fit);
    }

    const selectedSize = filters.size;
    if (selectedSize !== "all") {
      result = result.filter((p) => p.sizes.includes(selectedSize));
    }

    if (filters.color !== "all") {
      result = result.filter((p) =>
        p.colors.some((c) => c.name.toLowerCase().includes(filters.color.toLowerCase()))
      );
    }

    if (filters.price === "under-1000") result = result.filter((p) => p.price < 1000);
    if (filters.price === "1000-1500") result = result.filter((p) => p.price >= 1000 && p.price <= 1500);
    if (filters.price === "over-1500") result = result.filter((p) => p.price > 1500);

    if (filters.sleeve !== "all") {
      result = result.filter((p) => p.sleeve === filters.sleeve);
    }

    if (filters.isGraphic !== "all") {
      const isG = filters.isGraphic === "graphic";
      result = result.filter((p) => p.isGraphic === isG);
    }

    // Sort
    if (filters.sortBy === "newest") {
      result.sort((a, b) => (b.isNewDrop ? 1 : 0) - (a.isNewDrop ? 1 : 0));
    } else if (filters.sortBy === "price-asc") {
      result.sort((a, b) => a.price - b.price);
    } else if (filters.sortBy === "price-desc") {
      result.sort((a, b) => b.price - a.price);
    } else if (filters.sortBy === "featured") {
      result.sort(
        (a, b) =>
          DEFAULT_PRODUCT_ORDER[a.slug] - DEFAULT_PRODUCT_ORDER[b.slug]
      );
    }

    return result;
  }, [filterState, initialCategory, searchQuery]);

  const totalProducts = filteredProducts.length;
  const paginatedProducts = filteredProducts.slice(0, currentPage * itemsPerPage);
  const hasMore = paginatedProducts.length < totalProducts;

  const handleResetFilters = () => {
    setFilterState({
      collection: "all",
      category: "all",
      fit: "all",
      size: "all",
      color: "all",
      price: "all",
      sleeve: "all",
      isGraphic: "all",
      sortBy: "featured",
    });
    setSearchQuery("");
    setCurrentPage(1);
    updateSearchParams({ q: null, collection: null, category: null });
  };

  return (
    <StoreLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumbs items={[{ label: "Shop All Tees" }]} />

        {/* Page Header */}
        <div className="pt-4 pb-8 border-b border-[#E5E5E5]">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase tracking-widest font-mono text-[#858585] font-bold block mb-1">
                Complete Catalog
              </span>
              <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight font-editorial">
                Shop All Tees
              </h1>
              <p className="text-xs text-[#858585] max-w-lg mt-2 leading-relaxed">
                Heavyweight raglan graphic T-shirts — milled from 100% combed cotton jersey. 8 designs. ₹999 each.
              </p>
            </div>

            <div className="text-xs text-[#858585] font-mono self-start md:self-end">
              Showing <span className="font-bold text-[#111111]">{paginatedProducts.length}</span> of{" "}
              <span className="font-bold text-[#111111]">{totalProducts}</span> garments
            </div>
          </div>
        </div>

        {/* Catalog Main Stage */}
        <div className="pt-8 flex flex-col lg:flex-row">
          <FilterSidebar
            filters={filters}
            onChange={(newF) => {
              setFilterState(newF);
              setCurrentPage(1);
              if (newF.category !== filters.category) {
                updateSearchParams({
                  category: newF.category === "all" ? null : newF.category,
                });
              }
            }}
            onReset={handleResetFilters}
            totalCount={totalProducts}
          />

          <div className="flex-1">
            {/* Active search chip */}
            {(searchQuery || filters.category !== "all") && (
              <div className="mb-6 flex flex-wrap items-center gap-2 p-3 bg-[#F5F4F0] border border-[#E5E5E5] text-xs">
                {searchQuery && (
                  <span>
                    Filtering results for: <strong>&ldquo;{searchQuery}&rdquo;</strong>
                  </span>
                )}
                {filters.category !== "all" && (
                  <span>
                    Category: <strong>{PRODUCT_CATEGORIES.find((category) => category.slug === filters.category)?.name || filters.category}</strong>
                  </span>
                )}
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setFilterState((prev) => ({ ...prev, category: "all" }));
                    setCurrentPage(1);
                    updateSearchParams({ q: null, category: null });
                  }}
                  className="text-[#858585] hover:text-[#111111] underline font-bold ml-auto transition-colors"
                >
                  Clear filters
                </button>
              </div>
            )}

            <ProductGrid products={paginatedProducts} columns={3} />

            {/* Load More */}
            {hasMore && (
              <div className="mt-12 text-center">
                <button
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="btn-morph btn-yellow px-8 py-3.5 text-xs uppercase tracking-widest font-black"
                >
                  Load More ({totalProducts - paginatedProducts.length} remaining)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </StoreLayout>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <ShopContent />
    </Suspense>
  );
}
