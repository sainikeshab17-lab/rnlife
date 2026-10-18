"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  PlusCircle,
  Search,
  Filter,
  Edit3,
  Archive,
  ExternalLink,
  Check,
  AlertCircle,
} from "lucide-react";
import { SellerLayout } from "@/components/layout/SellerLayout";
import { PRODUCTS } from "@/data/mock-data";
import { formatINR } from "@/lib/utils";
import { useToast } from "@/context/toast-context";
import { StatusBadge } from "@/components/common/StatusBadge";

export default function SellerProductsPage() {
  const [search, setSearch] = useState("");
  const [collectionFilter, setCollectionFilter] = useState("all");
  const [productsList, setProductsList] = useState(PRODUCTS);
  const { toast } = useToast();

  const filteredProducts = useMemo(() => {
    return productsList.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase());
      const matchCollection =
        collectionFilter === "all" || p.collectionSlug === collectionFilter;
      return matchSearch && matchCollection;
    });
  }, [search, collectionFilter, productsList]);

  const handleArchive = (id: string, name: string) => {
    if (confirm(`Archive ${name}? This will change the product status to Draft.`)) {
      setProductsList((prev) => prev.filter((p) => p.id !== id));
      toast({
        type: "info",
        title: "Product Archived",
        message: `${name} has been archived to drafts.`,
      });
    }
  };

  return (
    <SellerLayout
      title="Product Catalog Management"
      subtitle="Search, modify, preview, and archive RightNowLife T-shirt listings."
      actions={
        <Link
          href="/seller/products/new"
          className="px-4 py-2 bg-black hover:bg-neutral-800 text-white text-xs uppercase tracking-widest font-black transition-colors flex items-center gap-1.5"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Add New T-Shirt</span>
        </Link>
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
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-500">
                    No products match your query.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="relative w-12 h-14 bg-neutral-100 shrink-0 overflow-hidden">
                          <Image src={p.colors[0].images[0]} alt={p.name} fill className="object-cover object-top" />
                        </div>
                        <div className="min-w-0 max-w-xs">
                          <p className="font-bold text-black uppercase truncate">{p.name}</p>
                          <p className="text-[11px] text-neutral-500 truncate">{p.collectionSlug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-neutral-600">{p.sku}</td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-black">{p.fit}</span>
                      <span className="text-neutral-500 block text-[11px]">{p.gsm} GSM</span>
                    </td>
                    <td className="py-3 px-4 font-bold text-black">{formatINR(p.price)}</td>
                    <td className="py-3 px-4 text-neutral-600">
                      <span>{p.colors.length} Col • {p.sizes.length} Sizes</span>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <span className={p.stock < 25 ? "text-amber-600 font-bold" : "text-black"}>
                        {p.stock} units
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status="published" />
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/seller/products/${p.id}/edit`}
                          className="p-1 text-neutral-600 hover:text-black hover:bg-neutral-100 rounded"
                          title="Edit Garment"
                        >
                          <Edit3 className="w-4 h-4" />
                        </Link>
                        <Link
                          href={`/products/${p.slug}`}
                          target="_blank"
                          className="p-1 text-neutral-600 hover:text-black hover:bg-neutral-100 rounded"
                          title="Preview in Store"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleArchive(p.id, p.name)}
                          className="p-1 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Archive"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-neutral-200 text-xs text-neutral-500 flex items-center justify-between">
          <span>Showing {filteredProducts.length} of {PRODUCTS.length} catalog garments</span>
          <span className="font-mono text-[11px]">[Phase 1 Prototype Catalog Fixture]</span>
        </div>
      </div>
    </SellerLayout>
  );
}
