"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  Boxes,
  Search,
  AlertTriangle,
  RefreshCcw,
  Loader2,
  Edit2,
  Check,
  X,
  History,
  ShieldAlert,
} from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { formatINR } from "@/lib/utils";

interface InventoryProduct {
  product_id: string;
  product_name: string;
  sku: string;
  image: string;
  sizes: Array<{
    size: string;
    stock: number;
    reserved: number;
    available: number;
  }>;
  total_stock: number;
  total_reserved: number;
  total_available: number;
}

interface AdjustmentHistoryItem {
  id: string;
  size: string;
  prev_stock: number;
  new_stock: number;
  delta: number;
  reason: string;
  actor: string;
  created_at: string;
}

export default function AdminInventoryPage() {
  const [inventory, setInventory] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Edit modal / inline adjustment state
  const [editingVariant, setEditingVariant] = useState<{
    productId: string;
    productName: string;
    size: string;
    currentStock: number;
    reserved: number;
  } | null>(null);
  const [newStockInput, setNewStockInput] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // History modal state
  const [viewingHistory, setViewingHistory] = useState<{
    productId: string;
    productName: string;
    size: string;
  } | null>(null);
  const [historyItems, setHistoryItems] = useState<AdjustmentHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/inventory");
      if (!res.ok) throw new Error("Failed to load inventory");
      const data = await res.json();
      setInventory(data.inventory);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const openEditModal = (
    productId: string,
    productName: string,
    size: string,
    currentStock: number,
    reserved: number
  ) => {
    setEditingVariant({ productId, productName, size, currentStock, reserved });
    setNewStockInput(currentStock);
    setAdjustReason("");
    setAdjustError(null);
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVariant) return;

    if (adjustReason.trim().length < 3) {
      setAdjustError("Please specify a reason (at least 3 characters).");
      return;
    }

    setAdjusting(true);
    setAdjustError(null);

    try {
      const res = await fetch(
        `/api/admin/inventory/${editingVariant.productId}/${editingVariant.size}/adjust`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            new_stock: Number(newStockInput),
            reason: adjustReason.trim(),
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setAdjustError(data.error || "Failed to update stock.");
        return;
      }

      setEditingVariant(null);
      await fetchInventory();
    } catch {
      setAdjustError("Network error while updating stock.");
    } finally {
      setAdjusting(false);
    }
  };

  const openHistoryModal = async (productId: string, productName: string, size: string) => {
    setViewingHistory({ productId, productName, size });
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/admin/inventory/${productId}/${size}/adjust`);
      const data = await res.json();
      setHistoryItems(data.history || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const totalGarments = inventory.reduce((sum, p) => sum + p.total_stock, 0);
  const totalReserved = inventory.reduce((sum, p) => sum + p.total_reserved, 0);
  const totalAvailable = inventory.reduce((sum, p) => sum + p.total_available, 0);
  const totalValuation = totalGarments * 999; // Locked server price ₹999

  const filtered = inventory.filter(
    (p) =>
      p.product_name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout
      title="Warehouse Inventory Control"
      subtitle="Complete stock allocation, checkout reservations, physical stock counts, and audit adjustments."
      actions={
        <button
          onClick={fetchInventory}
          disabled={loading}
          className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-xs font-bold uppercase tracking-wider text-neutral-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      }
    >
      <div className="space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-neutral-200 p-4 shadow-sm space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">
              Total In Stock
            </span>
            <p className="text-2xl font-black text-black font-mono">{totalGarments} units</p>
            <p className="text-[11px] text-neutral-500">Physical warehouse count</p>
          </div>

          <div className="bg-white border border-neutral-200 p-4 shadow-sm space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">
              Checkout Reserved
            </span>
            <p className="text-2xl font-black text-amber-700 font-mono">{totalReserved} units</p>
            <p className="text-[11px] text-neutral-500">Locked by pending checkouts</p>
          </div>

          <div className="bg-white border border-neutral-200 p-4 shadow-sm space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">
              Available to Sell
            </span>
            <p className="text-2xl font-black text-emerald-700 font-mono">{totalAvailable} units</p>
            <p className="text-[11px] text-neutral-500">Sellable on storefront</p>
          </div>

          <div className="bg-white border border-neutral-200 p-4 shadow-sm space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">
              Catalog Valuation (INR)
            </span>
            <p className="text-2xl font-black text-black font-mono">{formatINR(totalValuation)}</p>
            <p className="text-[11px] text-neutral-500 font-semibold">Strict ₹999/unit retail</p>
          </div>
        </div>

        {/* Global Inventory Table */}
        <div className="bg-white border border-neutral-200 shadow-sm">
          <div className="p-4 sm:p-5 border-b border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by design or SKU..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
              />
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
            </div>

            <div className="text-xs text-neutral-500">
              Showing <strong>{filtered.length}</strong> apparel designs
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-neutral-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-neutral-400" />
              <p className="text-xs font-bold uppercase tracking-wider">Loading inventory matrix...</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-200">
              {filtered.map((item) => (
                <div key={item.product_id} className="p-5 hover:bg-neutral-50/50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-neutral-100 border border-neutral-200 relative flex-shrink-0">
                        {item.image && (
                          <Image
                            src={item.image}
                            alt={item.product_name}
                            fill
                            className="object-cover"
                          />
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase text-black">
                          {item.product_name}
                        </h4>
                        <span className="text-[10px] font-mono text-neutral-500 uppercase">
                          SKU: {item.sku} • Fixed Price: ₹999
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono">
                      <div>
                        <span className="text-[10px] uppercase text-neutral-400 font-sans block">
                          Total Stock:
                        </span>
                        <strong className="text-black">{item.total_stock}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-neutral-400 font-sans block">
                          Reserved:
                        </span>
                        <strong className="text-amber-700">{item.total_reserved}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-neutral-400 font-sans block">
                          Available:
                        </span>
                        <strong className="text-emerald-700">{item.total_available}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Per-Size Variant Breakdown Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-2">
                    {item.sizes.map((variant) => (
                      <div
                        key={variant.size}
                        className="p-2.5 bg-neutral-50 border border-neutral-200 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-neutral-900">
                            Size {variant.size}
                          </span>
                          <span
                            className={`text-[10px] font-bold ${
                              variant.available === 0
                                ? "text-red-600"
                                : variant.available <= 5
                                ? "text-amber-600"
                                : "text-emerald-700"
                            }`}
                          >
                            {variant.available === 0 ? "OOS" : `${variant.available} avail`}
                          </span>
                        </div>

                        <div className="text-[10px] text-neutral-500 flex justify-between">
                          <span>Physical: {variant.stock}</span>
                          <span>Res: {variant.reserved}</span>
                        </div>

                        <div className="flex items-center gap-1 pt-1 border-t border-neutral-200">
                          <button
                            onClick={() =>
                              openEditModal(
                                item.product_id,
                                item.product_name,
                                variant.size,
                                variant.stock,
                                variant.reserved
                              )
                            }
                            className="flex-1 py-1 bg-white hover:bg-neutral-100 border border-neutral-300 text-[10px] uppercase font-bold text-neutral-700 flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() =>
                              openHistoryModal(item.product_id, item.product_name, variant.size)
                            }
                            title="View adjustment audit trail"
                            className="p-1 bg-white hover:bg-neutral-100 border border-neutral-300 text-neutral-600 cursor-pointer"
                          >
                            <History className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stock Adjustment Modal */}
      {editingVariant && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-300 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-black">
                Adjust Variant Stock
              </h3>
              <button
                onClick={() => setEditingVariant(null)}
                className="text-neutral-400 hover:text-black cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs space-y-1">
              <p className="font-bold text-neutral-900">{editingVariant.productName}</p>
              <p className="text-neutral-500">
                Size: <strong className="text-black">{editingVariant.size}</strong> • Current Physical Stock:{" "}
                <strong className="text-black">{editingVariant.currentStock}</strong>
              </p>
              {editingVariant.reserved > 0 && (
                <p className="text-[11px] text-amber-700">
                  * {editingVariant.reserved} units are currently reserved by pending orders.
                </p>
              )}
            </div>

            {adjustError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs">
                {adjustError}
              </div>
            )}

            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase font-bold text-neutral-700 tracking-wider mb-1">
                  New Physical Stock Count:
                </label>
                <input
                  type="number"
                  required
                  min={editingVariant.reserved}
                  max={10000}
                  value={newStockInput}
                  onChange={(e) => setNewStockInput(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-bold font-mono"
                />
                <span className="text-[10px] text-neutral-400 block mt-1">
                  Difference:{" "}
                  <strong className={newStockInput - editingVariant.currentStock >= 0 ? "text-emerald-700" : "text-red-600"}>
                    {newStockInput - editingVariant.currentStock >= 0 ? "+" : ""}
                    {newStockInput - editingVariant.currentStock} units
                  </strong>
                </span>
              </div>

              <div>
                <label className="block text-[11px] uppercase font-bold text-neutral-700 tracking-wider mb-1">
                  Reason for Adjustment (Required for Audit):
                </label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Physical inventory cycle count, warehouse restock, damaged garment"
                  className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingVariant(null)}
                  className="flex-1 py-2 border border-neutral-300 text-xs uppercase font-bold text-neutral-700 hover:bg-neutral-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjusting}
                  className="flex-1 py-2 bg-black hover:bg-neutral-800 text-white text-xs uppercase font-bold tracking-wider cursor-pointer disabled:opacity-50"
                >
                  {adjusting ? "Saving..." : "Commit Change"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {viewingHistory && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-300 max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-black flex items-center gap-1.5">
                <History className="w-4 h-4 text-neutral-500" />
                <span>Adjustment Audit History</span>
              </h3>
              <button
                onClick={() => setViewingHistory(null)}
                className="text-neutral-400 hover:text-black cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs">
              <span className="font-bold text-neutral-900">{viewingHistory.productName}</span>
              <span className="text-neutral-500 block">Variant: Size {viewingHistory.size}</span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-neutral-100">
              {loadingHistory ? (
                <div className="py-8 text-center text-neutral-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-1 text-neutral-400" />
                  <p className="text-[11px]">Loading history...</p>
                </div>
              ) : historyItems.length === 0 ? (
                <p className="text-xs text-neutral-400 py-6 text-center italic">
                  No manual stock adjustments recorded for this variant.
                </p>
              ) : (
                historyItems.map((h) => (
                  <div key={h.id} className="py-2.5 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold">
                        {h.prev_stock} &rarr; {h.new_stock}{" "}
                        <span className={h.delta >= 0 ? "text-emerald-700" : "text-red-600"}>
                          ({h.delta >= 0 ? `+${h.delta}` : h.delta})
                        </span>
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        {new Date(h.created_at).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-700 italic">&ldquo;{h.reason}&rdquo;</p>
                    <p className="text-[10px] text-neutral-400">By: {h.actor}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
