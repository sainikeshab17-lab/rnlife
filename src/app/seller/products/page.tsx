"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  PlusCircle,
  Search,
  Edit3,
  Archive,
  ExternalLink,
  RefreshCw,
  ShoppingBag,
} from "lucide-react";
import { SellerLayout } from "@/components/layout/SellerLayout";
import { formatINR } from "@/lib/utils";
import { useToast } from "@/context/toast-context";
import { StatusBadge } from "@/components/common/StatusBadge";

interface SellerProduct {
  id: string;
  name: string;
  slug: string;
  sku: string;
  price: number;
  stock: number;
  fit?: string | null;
  gsm?: number | null;
  images?: string[];
  sizes?: string[];
  colors?: string[];
  collection_slug?: string | null;
  is_active: boolean;
  created_at?: string;
}

export default function SellerProductsPage() {
  const [search, setSearch] = useState("");
  const [collectionFilter, setCollectionFilter] = useState("all");
  const [productsList, setProductsList] = useState<SellerProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/seller/products", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load seller products.");
      }
      setProductsList(Array.isArray(data.products) ? data.products : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to load products.";
      setError(msg);
      toast({
        type: "error",
        title: "Load Failed",
        message: msg,
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const filteredProducts = useMemo(() => {
    return productsList.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase());
      const matchCollection =
        collectionFilter === "all" || p.collection_slug === collectionFilter;
      return matchSearch && matchCollection;
    });
  }, [search, collectionFilter, productsList]);

  const handleArchive = async (id: string, name: string) => {
    if (!confirm(`Archive ${name}? This will mark the product as inactive.`)) return;

    try {
      const res = await fetch(`/api/seller/products?id=${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: false }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to archive product.");
      }

      setProductsList((prev) =>
        prev.map((p) => (p.id === id ? { ...p, is_active: false } : p))
      );

      toast({
        type: "info",
        title: "Product Archived",
        message: `${name} has been set to inactive status.`,
      });
    } catch (err: unknown) {
      toast({
        type: "error",
        title: "Archive Failed",
        message: err instanceof Error ? err.message : "Unable to archive product.",
      });
    }
  };

  return (
    <SellerLayout
      title="Product Catalog Management"
      subtitle="Search, modify, preview, and manage your live RightNowLife T-shirt listings."
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadProducts()}
            disabled={isLoading}
            className="px-3 py-2 border border-neutral-300 hover:border-black text-xs uppercase font-bold tracking-wider flex items-center gap-1.5 bg-white transition-colors disabled:opacity-50"
            title="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <Link
            href="/seller/products/new"
            className="px-4 py-2 bg-black hover:bg-neutral-800 text-white text-xs uppercase tracking-widest font-black transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Add New T-Shirt</span>
          </Link>
        </div>
      }
    >
      <div className="bg-white border border-neutral-200 shadow-sm">
        {/* Filters and Search Bar */}
        <div className="p-4 sm:p-5 border-b border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or SKU..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
            />
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs uppercase font-bold text-neutral-500">Series:</span>
            <select
              value={collectionFilter}
              onChange={(e) => setCollectionFilter(e.target.value)}
              className="px-3 py-2 border border-neutral-300 text-xs font-bold uppercase bg-white outline-none cursor-pointer"
            >
              <option value="all">All Series</option>
              <option value="new-drops">New Drops</option>
              <option value="graphic-tees">Graphic Tees</option>
              <option value="essentials">Essentials</option>
              <option value="statement-prints">Statement Prints</option>
            </select>
          </div>
        </div>

        {/* Product Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-700 uppercase font-bold text-[11px]">
                <th className="py-3 px-4">Garment</th>
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4">Fit / GSM</th>
                <th className="py-3 px-4">Price</th>
                <th className="py-3 px-4">Variants</th>
                <th className="py-3 px-4">Stock</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-neutral-400" />
                    <p>Loading real seller products from database...</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-red-600">
                    {error}
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-neutral-500">
                    <ShoppingBag className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                    <p className="font-bold text-neutral-800 uppercase">No products found</p>
                    <p className="text-xs text-neutral-400 mt-1 mb-4">
                      {search ? "No products match your search query." : "No seller products have been created yet."}
                    </p>
                    <Link
                      href="/seller/products/new"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-black text-white text-xs font-bold uppercase tracking-wider"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Create First Product</span>
                    </Link>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const imageSrc =
                    p.images && p.images.length > 0
                      ? p.images[0]
                      : "/rightnowlife-logo.png";

                  return (
                    <tr key={p.id} className="hover:bg-neutral-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative w-12 h-14 bg-neutral-100 shrink-0 overflow-hidden border border-neutral-200">
                            <Image
                              src={imageSrc}
                              alt={p.name}
                              fill
                              unoptimized
                              className="object-cover object-top"
                            />
                          </div>
                          <div className="min-w-0 max-w-xs">
                            <p className="font-bold text-black uppercase truncate">{p.name}</p>
                            <p className="text-[11px] text-neutral-500 truncate font-mono">
                              {p.collection_slug || "standard"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-neutral-600">{p.sku}</td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-black">{p.fit || "Regular"}</span>
                        <span className="text-neutral-500 block text-[11px]">{p.gsm || 260} GSM</span>
                      </td>
                      <td className="py-3 px-4 font-bold text-black font-mono">
                        {formatINR(999)}
                      </td>
                      <td className="py-3 px-4 text-neutral-600">
                        <span>
                          {(p.colors?.length ?? 1)} Col • {(p.sizes?.length ?? 6)} Sizes
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <span className={p.stock < 25 ? "text-amber-600 font-bold" : "text-black"}>
                          {p.stock} units
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={p.is_active ? "published" : "draft"} />
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/products/${p.slug}`}
                            target="_blank"
                            className="p-1 text-neutral-600 hover:text-black hover:bg-neutral-100 rounded"
                            title="Preview in Store"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                          {p.is_active && (
                            <button
                              onClick={() => handleArchive(p.id, p.name)}
                              className="p-1 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded"
                              title="Archive to draft"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-neutral-200 text-xs text-neutral-500 flex items-center justify-between">
          <span>Showing {filteredProducts.length} live database records</span>
          <span className="font-mono text-[11px] font-bold text-black">
            Authoritative Price: ₹999 / piece
          </span>
        </div>
      </div>
    </SellerLayout>
  );
}
