"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Plus, Minus, Search, AlertTriangle, Check, Save, RefreshCw, ShoppingBag } from "lucide-react";
import { SellerLayout } from "@/components/layout/SellerLayout";
import { useToast } from "@/context/toast-context";
import { formatINR } from "@/lib/utils";

interface SellerProduct {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  images?: string[];
  is_active: boolean;
}

export default function SellerInventoryPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/seller/products", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && Array.isArray(data.products)) {
        setProducts(data.products);
        const map: Record<string, number> = {};
        for (const p of data.products) {
          map[p.id] = p.stock ?? 0;
        }
        setStockMap(map);
      }
    } catch {
      toast({
        type: "error",
        title: "Load Failed",
        message: "Unable to load inventory data.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const handleStockChange = (id: string, delta: number) => {
    setStockMap((prev) => ({
      ...prev,
      [id]: Math.max(0, (prev[id] ?? 0) + delta),
    }));
  };

  const handleSaveStock = async (product: SellerProduct) => {
    const newStock = stockMap[product.id] ?? product.stock;
    setSavingId(product.id);

    try {
      const res = await fetch(`/api/seller/products?id=${encodeURIComponent(product.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock: newStock }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save stock adjustment.");
      }

      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, stock: newStock } : p))
      );

      toast({
        type: "success",
        title: "Stock Updated",
        message: `Inventory for ${product.name} updated to ${newStock} units.`,
      });
    } catch (err: unknown) {
      toast({
        type: "error",
        title: "Update Failed",
        message: err instanceof Error ? err.message : "Failed to update stock.",
      });
    } finally {
      setSavingId(null);
    }
  };

  const filtered = products.filter((p) => {
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
      subtitle="Real-time garment stock counts and quick count adjustments persisted to database."
      actions={
        <button
          onClick={() => void loadProducts()}
          disabled={isLoading}
          className="px-3 py-2 border border-neutral-300 hover:border-black text-xs uppercase font-bold tracking-wider flex items-center gap-1.5 bg-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      }
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

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs font-bold uppercase cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyLowStock}
                onChange={(e) => setOnlyLowStock(e.target.checked)}
                className="w-4 h-4 accent-black"
              />
              <span className="flex items-center gap-1 text-amber-700">
                <AlertTriangle className="w-3.5 h-3.5" />
                Only Low Stock (&lt;25 units)
              </span>
            </label>
          </div>
        </div>

        {/* Inventory rows */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-700 uppercase font-bold text-[11px]">
                <th className="py-3 px-4">Garment</th>
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4">Fixed Price</th>
                <th className="py-3 px-4">Current Stock</th>
                <th className="py-3 px-4 text-center">Quick Adjust</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-neutral-400" />
                    <p>Loading real inventory data...</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-neutral-500">
                    <ShoppingBag className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                    <p className="font-bold text-neutral-800 uppercase">No products in inventory</p>
                    <p className="text-xs text-neutral-400 mt-1">
                      {search ? "No products match your search filter." : "Add products to begin tracking inventory."}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const currentCount = stockMap[p.id] ?? p.stock;
                  const isLow = currentCount < 25;
                  const hasChanged = currentCount !== p.stock;
                  const imageSrc =
                    p.images && p.images.length > 0
                      ? p.images[0]
                      : "/rightnowlife-logo.png";

                  return (
                    <tr key={p.id} className="hover:bg-neutral-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative w-10 h-12 bg-neutral-100 shrink-0 border border-neutral-200 overflow-hidden">
                            <Image
                              src={imageSrc}
                              alt={p.name}
                              fill
                              unoptimized
                              className="object-cover object-top"
                            />
                          </div>
                          <div>
                            <p className="font-bold text-black uppercase truncate max-w-xs">{p.name}</p>
                            <p className="text-[11px] text-neutral-500">{p.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-neutral-600">{p.sku}</td>
                      <td className="py-3 px-4 font-mono font-bold text-black">{formatINR(999)}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 font-mono font-bold px-2 py-0.5 text-xs ${
                            isLow
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : "bg-neutral-100 text-black border border-neutral-200"
                          }`}
                        >
                          {isLow && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                          {currentCount} units
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center border border-neutral-300">
                          <button
                            onClick={() => handleStockChange(p.id, -5)}
                            className="px-2 py-1 hover:bg-neutral-100 text-neutral-700 font-mono text-xs"
                            title="-5 units"
                          >
                            -5
                          </button>
                          <button
                            onClick={() => handleStockChange(p.id, -1)}
                            className="p-1 hover:bg-neutral-100 text-neutral-700"
                            title="-1 unit"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={currentCount}
                            onChange={(e) =>
                              setStockMap((prev) => ({
                                ...prev,
                                [p.id]: Math.max(0, parseInt(e.target.value) || 0),
                              }))
                            }
                            className="w-14 text-center py-1 text-xs font-bold font-mono outline-none border-x border-neutral-300 bg-white"
                          />
                          <button
                            onClick={() => handleStockChange(p.id, 1)}
                            className="p-1 hover:bg-neutral-100 text-neutral-700"
                            title="+1 unit"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleStockChange(p.id, 20)}
                            className="px-2 py-1 hover:bg-neutral-100 text-neutral-700 font-mono text-xs"
                            title="+20 units"
                          >
                            +20
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => void handleSaveStock(p)}
                          disabled={savingId === p.id || !hasChanged}
                          className="px-3 py-1.5 bg-black hover:bg-neutral-800 text-white text-xs uppercase font-bold tracking-wider inline-flex items-center gap-1 disabled:opacity-30 transition-colors shadow-sm"
                        >
                          {savingId === p.id ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Save className="w-3 h-3" />
                          )}
                          <span>{savingId === p.id ? "Saving..." : "Save"}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </SellerLayout>
  );
}
