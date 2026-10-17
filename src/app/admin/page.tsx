"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  ShoppingBag,
  Package,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  RefreshCcw,
  Loader2,
  DollarSign,
  Truck,
  RotateCcw,
} from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { formatINR } from "@/lib/utils";
import { StatusBadge } from "@/components/common/StatusBadge";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/order-status-machine";

interface DashboardMetrics {
  orders: {
    total: number;
    pending: number;
    paid: number;
    processing: number;
    shipped: number;
    delivered: number;
    cancelled: number;
    payment_failed: number;
    refund_pending: number;
    refunded: number;
  };
  sales: {
    gross: number;
    net: number;
    refunded: number;
  };
  dailySales: Array<{ date: string; order_count: number; revenue: number }>;
  recentOrders: Array<{
    id: string;
    order_number: string;
    customer_name: string;
    customer_email: string;
    total: number;
    order_status: string;
    payment_status: string;
    created_at: string;
  }>;
  inventoryWarnings: Array<{
    product_id: string;
    product_name: string;
    size: string;
    stock: number;
    reserved: number;
    available: number;
  }>;
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/dashboard");
      if (!res.ok) {
        throw new Error("Failed to load dashboard metrics");
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err?.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  return (
    <AdminLayout
      title="Executive Overview"
      subtitle="Real-time brand metrics computed directly from verified database records."
      actions={
        <button
          onClick={fetchMetrics}
          disabled={loading}
          className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-xs font-bold uppercase tracking-wider text-neutral-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      }
    >
      {loading && !data ? (
        <div className="bg-white border border-neutral-200 p-12 text-center shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin text-neutral-400 mx-auto mb-3" />
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            Calculating live metrics from database...
          </p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 p-6 text-red-700 text-xs shadow-sm">
          <p className="font-bold uppercase tracking-wider mb-1">Failed to load metrics</p>
          <p>{error}</p>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Sales Accounting Banner & Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Gross Sales */}
            <div className="bg-white border border-neutral-200 p-5 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-neutral-400">
                <span className="text-xs uppercase font-bold tracking-wider text-neutral-500">
                  Gross Sales
                </span>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-black text-black font-mono">
                {formatINR(data.sales.gross)}
              </p>
              <p className="text-[11px] text-neutral-500 leading-tight">
                Total money collected from paid orders
              </p>
            </div>

            {/* Net Sales */}
            <div className="bg-white border border-neutral-200 p-5 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-neutral-400">
                <span className="text-xs uppercase font-bold tracking-wider text-neutral-500">
                  Net Sales
                </span>
                <DollarSign className="w-4 h-4 text-[#0876A8]" />
              </div>
              <p className="text-2xl font-black text-[#0876A8] font-mono">
                {formatINR(data.sales.net)}
              </p>
              <p className="text-[11px] text-neutral-500 leading-tight">
                Gross sales minus refunds ({formatINR(data.sales.refunded)} returned)
              </p>
            </div>

            {/* Total Orders */}
            <div className="bg-white border border-neutral-200 p-5 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-neutral-400">
                <span className="text-xs uppercase font-bold tracking-wider text-neutral-500">
                  Total Orders
                </span>
                <ShoppingBag className="w-4 h-4 text-black" />
              </div>
              <p className="text-2xl font-black text-black font-mono">{data.orders.total}</p>
              <p className="text-[11px] text-neutral-500">
                {data.orders.paid} paid • {data.orders.pending} pending
              </p>
            </div>

            {/* In-Transit / Dispatched */}
            <div className="bg-white border border-neutral-200 p-5 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-neutral-400">
                <span className="text-xs uppercase font-bold tracking-wider text-neutral-500">
                  Fulfilment Active
                </span>
                <Truck className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-2xl font-black text-amber-700 font-mono">
                {data.orders.processing + data.orders.shipped}
              </p>
              <p className="text-[11px] text-neutral-500">
                {data.orders.processing} processing • {data.orders.shipped} shipped
              </p>
            </div>
          </div>

          {/* Secondary Stats Row: Order Status Breakdown Pills */}
          <div className="bg-white border border-neutral-200 p-4 shadow-sm flex flex-wrap items-center gap-3 text-xs">
            <span className="text-[11px] uppercase font-bold text-neutral-500 tracking-wider">
              Status Breakdown:
            </span>
            <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
              Pending Payment: {data.orders.pending}
            </span>
            <span className="px-2.5 py-1 bg-blue-50 text-blue-800 border border-blue-200 font-semibold">
              Paid: {data.orders.paid}
            </span>
            <span className="px-2.5 py-1 bg-purple-50 text-purple-800 border border-purple-200 font-semibold">
              Processing: {data.orders.processing}
            </span>
            <span className="px-2.5 py-1 bg-sky-50 text-sky-800 border border-sky-200 font-semibold">
              Shipped: {data.orders.shipped}
            </span>
            <span className="px-2.5 py-1 bg-green-50 text-green-800 border border-green-200 font-semibold">
              Delivered: {data.orders.delivered}
            </span>
            <span className="px-2.5 py-1 bg-red-50 text-red-800 border border-red-200 font-semibold">
              Cancelled: {data.orders.cancelled}
            </span>
            {data.orders.refund_pending > 0 && (
              <span className="px-2.5 py-1 bg-orange-100 text-orange-900 border border-orange-300 font-bold animate-pulse">
                Refund Pending: {data.orders.refund_pending}
              </span>
            )}
            <span className="px-2.5 py-1 bg-neutral-100 text-neutral-700 font-semibold">
              Refunded: {data.orders.refunded}
            </span>
          </div>

          {/* Low Stock & Out-of-Stock Warnings */}
          {data.inventoryWarnings && data.inventoryWarnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Inventory Alerts (Stock Threshold &le; 5 units)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {data.inventoryWarnings.map((w, idx) => (
                  <div
                    key={`${w.product_id}-${w.size}-${idx}`}
                    className="p-3 bg-white border border-amber-200 text-xs space-y-1"
                  >
                    <p className="font-bold text-neutral-900 truncate">{w.product_name}</p>
                    <div className="flex items-center justify-between text-[11px] text-neutral-600">
                      <span>Size: <strong>{w.size}</strong></span>
                      <span className={`font-mono font-bold ${w.available === 0 ? "text-red-600" : "text-amber-700"}`}>
                        {w.available === 0 ? "OUT OF STOCK" : `${w.available} left`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Central Orders Pipeline */}
          <div className="bg-white border border-neutral-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-black">
                Recent Orders ({data.recentOrders.length})
              </h3>
              <Link
                href="/admin/orders"
                className="text-xs font-bold text-[#0876A8] hover:underline flex items-center gap-1"
              >
                <span>View All Orders</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {data.recentOrders.length === 0 ? (
              <div className="py-12 text-center text-neutral-400 space-y-2">
                <ShoppingBag className="w-8 h-8 mx-auto text-neutral-300" />
                <p className="text-xs font-bold uppercase tracking-wider">No Orders Placed Yet</p>
                <p className="text-[11px] text-neutral-500">
                  When customers complete checkout, verified database orders will appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-700 uppercase font-bold text-[11px]">
                      <th className="py-2.5 px-3">Order Number</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Amount</th>
                      <th className="py-2.5 px-3">Payment</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 font-medium">
                    {data.recentOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-neutral-50 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-black">{o.order_number}</td>
                        <td className="py-3 px-3">
                          <p className="font-bold text-neutral-900">{o.customer_name}</p>
                          <p className="text-[11px] text-neutral-500 font-mono">{o.customer_email}</p>
                        </td>
                        <td className="py-3 px-3 text-neutral-500 text-[11px]">
                          {new Date(o.created_at).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-black">
                          {formatINR(o.total)}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 text-[10px] uppercase font-bold ${
                              o.payment_status === "paid"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {o.payment_status}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 text-[10px] uppercase font-bold ${
                              STATUS_COLORS[o.order_status] || "bg-neutral-100 text-neutral-800"
                            }`}
                          >
                            {STATUS_LABELS[o.order_status] || o.order_status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <Link
                            href={`/admin/orders/${o.id}`}
                            className="text-xs font-bold text-[#0876A8] hover:underline"
                          >
                            Manage &rarr;
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
}
