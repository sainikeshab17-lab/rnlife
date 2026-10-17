"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  RotateCcw,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Search,
  Filter,
} from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { formatINR } from "@/lib/utils";

interface ReturnItem {
  id: string;
  order_item_id: string;
  product_id: string;
  product_name: string;
  size: string;
  quantity: number;
  price: number;
  requested_exchange_size: string | null;
  condition: "pending" | "resalable" | "damaged" | "unsuitable";
  restocked: number;
}

interface ReturnRecord {
  id: string;
  order_id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  type: "return" | "exchange";
  status: "requested" | "approved" | "rejected" | "in_transit" | "inspected" | "completed" | "cancelled";
  reason: string;
  customer_note: string | null;
  admin_note: string | null;
  resolution_type: "refund" | "exchange";
  refund_amount: number;
  created_at: string;
  updated_at: string;
  items: ReturnItem[];
}

export default function AdminReturnsPage() {
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchReturns = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/returns");
      if (!res.ok) throw new Error("Failed to load return records.");
      const data = await res.json();
      setReturns(data.returns || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load returns.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturns();
  }, []);

  const handleUpdateStatus = async (returnId: string, status: string) => {
    const adminNote = prompt(`Optional note for status transition to "${status}":`);
    if (adminNote === null) return;

    setActionLoading(returnId);
    try {
      const res = await fetch("/api/admin/returns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnId, status, adminNote }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update return status.");
      }

      await fetchReturns();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleInspectItem = async (returnItemId: string, condition: "resalable" | "damaged" | "unsuitable") => {
    const confirmMsg =
      condition === "resalable"
        ? "Mark as Resalable? This will automatically restock the item in warehouse inventory."
        : `Mark as ${condition}? Item will NOT be restocked.`;

    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch("/api/admin/returns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returnId: "dummy", // router accepts inspections array
          inspections: [{ returnItemId, condition }],
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to record inspection.");
      }

      await fetchReturns();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredReturns = returns.filter((r) => {
    if (filterType !== "all" && r.type !== filterType) return false;
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchNum = r.order_number?.toLowerCase().includes(q);
      const matchName = r.customer_name?.toLowerCase().includes(q);
      const matchEmail = r.customer_email?.toLowerCase().includes(q);
      const matchId = r.id.toLowerCase().includes(q);
      if (!matchNum && !matchName && !matchEmail && !matchId) return false;
    }
    return true;
  });

  return (
    <AdminLayout
      title="Returns & Exchanges Queue"
      subtitle="Customer return authorization, garment inspection recording, automated warehouse restocking, and refund management."
      actions={
        <button
          onClick={fetchReturns}
          className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-xs font-bold uppercase tracking-wider text-neutral-700 flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      }
    >
      <div className="space-y-6">
        {/* Filters */}
        <div className="bg-white border border-neutral-200 p-4 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by order #, customer, or ID..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-neutral-300 focus:border-black outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              <Filter className="w-3.5 h-3.5" />
              <span>Type:</span>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="border border-neutral-300 px-2 py-1 text-xs outline-none uppercase font-bold"
              >
                <option value="all">All Types</option>
                <option value="return">Return</option>
                <option value="exchange">Exchange</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              <span>Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border border-neutral-300 px-2 py-1 text-xs outline-none uppercase font-bold"
              >
                <option value="all">All Statuses</option>
                <option value="requested">Requested</option>
                <option value="approved">Approved</option>
                <option value="inspected">Inspected</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-white border border-neutral-200 p-12 text-center shadow-sm">
            <Loader2 className="w-8 h-8 animate-spin text-neutral-400 mx-auto mb-3" />
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Loading return requests...
            </p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 p-6 text-red-700 text-xs shadow-sm">
            <p className="font-bold uppercase tracking-wider mb-1">Failed to load returns</p>
            <p>{error}</p>
          </div>
        ) : filteredReturns.length === 0 ? (
          <div className="bg-white border border-neutral-200 p-12 text-center shadow-sm">
            <RotateCcw className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              No return or exchange requests found
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredReturns.map((ret) => (
              <div
                key={ret.id}
                className="bg-white border border-neutral-200 p-5 shadow-sm space-y-4"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-neutral-200 gap-2">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider ${
                        ret.type === "exchange"
                          ? "bg-purple-100 text-purple-800 border border-purple-200"
                          : "bg-blue-100 text-blue-800 border border-blue-200"
                      }`}
                    >
                      {ret.type}
                    </span>
                    <span className="font-mono text-xs font-bold text-[#111111]">
                      {ret.id}
                    </span>
                    <span className="text-xs text-neutral-500">
                      for Order{" "}
                      <Link
                        href={`/admin/orders/${ret.order_id}`}
                        className="font-bold text-[#111111] hover:underline"
                      >
                        #{ret.order_number}
                      </Link>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 text-xs uppercase font-bold ${
                        ret.status === "completed"
                          ? "bg-emerald-100 text-emerald-800"
                          : ret.status === "approved"
                          ? "bg-blue-100 text-blue-800"
                          : ret.status === "rejected"
                          ? "bg-red-100 text-red-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {ret.status}
                    </span>
                    <span className="text-[11px] text-neutral-400 font-mono">
                      {new Date(ret.created_at).toLocaleDateString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-neutral-700">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                      Customer
                    </span>
                    <p className="font-semibold text-[#111111]">{ret.customer_name}</p>
                    <p className="text-neutral-500 font-mono text-[11px]">{ret.customer_email}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                      Reason & Customer Note
                    </span>
                    <p className="font-semibold text-[#111111]">{ret.reason}</p>
                    {ret.customer_note && (
                      <p className="text-neutral-500 italic mt-0.5">&ldquo;{ret.customer_note}&rdquo;</p>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                      Resolution
                    </span>
                    <p className="font-semibold text-[#111111]">
                      {ret.resolution_type === "exchange" ? "Size Exchange" : `Refund: ${formatINR(ret.refund_amount)}`}
                    </p>
                    {ret.admin_note && (
                      <p className="text-neutral-500 text-[11px] mt-0.5">Admin: {ret.admin_note}</p>
                    )}
                  </div>
                </div>

                {/* Items and Condition Inspection */}
                <div className="border-t border-neutral-100 pt-3 space-y-2">
                  <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                    Garments Under Inspection
                  </span>
                  <div className="divide-y divide-neutral-100 border border-neutral-200">
                    {ret.items.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <p className="font-bold text-[#111111]">
                            {item.product_name} ({item.size})
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-0.5">
                            <span>Qty: {item.quantity}</span>
                            <span>•</span>
                            <span>Price: {formatINR(item.price)}</span>
                            {item.requested_exchange_size && (
                              <>
                                <span>•</span>
                                <span className="text-purple-700 font-bold">
                                  Requested Exchange: {item.requested_exchange_size}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Condition status & buttons */}
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 text-[10px] uppercase font-bold ${
                              item.condition === "resalable"
                                ? "bg-emerald-100 text-emerald-800"
                                : item.condition === "damaged"
                                ? "bg-red-100 text-red-800"
                                : item.condition === "unsuitable"
                                ? "bg-neutral-100 text-neutral-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            Condition: {item.condition}
                          </span>
                          {item.restocked === 1 && (
                            <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Restocked
                            </span>
                          )}

                          {item.condition === "pending" && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleInspectItem(item.id, "resalable")}
                                className="px-2 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] uppercase font-bold"
                              >
                                Resalable (Restock)
                              </button>
                              <button
                                onClick={() => handleInspectItem(item.id, "damaged")}
                                className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-[10px] uppercase font-bold"
                              >
                                Damaged
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Return Actions */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                  {ret.status === "requested" && (
                    <>
                      <button
                        onClick={() => handleUpdateStatus(ret.id, "approved")}
                        className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs uppercase font-bold tracking-wider"
                      >
                        Approve Request
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(ret.id, "rejected")}
                        className="px-3 py-1.5 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 text-xs uppercase font-bold tracking-wider"
                      >
                        Reject
                      </button>
                    </>
                  )}

                  {ret.status === "approved" && (
                    <button
                      onClick={() => handleUpdateStatus(ret.id, "inspected")}
                      className="px-3 py-1.5 bg-neutral-800 hover:bg-black text-white text-xs uppercase font-bold tracking-wider"
                    >
                      Mark Inspected
                    </button>
                  )}

                  {ret.status === "inspected" && ret.type === "return" && (
                    <Link
                      href={`/admin/orders/${ret.order_id}`}
                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs uppercase font-bold tracking-wider flex items-center gap-1"
                    >
                      <span>Issue Refund ₹{ret.refund_amount} &rarr;</span>
                    </Link>
                  )}

                  {ret.status === "inspected" && ret.type === "exchange" && (
                    <button
                      onClick={() => handleUpdateStatus(ret.id, "completed")}
                      className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white text-xs uppercase font-bold tracking-wider"
                    >
                      Complete Exchange
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
