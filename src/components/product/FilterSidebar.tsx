"use client";

import React, { useState } from "react";
import { Filter, X, ChevronDown, Check } from "lucide-react";
import { TShirtFit, TShirtSize } from "@/types";

export interface FilterState {
  collection: string;
  fit: string;
  size: string;
  color: string;
  sleeve: string;
  isGraphic: string; // "all" | "graphic" | "plain"
  sortBy: "featured" | "newest" | "price-asc" | "price-desc";
}

interface FilterSidebarProps {
  filters: FilterState;
  onChange: (newFilters: FilterState) => void;
  onReset: () => void;
  totalCount: number;
}

export function FilterSidebar({
  filters,
  onChange,
  onReset,
  totalCount,
}: FilterSidebarProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const collections = [
    { label: "All Collections", value: "all" },
    { label: "New Drops", value: "new-drops" },
    { label: "Graphic Tees", value: "graphic-tees" },
    { label: "Oversized Tees", value: "oversized-tees" },
    { label: "Essential Tees", value: "essentials" },
    { label: "Statement Prints", value: "statement-prints" },
  ];

  const fits: { label: string; value: string }[] = [
    { label: "All Fits", value: "all" },
    { label: "Oversized Fit", value: "Oversized" },
    { label: "Relaxed Fit", value: "Relaxed" },
    { label: "Regular Fit", value: "Regular" },
  ];

  const sizes: TShirtSize[] = ["XS", "S", "M", "L", "XL", "XXL"];

  const colors = [
    { name: "Black", hex: "#111111" },
    { name: "White", hex: "#FFFFFF" },
    { name: "Cream", hex: "#F5F2EB" },
    { name: "Charcoal", hex: "#2B2D2F" },
    { name: "Navy", hex: "#1E2733" },
    { name: "Olive", hex: "#3D4438" },
  ];

  const hasActiveFilters =
    filters.collection !== "all" ||
    filters.fit !== "all" ||
    filters.size !== "all" ||
    filters.color !== "all" ||
    filters.sleeve !== "all" ||
    filters.isGraphic !== "all";

  const FilterContent = () => (
    <div className="space-y-6">
      {/* Header / Reset */}
      <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
        <span className="text-xs uppercase tracking-widest font-black text-neutral-900">
          Filters
        </span>
        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="text-[11px] uppercase tracking-wider text-neutral-500 hover:text-black underline font-semibold"
          >
            Reset All
          </button>
        )}
      </div>

      {/* Collection */}
      <div className="space-y-2.5">
        <p className="text-xs uppercase tracking-wider font-bold text-neutral-800">Collection</p>
        <div className="space-y-1">
          {collections.map((col) => (
            <label
              key={col.value}
              className="flex items-center gap-2 text-xs text-neutral-600 hover:text-black cursor-pointer py-0.5"
            >
              <input
                type="radio"
                name="filter-collection"
                checked={filters.collection === col.value}
                onChange={() => onChange({ ...filters, collection: col.value })}
                className="w-3.5 h-3.5 accent-black"
              />
              <span>{col.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Fit */}
      <div className="space-y-2.5">
        <p className="text-xs uppercase tracking-wider font-bold text-neutral-800">Fit Silhouette</p>
        <div className="space-y-1">
          {fits.map((f) => (
            <label
              key={f.value}
              className="flex items-center gap-2 text-xs text-neutral-600 hover:text-black cursor-pointer py-0.5"
            >
              <input
                type="radio"
                name="filter-fit"
                checked={filters.fit === f.value}
                onChange={() => onChange({ ...filters, fit: f.value })}
                className="w-3.5 h-3.5 accent-black"
              />
              <span>{f.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Size Buttons */}
      <div className="space-y-2.5">
        <p className="text-xs uppercase tracking-wider font-bold text-neutral-800">Size</p>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => onChange({ ...filters, size: "all" })}
            className={`py-1.5 text-xs font-semibold border ${
              filters.size === "all"
                ? "bg-black text-white border-black"
                : "border-neutral-200 text-neutral-700 hover:border-black"
            }`}
          >
            All Sizes
          </button>
          {sizes.map((s) => (
            <button
              key={s}
              onClick={() => onChange({ ...filters, size: s === filters.size ? "all" : s })}
              className={`py-1.5 text-xs font-semibold border ${
                filters.size === s
                  ? "bg-black text-white border-black"
                  : "border-neutral-200 text-neutral-700 hover:border-black"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Color Palette */}
      <div className="space-y-2.5">
        <p className="text-xs uppercase tracking-wider font-bold text-neutral-800">Color Tone</p>
        <div className="flex flex-wrap gap-2">
          {colors.map((c) => {
            const isSelected = filters.color.toLowerCase() === c.name.toLowerCase();
            return (
              <button
                key={c.name}
                onClick={() =>
                  onChange({
                    ...filters,
                    color: isSelected ? "all" : c.name.toLowerCase(),
                  })
                }
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs border rounded-sm transition-all ${
                  isSelected
                    ? "border-black bg-neutral-100 font-bold"
                    : "border-neutral-200 text-neutral-600 hover:border-neutral-400"
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full border border-black/20"
                  style={{ backgroundColor: c.hex }}
                />
                <span>{c.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Design: Graphic vs Plain */}
      <div className="space-y-2.5">
        <p className="text-xs uppercase tracking-wider font-bold text-neutral-800">Design Type</p>
        <div className="flex gap-2">
          {[
            { label: "All", value: "all" },
            { label: "Graphic", value: "graphic" },
            { label: "Plain / Basics", value: "plain" },
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => onChange({ ...filters, isGraphic: item.value })}
              className={`flex-1 py-1.5 text-xs font-semibold border ${
                filters.isGraphic === item.value
                  ? "bg-black text-white border-black"
                  : "border-neutral-200 text-neutral-700 hover:border-black"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sleeve Type */}
      <div className="space-y-2.5">
        <p className="text-xs uppercase tracking-wider font-bold text-neutral-800">Sleeve Length</p>
        <div className="space-y-1">
          {[
            { label: "All Sleeves", value: "all" },
            { label: "Drop Shoulder", value: "Drop Shoulder" },
            { label: "Half Sleeve", value: "Half Sleeve" },
          ].map((sleeve) => (
            <label
              key={sleeve.value}
              className="flex items-center gap-2 text-xs text-neutral-600 hover:text-black cursor-pointer py-0.5"
            >
              <input
                type="radio"
                name="filter-sleeve"
                checked={filters.sleeve === sleeve.value}
                onChange={() => onChange({ ...filters, sleeve: sleeve.value })}
                className="w-3.5 h-3.5 accent-black"
              />
              <span>{sleeve.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Filter Trigger Bar */}
      <div className="lg:hidden flex items-center justify-between pb-4 border-b border-neutral-200 mb-6">
        <button
          onClick={() => setIsMobileOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-xs uppercase tracking-wider font-bold text-neutral-900"
        >
          <Filter className="w-4 h-4" />
          <span>Filters {hasActiveFilters && "• Active"}</span>
        </button>

        {/* Sort Select */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-neutral-500 uppercase font-semibold">Sort:</span>
          <select
            value={filters.sortBy}
            onChange={(e) =>
              onChange({ ...filters, sortBy: e.target.value as FilterState["sortBy"] })
            }
            className="text-xs font-bold uppercase tracking-wider bg-transparent outline-none cursor-pointer"
          >
            <option value="featured">Featured</option>
            <option value="newest">Newest Drops</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
          </select>
        </div>
      </div>

      {/* Desktop Sidebar (Left Column) */}
      <aside className="hidden lg:block w-64 shrink-0 pr-8">
        <FilterContent />
      </aside>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 w-4/5 max-w-sm bg-white shadow-2xl flex flex-col p-6 animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-200">
              <span className="text-sm font-bold uppercase tracking-wider text-black">
                Filters & Refinements
              </span>
              <button
                onClick={() => setIsMobileOpen(false)}
                className="p-1 text-neutral-500 hover:text-black"
                aria-label="Close filters"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4">
              <FilterContent />
            </div>

            <div className="pt-4 border-t border-neutral-200 flex gap-2">
              <button
                onClick={onReset}
                className="flex-1 py-3 border border-neutral-300 text-xs uppercase tracking-wider font-bold text-neutral-700"
              >
                Reset
              </button>
              <button
                onClick={() => setIsMobileOpen(false)}
                className="flex-1 py-3 bg-black text-white text-xs uppercase tracking-wider font-bold"
              >
                Apply ({totalCount})
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
