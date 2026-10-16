"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Search,
  Truck,
  Package,
  Eye,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
  X,
} from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { DEMO_ORDERS } from "@/data/mock-data";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatINR } from "@/lib/utils";
import { Order, OrderStatus } from "@/types";
import { useToast } from "@/context/toast-context";

export default function AdminOrdersPage() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>(DEMO_ORDERS);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const filtered = orders.filter((o) => {
    const matchSearch =
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      o.deliveryAddress.fullName.toLowerCase().includes(search.toLowerCase()) ||
      o.trackingNumber.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || o.orderStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleUpdateStatus = (orderId: string, newStatus: OrderStatus) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, orderStatus: newStatus } : o))
    );
    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder((prev) => (prev ? { ...prev, orderStatus: newStatus } : null));
    }
    toast({
      type: "success",
      title: "Order Status Updated",
      message: `Order status set to ${newStatus.toUpperCase()}`,
    });
  };

  return (
    <AdminLayout
      title="Order Operations & Fulfillment"
      subtitle="Central dispatch control, courier AWB tracking assignment, and order lifecycle management."
    >
      <div className="bg-white border border-neutral-200 shadow-sm">
        {/* Search & Filters */}
        <div className="p-4 sm:p-5 border-b border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by order #, customer, or AWB..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
            />
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold text-neutral-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-neutral-300 text-xs font-bold uppercase bg-white outline-none cursor-pointer"
            >
              <option value="all">All Orders</option>
              <option value="placed">Placed</option>
              <option value="confirmed">Confirmed</option>
              <option value="shipped">In Transit (Shipped)</option>
              <option value="delivered">Delivered</option>
            </select>
          </div>
        </div>

        {/* Orders Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-700 uppercase font-bold text-[11px]">
                <th className="py-3 px-4">Order Ref</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Items</th>
                <th className="py-3 px-4">Total</th>
                <th className="py-3 px-4">Air Courier AWB</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 font-medium">
              {filtered.map((ord) => (
                <tr key={ord.id} className="hover:bg-neutral-50">
                  <td className="py-3 px-4 font-mono font-bold text-black">
                    #{ord.orderNumber}
                  </td>
                  <td className="py-3 px-4 text-neutral-500">
                    {new Date(ord.createdAt).toLocaleDateString("en-IN", { dateStyle: "short" })}
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-bold text-black">{ord.deliveryAddress.fullName}</p>
                    <p className="text-[11px] text-neutral-500">{ord.deliveryAddress.city}</p>
                  </td>
                  <td className="py-3 px-4 font-mono">{ord.items.length} units</td>
                  <td className="py-3 px-4 font-bold text-black">{formatINR(ord.total)}</td>
                  <td className="py-3 px-4 font-mono text-[11px] text-neutral-600">
                    {ord.trackingNumber}
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={ord.orderStatus} />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setSelectedOrder(ord)}
                      className="px-3 py-1 bg-black text-white hover:bg-neutral-800 text-[11px] uppercase font-bold"
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Operations Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-200 shadow-2xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-6 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-500 font-bold">
                  FULFILLMENT DISPATCH CONTROL
                </span>
                <h3 className="text-base font-black uppercase tracking-tight text-black">
                  Order #{selectedOrder.orderNumber}
                </h3>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-neutral-400 hover:text-black p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status Changer */}
            <div className="p-4 bg-[#F5F4F0] border border-neutral-200 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-black">
                Update Fulfillment Status:
              </p>
              <div className="flex flex-wrap gap-2">
                {(["placed", "confirmed", "shipped", "delivered"] as OrderStatus[]).map((st) => (
                  <button
                    key={st}
                    onClick={() => handleUpdateStatus(selectedOrder.id, st)}
                    className={`px-3 py-1.5 text-xs uppercase font-bold tracking-wider transition-colors border ${
                      selectedOrder.orderStatus === st
                        ? "bg-black text-white border-black"
                        : "bg-white text-neutral-700 border-neutral-300 hover:border-black"
                    }`}
                  >
                    Mark {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Delivery Target */}
            <div className="text-xs space-y-1">
              <p className="font-bold uppercase text-neutral-500 text-[11px]">Destination:</p>
              <p className="font-bold text-black">
                {selectedOrder.deliveryAddress.fullName} • {selectedOrder.deliveryAddress.phone}
              </p>
              <p className="text-neutral-600">
                {selectedOrder.deliveryAddress.addressLine1}, {selectedOrder.deliveryAddress.city},{" "}
                {selectedOrder.deliveryAddress.state} – {selectedOrder.deliveryAddress.pinCode}
              </p>
            </div>

            {/* Garments Table */}
            <div className="space-y-2">
              <p className="font-bold uppercase text-neutral-500 text-[11px]">Ordered Garments:</p>
              <div className="divide-y divide-neutral-200 border border-neutral-200">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold uppercase">{item.productName}</p>
                      <p className="text-neutral-500 text-[11px]">
                        Size: {item.size} • Color: {item.color} • Qty: {item.quantity}
                      </p>
                    </div>
                    <span className="font-bold text-black font-mono">
                      {formatINR(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-200 flex justify-end">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-6 py-2 bg-neutral-900 text-white text-xs uppercase tracking-widest font-bold"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
