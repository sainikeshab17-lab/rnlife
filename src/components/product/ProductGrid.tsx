"use client";

import React from "react";
import { Product } from "@/types";
import { ProductCard } from "./ProductCard";

interface ProductGridProps {
  products: Product[];
  emptyMessage?: string;
  columns?: 2 | 3 | 4;
}

export function ProductGrid({
  products,
  emptyMessage = "No T-shirts match your selection.",
  columns = 4,
}: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="py-16 text-center text-neutral-500 border border-dashed border-neutral-200 p-8">
        <p className="text-sm font-semibold uppercase tracking-wider">{emptyMessage}</p>
        <p className="text-xs text-neutral-400 mt-1">Try resetting your active filters to explore more styles.</p>
      </div>
    );
  }

  const colClasses = {
    2: "grid-cols-2",
    3: "grid-cols-2 md:grid-cols-3",
    4: "grid-cols-2 xl:grid-cols-4",
  }[columns];

  return (
    <div className={`grid ${colClasses} gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10`}>
      {products.map((product, idx) => (
        <ProductCard key={product.id} product={product} priority={idx < 4} />
      ))}
    </div>
  );
}
