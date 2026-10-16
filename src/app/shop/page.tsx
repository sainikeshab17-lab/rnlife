"use client";

import React, { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { ProductGrid } from "@/components/product/ProductGrid";
import { FilterSidebar, FilterState } from "@/components/product/FilterSidebar";
import { PRODUCTS } from "@/data/mock-data";
import { Product } from "@/types";

function ShopContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const initialCollection = searchParams.get("collection") || "all";

  const [filters, setFilters] = useState<FilterState>({
    collection: initialCollection,
    fit: "all",
    size: "all",
    color: "all",
    sleeve: "all",
    isGraphic: "all",
    sortBy: "featured",
  });

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

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
  }, [filters, searchQuery]);

  const totalProducts = filteredProducts.length;
  const paginatedProducts = filteredProducts.slice(0, currentPage * itemsPerPage);
  const hasMore = paginatedProducts.length < totalProducts;

  const handleResetFilters = () => {
    setFilters({
      collection: "all",
      fit: "all",
      size: "all",
      color: "all",
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
            {searchQuery && (
              <div className="mb-6 flex items-center gap-2 p-3 bg-[#F5F4F0] border border-[#E5E5E5] text-xs">
                <span>
                  Filtering results for: <strong>&ldquo;{searchQuery}&rdquo;</strong>
                </span>
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-[#858585] hover:text-[#111111] underline font-bold ml-auto transition-colors"
                >
                  Clear Search
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
