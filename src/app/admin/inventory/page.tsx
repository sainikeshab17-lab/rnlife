"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Boxes, Search, AlertTriangle, TrendingUp, Check } from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { PRODUCTS } from "@/data/mock-data";
import { formatINR } from "@/lib/utils";

export default function AdminInventoryPage() {
  const [search, setSearch] = useState("");

  const totalStock = PRODUCTS.reduce((sum, p) => sum + p.stock, 0);
  const totalValuation = PRODUCTS.reduce((sum, p) => sum + p.stock * p.price, 0);
  const lowStockProducts = PRODUCTS.filter((p) => p.stock < 25);

  const filtered = PRODUCTS.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout
      title="Global Warehouse Inventory"
      subtitle="Complete garment inventory metrics, valuation in INR, and variant distribution."
    >
      <div className="space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-neutral-200 p-5 shadow-sm space-y-1">
            <span className="text-xs uppercase font-bold tracking-wider text-neutral-500">
              Total Garments in Stock
            </span>
            <p className="text-2xl font-black text-black font-mono">{totalStock} units</p>
            <p className="text-[11px] text-neutral-500">Bengaluru Central Hub</p>
          </div>

          <div className="bg-white border border-neutral-200 p-5 shadow-sm space-y-1">
            <span className="text-xs uppercase font-bold tracking-wider text-neutral-500">
              Stock Valuation (Retail)
            </span>
            <p className="text-2xl font-black text-black font-mono">
              {formatINR(totalValuation)}
            </p>
            <p className="text-[11px] text-emerald-600 font-semibold">Active catalog value</p>
          </div>

          <div className="bg-white border border-neutral-200 p-5 shadow-sm space-y-1">
            <span className="text-xs uppercase font-bold tracking-wider text-neutral-500">
              Low Stock Alerts
            </span>
            <p className="text-2xl font-black text-amber-600 font-mono">
              {lowStockProducts.length} variants
            </p>
            <p className="text-[11px] text-neutral-500">Requires yarn replenishment</p>
          </div>
        </div>

        {/* Global Inventory Table */}
        <div className="bg-white border border-neutral-200 shadow-sm">
          <div className="p-4 sm:p-5 border-b border-neutral-200 flex items-center justify-between">
            <div className="relative w-72">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search inventory..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
              />
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-700 uppercase font-bold text-[11px]">
                  <th className="py-3 px-4">Garment</th>
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4">Series</th>
                  <th className="py-3 px-4">Fit / GSM</th>
                  <th className="py-3 px-4">Stock</th>
                  <th className="py-3 px-4">Valuation</th>
                  <th className="py-3 px-4">Health</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 font-medium">
                {filtered.map((p) => {
                  const isLow = p.stock < 25;
                  return (
                    <tr key={p.id} className="hover:bg-neutral-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative w-10 h-12 bg-neutral-100 shrink-0 overflow-hidden">
                            <Image src={p.colors[0].images[0]} alt={p.name} fill className="object-cover object-top" />
                          </div>
                          <span className="font-bold text-black uppercase truncate max-w-xs">{p.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-neutral-600">{p.sku}</td>
                      <td className="py-3 px-4 uppercase text-neutral-600">{p.collectionSlug}</td>
                      <td className="py-3 px-4">
                        {p.fit} • {p.gsm} GSM
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-black">{p.stock} units</td>
                      <td className="py-3 px-4 font-mono">{formatINR(p.stock * p.price)}</td>
                      <td className="py-3 px-4">
                        {isLow ? (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 text-[10px] uppercase font-bold">
                            Low Stock
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] uppercase font-bold">
                            Optimal
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
