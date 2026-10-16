"use client";

import React, { useState, useMemo } from "react";
import { Collection, Product } from "@/types";
import { ProductGrid } from "@/components/product/ProductGrid";
import { FilterSidebar, FilterState } from "@/components/product/FilterSidebar";

interface CollectionClientViewProps {
  collection: Collection;
  initialProducts: Product[];
}

export function CollectionClientView({
  collection,
  initialProducts,
}: CollectionClientViewProps) {
  const [filters, setFilters] = useState<FilterState>({
    collection: collection.slug,
    fit: "all",
    size: "all",
    color: "all",
    price: "all",
    sleeve: "all",
    isGraphic: "all",
    sortBy: "featured",
  });

  const filteredProducts = useMemo(() => {
    let result = [...initialProducts];

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
  }, [filters, initialProducts]);

  const handleReset = () => {
    setFilters({
      collection: collection.slug,
      fit: "all",
      size: "all",
      color: "all",
      price: "all",
      sleeve: "all",
      isGraphic: "all",
      sortBy: "featured",
    });
  };

  return (
    <div className="pt-6 flex flex-col lg:flex-row">
      <FilterSidebar
        filters={filters}
        onChange={setFilters}
        onReset={handleReset}
        totalCount={filteredProducts.length}
      />

      <div className="flex-1">
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-neutral-100">
          <p className="text-xs uppercase tracking-wider text-neutral-500 font-semibold">
            {filteredProducts.length} {filteredProducts.length === 1 ? "Garment" : "Garments"} in{" "}
            <span className="text-black font-bold">{collection.name}</span>
          </p>
        </div>

        <ProductGrid products={filteredProducts} columns={3} />
      </div>
    </div>
  );
}
