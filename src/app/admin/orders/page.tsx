"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  Truck,
  Package,
  Eye,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
  RefreshCcw,
  Loader2,
  Filter,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { formatINR } from "@/lib/utils";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/order-status-machine";
import { DbOrder } from "@/lib/db/index";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const fetchOrders = async (targetPage = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", targetPage.toString());
      params.set("limit", "15");
      if (search) params.set("q", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (paymentStatusFilter !== "all") params.set("payment_status", paymentStatusFilter);
      if (fromDate) params.set("from_date", fromDate);
      if (toDate) params.set("to_date", toDate);

      const res = await fetch(`/api/admin/orders?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load orders");
      const data = await res.json();
      setOrders(data.orders);
      setTotal(data.total);
      setPages(data.pages);
      setPage(data.page);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders(1);
  }, [statusFilter, paymentStatusFilter, fromDate, toDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrders(1);
  };

  return (
    <AdminLayout
      title="Order Operations & Fulfillment"
      subtitle="Complete lifecycle order management, payment status verification, and courier dispatch tracking."
      actions={
        <button
          onClick={() => fetchOrders(page)}
          disabled={loading}
          className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-xs font-bold uppercase tracking-wider text-neutral-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      }
    >
      <div className="bg-white border border-neutral-200 shadow-sm space-y-4">
        {/* Search & Filter Toolbar */}
        <div className="p-4 sm:p-5 border-b border-neutral-200 space-y-3">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by order #, customer name, email, or AWB tracking..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
              />
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
            </div>

            <button
              type="submit"
              className="px-4 py-2 bg-black hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              Search
            </button>
          </form>

          {/* Secondary Filters */}
          <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-neutral-500">Order Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2 py-1 border border-neutral-300 text-xs font-bold bg-white cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="pending_payment">Pending Payment</option>
                <option value="paid">Paid</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
                <option value="refund_pending">Refund Pending</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-neutral-500">Payment:</span>
              <select
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
                className="px-2 py-1 border border-neutral-300 text-xs font-bold bg-white cursor-pointer"
              >
                <option value="all">All Payments</option>
                <option value="paid">Paid</option>
                <option value="pending_payment">Pending Payment</option>
                <option value="payment_failed">Payment Failed</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-neutral-500">From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-2 py-1 border border-neutral-300 text-xs bg-white"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-neutral-500">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-2 py-1 border border-neutral-300 text-xs bg-white"
              />
            </div>

            {(search || statusFilter !== "all" || paymentStatusFilter !== "all" || fromDate || toDate) && (
              <button
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setPaymentStatusFilter("all");
                  setFromDate("");
                  setToDate("");
                }}
                className="text-xs text-[#0876A8] hover:underline font-bold"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Orders Table */}
        {loading ? (
          <div className="py-16 text-center text-neutral-400">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-neutral-400" />
            <p className="text-xs font-bold uppercase tracking-wider">Loading orders from database...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="py-16 text-center text-neutral-400 space-y-2">
            <Package className="w-8 h-8 mx-auto text-neutral-300" />
            <p className="text-xs font-bold uppercase tracking-wider">No Orders Found</p>
            <p className="text-[11px] text-neutral-500">Try adjusting your search queries or date filters.</p>
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-700 uppercase font-bold text-[11px]">
                    <th className="py-3 px-4">Order ID & Date</th>
                    <th className="py-3 px-4">Customer Details</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4">Order Status</th>
                    <th className="py-3 px-4">Tracking</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 font-medium">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-black block">{o.order_number}</span>
                        <span className="text-[11px] text-neutral-500 font-mono">
                          {new Date(o.created_at).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-bold text-neutral-900 block">{o.customer_name}</span>
                        <span className="text-[11px] text-neutral-500 block font-mono">{o.customer_email}</span>
                        <span className="text-[10px] text-neutral-400 font-mono">{o.customer_phone}</span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-black block">{formatINR(o.total)}</span>
                        <span className="text-[10px] text-neutral-400">
                          {o.discount > 0 && `(Saved ${formatINR(o.discount)})`}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 text-[10px] uppercase font-bold ${
                            o.payment_status === "paid"
                              ? "bg-emerald-100 text-emerald-800"
                              : o.payment_status === "payment_failed"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {o.payment_status}
                        </span>
                        {o.razorpay_payment_id && (
                          <span className="text-[10px] font-mono text-neutral-400 block mt-0.5 truncate max-w-[120px]">
                            {o.razorpay_payment_id}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 text-[10px] uppercase font-bold ${
                            STATUS_COLORS[o.order_status] || "bg-neutral-100 text-neutral-800"
                          }`}
                        >
                          {STATUS_LABELS[o.order_status] || o.order_status}
                        </span>
                        {o.refund_status === "refund_pending" && (
                          <span className="text-[10px] font-bold text-orange-700 block mt-0.5 animate-pulse">
                            Refund Required
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {o.tracking_number ? (
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-bold uppercase text-neutral-700 block">
                              {o.courier_name || "Express"}
                            </span>
                            <span className="font-mono text-[10px] text-neutral-600 block">
                              {o.tracking_number}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-neutral-400 italic">Unassigned</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#0876A8] hover:text-[#111111] uppercase tracking-wider"
                        >
                          <span>Manage</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            <div className="p-4 border-t border-neutral-200 flex items-center justify-between text-xs">
              <span className="text-neutral-500">
                Showing <strong>{orders.length}</strong> of <strong>{total}</strong> orders
              </span>

              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => fetchOrders(page - 1)}
                  className="px-2.5 py-1 border border-neutral-300 text-neutral-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>
                <span className="px-2 font-mono font-bold">
                  {page} / {pages}
                </span>
                <button
                  disabled={page >= pages}
                  onClick={() => fetchOrders(page + 1)}
                  className="px-2.5 py-1 border border-neutral-300 text-neutral-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
