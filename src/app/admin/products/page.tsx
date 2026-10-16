"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, PlusCircle, ExternalLink, Edit3, ShieldAlert } from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { PRODUCTS } from "@/data/mock-data";
import { formatINR } from "@/lib/utils";
import { StatusBadge } from "@/components/common/StatusBadge";

export default function AdminProductsPage() {
  const [search, setSearch] = useState("");
  const [fitFilter, setFitFilter] = useState("all");

  const filtered = PRODUCTS.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase());
    const matchFit = fitFilter === "all" || p.fit === fitFilter;
    return matchSearch && matchFit;
  });

  return (
    <AdminLayout
      title="Global Product Catalog"
      subtitle="Complete inventory oversight across all 5 streetwear series and seasonal drops."
      actions={
        <Link
          href="/seller/products/new"
          className="px-4 py-2 bg-black hover:bg-neutral-800 text-white text-xs uppercase tracking-widest font-black transition-colors flex items-center gap-1.5"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>New Product Entry</span>
        </Link>
      }
    >
      <div className="bg-white border border-neutral-200 shadow-sm">
        <div className="p-4 sm:p-5 border-b border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name or SKU..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
            />
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold text-neutral-500">Fit Silhouette:</span>
            <select
              value={fitFilter}
              onChange={(e) => setFitFilter(e.target.value)}
              className="px-3 py-2 border border-neutral-300 text-xs font-bold uppercase bg-white outline-none cursor-pointer"
            >
              <option value="all">All Fits</option>
              <option value="Oversized">Oversized</option>
              <option value="Relaxed">Relaxed</option>
              <option value="Regular">Regular</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-700 uppercase font-bold text-[11px]">
                <th className="py-3 px-4">Garment</th>
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4">Series</th>
                <th className="py-3 px-4">Weight</th>
                <th className="py-3 px-4">Retail Price</th>
                <th className="py-3 px-4">Stock</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 font-medium">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-neutral-50">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-12 bg-neutral-100 shrink-0 overflow-hidden">
                        <Image src={p.colors[0].images[0]} alt={p.name} fill className="object-cover object-top" />
                      </div>
                      <div className="max-w-xs truncate">
                        <p className="font-bold text-black uppercase truncate">{p.name}</p>
                        <p className="text-[11px] text-neutral-500">{p.fit} Fit</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-neutral-600">{p.sku}</td>
                  <td className="py-3 px-4 uppercase text-neutral-700">{p.collectionSlug}</td>
                  <td className="py-3 px-4 font-mono">{p.gsm} GSM</td>
                  <td className="py-3 px-4 font-bold text-black">{formatINR(p.price)}</td>
                  <td className="py-3 px-4 font-mono">{p.stock} units</td>
                  <td className="py-3 px-4">
                    <StatusBadge status="published" />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/seller/products/${p.id}/edit`}
                        className="p-1 text-neutral-600 hover:text-black hover:bg-neutral-100 rounded"
                      >
                        <Edit3 className="w-4 h-4" />
                      </Link>
                      <Link
                        href={`/products/${p.slug}`}
                        target="_blank"
                        className="p-1 text-neutral-600 hover:text-black hover:bg-neutral-100 rounded"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
