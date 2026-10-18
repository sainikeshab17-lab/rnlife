"use client";

import React, { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Search, ArrowRight } from "lucide-react";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { ProductGrid } from "@/components/product/ProductGrid";
import { FilterSidebar, FilterState } from "@/components/product/FilterSidebar";
import { PRODUCTS } from "@/data/mock-data";

function SearchPageContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";

  const [searchQuery, setSearchQuery] = useState(q);
  const [filters, setFilters] = useState<FilterState>({
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

  const filteredProducts = useMemo(() => {
    let result = [...PRODUCTS];

    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.tagline.toLowerCase().includes(term) ||
          p.tags.some((t) => t.toLowerCase().includes(term)) ||
          p.fit.toLowerCase().includes(term) ||
          p.colors.some((c) => c.name.toLowerCase().includes(term))
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
    }

    return result;
  }, [searchQuery, filters]);

  const handleReset = () => {
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
  };

  return (
    <StoreLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumbs items={[{ label: "Search Results" }]} />

        <div className="pt-4 pb-8 border-b border-neutral-200">
          <span className="text-[11px] uppercase tracking-widest font-mono text-neutral-500 font-bold block mb-1">
            CATALOG SEARCH
          </span>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight font-editorial">
              {searchQuery ? `SEARCH: “${searchQuery}”` : "SEARCH ALL GARMENTS"}
            </h1>
            <span className="text-xs text-neutral-500 font-mono">
              Found {filteredProducts.length} matching {filteredProducts.length === 1 ? "garment" : "garments"}
            </span>
          </div>

          <div className="mt-4 max-w-lg relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Refine search by artwork, fit, GSM, or color..."
              className="w-full pl-10 pr-4 py-2.5 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
            />
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
          </div>
        </div>

        <div className="pt-8 flex flex-col lg:flex-row">
          <FilterSidebar
            filters={filters}
            onChange={setFilters}
            onReset={handleReset}
            totalCount={filteredProducts.length}
          />

          <div className="flex-1">
            <ProductGrid
              products={filteredProducts}
              columns={3}
              emptyMessage={
                searchQuery
                  ? `No T-shirts matched “${searchQuery}”.`
                  : "No garments match the selected filters."
              }
            />
          </div>
        </div>
      </div>
    </StoreLayout>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <SearchPageContent />
    </Suspense>
  );
}
