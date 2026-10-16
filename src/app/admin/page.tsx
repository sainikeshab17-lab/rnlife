"use client";

import React from "react";
import Link from "next/link";
import {
  TrendingUp,
  ShoppingBag,
  Package,
  AlertTriangle,
  Users,
  CheckCircle,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { DEMO_ORDERS, PRODUCTS, DEMO_STAFF } from "@/data/mock-data";
import { formatINR } from "@/lib/utils";
import { StatusBadge } from "@/components/common/StatusBadge";

export default function AdminOverviewPage() {
  const totalSales = DEMO_ORDERS.reduce((sum, o) => sum + o.total, 0) + 184500; // adding baseline demo metrics
  const totalOrders = DEMO_ORDERS.length + 84;
  const pendingOrders = DEMO_ORDERS.filter((o) => o.orderStatus !== "delivered").length + 6;
  const lowStockCount = PRODUCTS.filter((p) => p.stock < 25).length;

  return (
    <AdminLayout
      title="Executive Overview"
      subtitle="High-level brand sales trajectory, live fulfillment status, and catalog alerts."
    >
      <div className="space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-neutral-200 p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-neutral-400">
              <span className="text-xs uppercase font-bold tracking-wider text-neutral-500">
                Gross Sales (Demo)
              </span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-black font-mono">{formatINR(totalSales)}</p>
            <p className="text-[11px] text-emerald-700 font-semibold">+18.4% this month</p>
          </div>

          <div className="bg-white border border-neutral-200 p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-neutral-400">
              <span className="text-xs uppercase font-bold tracking-wider text-neutral-500">
                Total Orders
              </span>
              <ShoppingBag className="w-4 h-4 text-black" />
            </div>
            <p className="text-2xl font-black text-black font-mono">{totalOrders}</p>
            <p className="text-[11px] text-neutral-500">Pan-India Dispatches</p>
          </div>

          <div className="bg-white border border-neutral-200 p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-neutral-400">
              <span className="text-xs uppercase font-bold tracking-wider text-neutral-500">
                Pending Fulfillment
              </span>
              <Package className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-2xl font-black text-amber-700 font-mono">{pendingOrders}</p>
            <p className="text-[11px] text-neutral-500">Requires Courier Label</p>
          </div>

          <div className="bg-white border border-neutral-200 p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-neutral-400">
              <span className="text-xs uppercase font-bold tracking-wider text-neutral-500">
                Low Stock Variants
              </span>
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </div>
            <p className="text-2xl font-black text-red-600 font-mono">{lowStockCount}</p>
            <p className="text-[11px] text-neutral-500">Threshold &lt; 25 units</p>
          </div>
        </div>

        {/* Central Orders Table */}
        <div className="bg-white border border-neutral-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
            <h3 className="text-xs font-bold uppercase tracking-wider text-black">
              Central Order Pipeline
            </h3>
            <Link
              href="/admin/orders"
              className="text-xs font-bold text-neutral-600 hover:text-black underline"
            >
              Manage Orders &rarr;
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-700 uppercase font-bold text-[11px]">
                  <th className="py-2.5 px-3">Order Ref</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Items</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Courier AWB</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 font-medium">
                {DEMO_ORDERS.map((ord) => (
                  <tr key={ord.id} className="hover:bg-neutral-50">
                    <td className="py-3 px-3 font-mono font-bold text-black">
                      #{ord.orderNumber}
                    </td>
                    <td className="py-3 px-3 font-semibold text-neutral-900">
                      {ord.deliveryAddress.fullName}
                      <span className="block text-[10px] text-neutral-400 font-normal">
                        {ord.deliveryAddress.city}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-neutral-600">
                      {ord.items.length} {ord.items.length === 1 ? "garment" : "garments"}
                    </td>
                    <td className="py-3 px-3 font-bold text-black">{formatINR(ord.total)}</td>
                    <td className="py-3 px-3 font-mono text-[11px] text-neutral-500">
                      {ord.trackingNumber}
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={ord.orderStatus} />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        href="/admin/orders"
                        className="text-xs font-bold text-black hover:underline"
                      >
                        Inspect
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Operations Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/admin/products"
            className="p-4 bg-white border border-neutral-200 hover:border-black transition-colors shadow-sm block"
          >
            <p className="text-xs uppercase font-bold text-black">Catalog Governance</p>
            <p className="text-[11px] text-neutral-500 mt-1">
              {PRODUCTS.length} live streetwear items configured.
            </p>
          </Link>

          <Link
            href="/admin/collections"
            className="p-4 bg-white border border-neutral-200 hover:border-black transition-colors shadow-sm block"
          >
            <p className="text-xs uppercase font-bold text-black">Drop Series & Collections</p>
            <p className="text-[11px] text-neutral-500 mt-1">
              5 seasonal streetwear series active.
            </p>
          </Link>

          <Link
            href="/admin/staff"
            className="p-4 bg-white border border-neutral-200 hover:border-black transition-colors shadow-sm block"
          >
            <p className="text-xs uppercase font-bold text-black">Staff Accounts</p>
            <p className="text-[11px] text-neutral-500 mt-1">
              {DEMO_STAFF.length} staff members authorized.
            </p>
          </Link>
        </div>
      </div>
    </AdminLayout>
  );
}
