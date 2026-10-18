"use client";

import React, { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { ProductGrid } from "@/components/product/ProductGrid";
import { FilterSidebar, FilterState } from "@/components/product/FilterSidebar";
import { PRODUCTS } from "@/data/mock-data";
import { Product } from "@/types";

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
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const initialCollection = searchParams.get("collection") || "all";
  const initialCategory = searchParams.get("category") || "all";

  const [filters, setFilters] = useState<FilterState>({
    collection: initialCollection,
    category: initialCategory,
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
  const categoryLabels = [
    { name: "Hot Girl Stuff", slug: "hot-girl-stuff" },
    { name: "Monday to Friday", slug: "monday-to-friday" },
    { name: "Social Battery", slug: "social-battery" },
    { name: "Relationship Status", slug: "relationship-status" },
    { name: "Brutally Honest", slug: "brutally-honest" },
    { name: "Everyday Chaos", slug: "everyday-chaos" },
    { name: "Friday Mode", slug: "friday-mode" },
  ];

  // Filter & Sort Logic
  const filteredProducts = useMemo(() => {
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
      const normalized = filters.category.toLowerCase();
      result = result.filter((p) => p.category.toLowerCase().replace(/[^a-z]+/g, "-") === normalized);
    }

    if (filters.fit !== "all") {
      result = result.filter((p) => p.fit === filters.fit);
    }

    if (filters.size !== "all") {
      result = result.filter((p) => p.sizes.includes(filters.size as any));
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
  }, [filters, searchQuery]);

  const totalProducts = filteredProducts.length;
  const paginatedProducts = filteredProducts.slice(0, currentPage * itemsPerPage);
  const hasMore = paginatedProducts.length < totalProducts;

  const handleResetFilters = () => {
    setFilters({
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
                Heavyweight graphic, oversized, and essential T-shirts — milled from 100% combed cotton jersey.
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
              setFilters(newF);
              setCurrentPage(1);
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
                    Category: <strong>{categoryLabels.find((c) => c.slug === filters.category)?.name || filters.category}</strong>
                  </span>
                )}
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setFilters((prev) => ({ ...prev, category: "all" }));
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
