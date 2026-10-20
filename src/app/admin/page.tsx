"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  TrendingUp,
  ShoppingBag,
  AlertTriangle,
  ArrowRight,
  RefreshCcw,
  Loader2,
  DollarSign,
  Truck,
} from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { formatINR } from "@/lib/utils";
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
  dailySales: Array<{
    date: string;
    order_count: number;
    revenue: number;
  }>;
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

const EMPTY_METRICS: DashboardMetrics = {
  orders: {
    total: 0,
    pending: 0,
    paid: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    payment_failed: 0,
    refund_pending: 0,
    refunded: 0,
  },
  sales: {
    gross: 0,
    net: 0,
    refunded: 0,
  },
  dailySales: [],
  recentOrders: [],
  inventoryWarnings: [],
};

function asNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeMetrics(payload: unknown): DashboardMetrics {
  // Supports either a direct metrics response or { data: metrics }.
  const root =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};

  const source =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;

  const rawOrders =
    source.orders && typeof source.orders === "object"
      ? (source.orders as Record<string, unknown>)
      : {};

  const rawSales =
    source.sales && typeof source.sales === "object"
      ? (source.sales as Record<string, unknown>)
      : {};

  const recentOrders = Array.isArray(source.recentOrders)
    ? source.recentOrders
    : Array.isArray(source.recent_orders)
      ? source.recent_orders
      : [];

  const inventoryWarnings = Array.isArray(source.inventoryWarnings)
    ? source.inventoryWarnings
    : Array.isArray(source.inventory_warnings)
      ? source.inventory_warnings
      : [];

  const dailySales = Array.isArray(source.dailySales)
    ? source.dailySales
    : Array.isArray(source.daily_sales)
      ? source.daily_sales
      : [];

  return {
    orders: {
      total: asNumber(rawOrders.total),
      pending: asNumber(rawOrders.pending),
      paid: asNumber(rawOrders.paid),
      processing: asNumber(rawOrders.processing),
      shipped: asNumber(rawOrders.shipped),
      delivered: asNumber(rawOrders.delivered),
      cancelled: asNumber(rawOrders.cancelled),
      payment_failed: asNumber(rawOrders.payment_failed),
      refund_pending: asNumber(rawOrders.refund_pending),
      refunded: asNumber(rawOrders.refunded),
    },
    sales: {
      gross: asNumber(rawSales.gross),
      net: asNumber(rawSales.net),
      refunded: asNumber(rawSales.refunded),
    },
    dailySales: dailySales as DashboardMetrics["dailySales"],
    recentOrders: recentOrders as DashboardMetrics["recentOrders"],
    inventoryWarnings:
      inventoryWarnings as DashboardMetrics["inventoryWarnings"],
  };
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/dashboard", {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const body =
          payload && typeof payload === "object"
            ? (payload as Record<string, unknown>)
            : {};

        throw new Error(
          typeof body.error === "string"
            ? body.error
            : typeof body.message === "string"
              ? body.message
              : `Dashboard request failed (${response.status})`,
        );
      }

      const metrics = normalizeMetrics(payload);
      setData(metrics);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load dashboard data.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMetrics();
  }, [fetchMetrics]);

  const metrics = data ?? EMPTY_METRICS;
  const recentOrders = metrics.recentOrders;
  const inventoryWarnings = metrics.inventoryWarnings;

  return (
    <AdminLayout
      title="Executive Overview"
      subtitle="Brand metrics from the admin dashboard API."
      actions={
        <button
          onClick={() => void fetchMetrics()}
          disabled={loading}
          className="flex cursor-pointer items-center gap-1.5 bg-neutral-100 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-neutral-700 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCcw
            className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
          />
          <span>Refresh</span>
        </button>
      }
    >
      {loading && !data ? (
        <div className="border border-neutral-200 bg-white p-12 text-center shadow-sm">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-neutral-400" />
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            Loading dashboard metrics...
          </p>
        </div>
      ) : error && !data ? (
        <div className="border border-red-200 bg-red-50 p-6 text-xs text-red-700 shadow-sm">
          <p className="mb-1 font-bold uppercase tracking-wider">
            Failed to load dashboard
          </p>
          <p>{error}</p>
          <button
            onClick={() => void fetchMetrics()}
            className="mt-4 bg-red-700 px-4 py-2 font-bold text-white hover:bg-red-800"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {error && (
            <div className="flex items-center justify-between gap-3 border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
              <p>Refresh failed: {error}. Showing the last successfully loaded data.</p>
              <button
                onClick={() => void fetchMetrics()}
                className="shrink-0 font-bold underline"
              >
                Retry
              </button>
            </div>
          )}

          {/* Primary metrics */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1 border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between text-neutral-400">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Gross Sales
                </span>
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="font-mono text-2xl font-black text-black">
                {formatINR(metrics.sales.gross)}
              </p>
              <p className="text-[11px] leading-tight text-neutral-500">
                Total money collected from paid orders
              </p>
            </div>

            <div className="space-y-1 border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between text-neutral-400">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Net Sales
                </span>
                <DollarSign className="h-4 w-4 text-[#0876A8]" />
              </div>
              <p className="font-mono text-2xl font-black text-[#0876A8]">
                {formatINR(metrics.sales.net)}
              </p>
              <p className="text-[11px] leading-tight text-neutral-500">
                Gross sales minus refunds ({formatINR(metrics.sales.refunded)} returned)
              </p>
            </div>

            <div className="space-y-1 border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between text-neutral-400">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Total Orders
                </span>
                <ShoppingBag className="h-4 w-4 text-black" />
              </div>
              <p className="font-mono text-2xl font-black text-black">
                {metrics.orders.total}
              </p>
              <p className="text-[11px] text-neutral-500">
                {metrics.orders.paid} paid • {metrics.orders.pending} pending
              </p>
            </div>

            <div className="space-y-1 border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between text-neutral-400">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Fulfilment Active
                </span>
                <Truck className="h-4 w-4 text-amber-600" />
              </div>
              <p className="font-mono text-2xl font-black text-amber-700">
                {metrics.orders.processing + metrics.orders.shipped}
              </p>
              <p className="text-[11px] text-neutral-500">
                {metrics.orders.processing} processing • {metrics.orders.shipped} shipped
              </p>
            </div>
          </div>

          {/* Order status breakdown */}
          <div className="flex flex-wrap items-center gap-3 border border-neutral-200 bg-white p-4 text-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              Status Breakdown:
            </span>
            <span className="border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">
              Pending Payment: {metrics.orders.pending}
            </span>
            <span className="border border-blue-200 bg-blue-50 px-2.5 py-1 font-semibold text-blue-800">
              Paid: {metrics.orders.paid}
            </span>
            <span className="border border-purple-200 bg-purple-50 px-2.5 py-1 font-semibold text-purple-800">
              Processing: {metrics.orders.processing}
            </span>
            <span className="border border-sky-200 bg-sky-50 px-2.5 py-1 font-semibold text-sky-800">
              Shipped: {metrics.orders.shipped}
            </span>
            <span className="border border-green-200 bg-green-50 px-2.5 py-1 font-semibold text-green-800">
              Delivered: {metrics.orders.delivered}
            </span>
            <span className="border border-red-200 bg-red-50 px-2.5 py-1 font-semibold text-red-800">
              Cancelled: {metrics.orders.cancelled}
            </span>
            {metrics.orders.refund_pending > 0 && (
              <span className="animate-pulse border border-orange-300 bg-orange-100 px-2.5 py-1 font-bold text-orange-900">
                Refund Pending: {metrics.orders.refund_pending}
              </span>
            )}
            <span className="bg-neutral-100 px-2.5 py-1 font-semibold text-neutral-700">
              Refunded: {metrics.orders.refunded}
            </span>
          </div>

          {/* Inventory warnings */}
          {inventoryWarnings.length > 0 && (
            <div className="space-y-3 border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-900">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span>Inventory Alerts (Stock Threshold ≤ 5 units)</span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {inventoryWarnings.map((warning, index) => (
                  <div
                    key={`${warning.product_id}-${warning.size}-${index}`}
                    className="space-y-1 border border-amber-200 bg-white p-3 text-xs"
                  >
                    <p className="truncate font-bold text-neutral-900">
                      {warning.product_name || "Unknown product"}
                    </p>
                    <div className="flex items-center justify-between gap-2 text-[11px] text-neutral-600">
                      <span>
                        Size: <strong>{warning.size || "N/A"}</strong>
                      </span>
                      <span
                        className={`font-mono font-bold ${
                          asNumber(warning.available) === 0
                            ? "text-red-600"
                            : "text-amber-700"
                        }`}
                      >
                        {asNumber(warning.available) === 0
                          ? "OUT OF STOCK"
                          : `${asNumber(warning.available)} left`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent orders */}
          <div className="space-y-4 border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-black">
                Recent Orders ({recentOrders.length})
              </h3>
              <Link
                href="/admin/orders"
                className="flex items-center gap-1 text-xs font-bold text-[#0876A8] hover:underline"
              >
                <span>View All Orders</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {recentOrders.length === 0 ? (
              <div className="space-y-2 py-12 text-center text-neutral-400">
                <ShoppingBag className="mx-auto h-8 w-8 text-neutral-300" />
                <p className="text-xs font-bold uppercase tracking-wider">
                  No Orders Returned
                </p>
                <p className="text-[11px] text-neutral-500">
                  No recent orders were returned by the dashboard API.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-bold uppercase text-neutral-700">
                      <th className="px-3 py-2.5">Order Number</th>
                      <th className="px-3 py-2.5">Customer</th>
                      <th className="px-3 py-2.5">Date</th>
                      <th className="px-3 py-2.5">Amount</th>
                      <th className="px-3 py-2.5">Payment</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5 text-right">Action</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-neutral-100 font-medium">
                    {recentOrders.map((order, index) => (
                      <tr
                        key={order.id || `${order.order_number}-${index}`}
                        className="transition-colors hover:bg-neutral-50"
                      >
                        <td className="px-3 py-3 font-mono font-bold text-black">
                          {order.order_number || order.id || "N/A"}
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-bold text-neutral-900">
                            {order.customer_name || "Customer"}
                          </p>
                          <p className="font-mono text-[11px] text-neutral-500">
                            {order.customer_email || "—"}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-[11px] text-neutral-500">
                          {order.created_at &&
                          !Number.isNaN(Date.parse(order.created_at))
                            ? new Date(order.created_at).toLocaleDateString(
                                "en-IN",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                },
                              )
                            : "—"}
                        </td>
                        <td className="px-3 py-3 font-mono font-bold text-black">
                          {formatINR(asNumber(order.total))}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold uppercase ${
                              order.payment_status === "paid"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {order.payment_status || "unknown"}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold uppercase ${
                              STATUS_COLORS[order.order_status] ||
                              "bg-neutral-100 text-neutral-800"
                            }`}
                          >
                            {STATUS_LABELS[order.order_status] ||
                              order.order_status ||
                              "unknown"}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Link
                            href={`/admin/orders/${encodeURIComponent(order.id)}`}
                            className="text-xs font-bold text-[#0876A8] hover:underline"
                          >
                            Manage →
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
      )}
    </AdminLayout>
  );
}

