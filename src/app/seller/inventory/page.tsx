"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Plus, Minus, Search, AlertTriangle, Check, Save } from "lucide-react";
import { SellerLayout } from "@/components/layout/SellerLayout";
import { PRODUCTS } from "@/data/mock-data";
import { useToast } from "@/context/toast-context";
import { formatINR } from "@/lib/utils";

export default function SellerInventoryPage() {
  const { toast } = useToast();
  const [stockMap, setStockMap] = useState<Record<string, number>>(
    Object.fromEntries(PRODUCTS.map((p) => [p.id, p.stock]))
  );
  const [search, setSearch] = useState("");
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  const handleStockChange = (id: string, delta: number) => {
    setStockMap((prev) => ({
      ...prev,
      [id]: Math.max(0, (prev[id] || 0) + delta),
    }));
  };

  const handleSaveStock = (productName: string) => {
    toast({
      type: "success",
      title: "Stock Adjusted",
      message: `Updated inventory count for ${productName}.`,
    });
  };

  const filtered = PRODUCTS.filter((p) => {
    const currentStock = stockMap[p.id] ?? p.stock;
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase());
    const matchLow = onlyLowStock ? currentStock < 25 : true;
    return matchSearch && matchLow;
  });

  return (
    <SellerLayout
      title="Warehouse Inventory Matrix"
      subtitle="Real-time garment variant stock counts, restock thresholds, and quick count adjustments."
    >
      <div className="bg-white border border-neutral-200 shadow-sm space-y-4">
        {/* Filter bar */}
        <div className="p-4 sm:p-5 border-b border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by T-shirt or SKU..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
            />
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
          </div>

          <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-700 cursor-pointer self-start sm:self-auto">
            <input
              type="checkbox"
              checked={onlyLowStock}
              onChange={(e) => setOnlyLowStock(e.target.checked)}
              className="w-4 h-4 accent-black"
            />
            <span className="flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Show Low Stock Only (&lt; 25)
            </span>
          </label>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-700 uppercase font-bold text-[11px]">
                <th className="py-3 px-4">Garment</th>
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4">Fit</th>
                <th className="py-3 px-4">Price</th>
                <th className="py-3 px-4">Current Stock</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Quick Adjust</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 font-medium">
              {filtered.map((p) => {
                const stock = stockMap[p.id] ?? p.stock;
                const isLow = stock < 25;
                return (
                  <tr key={p.id} className="hover:bg-neutral-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-12 bg-neutral-100 shrink-0 overflow-hidden">
                          <Image src={p.colors[0].images[0]} alt={p.name} fill className="object-cover object-top" />
                        </div>
                        <div className="truncate max-w-xs">
                          <p className="font-bold text-black uppercase truncate">{p.name}</p>
                          <p className="text-[11px] text-neutral-500 font-mono">
                            {p.colors.length} Col • {p.sizes.join(", ")}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-neutral-600">{p.sku}</td>
                    <td className="py-3 px-4 text-neutral-800">{p.fit}</td>
                    <td className="py-3 px-4 font-bold text-black">{formatINR(p.price)}</td>
                    <td className="py-3 px-4 font-mono text-sm font-bold">{stock} units</td>
                    <td className="py-3 px-4">
                      {isLow ? (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 text-[10px] uppercase font-bold">
                          Low Stock
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] uppercase font-bold">
                          Healthy
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleStockChange(p.id, -5)}
                          className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold"
                          title="Subtract 5 units"
                        >
                          -5
                        </button>
                        <button
                          onClick={() => handleStockChange(p.id, 5)}
                          className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold"
                          title="Add 5 units"
                        >
                          +5
                        </button>
                        <button
                          onClick={() => handleStockChange(p.id, 20)}
                          className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold"
                          title="Add 20 units"
                        >
                          +20
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleSaveStock(p.name)}
                        className="px-3 py-1.5 bg-black hover:bg-neutral-800 text-white text-[11px] uppercase font-bold tracking-wider"
                      >
                        Save
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </SellerLayout>
  );
}
