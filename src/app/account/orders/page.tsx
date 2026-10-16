"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Package, Truck, ExternalLink } from "lucide-react";
import { AccountLayout } from "@/components/layout/AccountLayout";
import { DEMO_ORDERS } from "@/data/mock-data";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatINR } from "@/lib/utils";
import { OrderStatus } from "@/types";

export default function AccountOrdersPage() {
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filteredOrders = DEMO_ORDERS.filter((order) => {
    if (filterStatus === "all") return true;
    return order.orderStatus === filterStatus;
  });

  return (
    <AccountLayout
      title="My Orders & Tracking"
      subtitle="View your complete order history, real-time shipment dispatch status, and air courier tracking numbers."
    >
      <div className="space-y-6">
        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2 pb-2">
          {[
            { label: "All Orders", value: "all" },
            { label: "In Transit", value: "shipped" },
            { label: "Delivered", value: "delivered" },
            { label: "Placed", value: "placed" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilterStatus(tab.value)}
              className={`px-3.5 py-1.5 text-xs uppercase font-bold tracking-wider transition-colors ${
                filterStatus === tab.value
                  ? "bg-black text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-neutral-200 bg-white">
            <Package className="w-10 h-10 text-neutral-400 mx-auto mb-3" />
            <p className="text-xs uppercase tracking-wider font-bold text-neutral-700">
              No orders found under this status.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className="border border-neutral-200 bg-white p-6 shadow-sm space-y-4"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-neutral-200 gap-2">
                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-500 font-bold">
                      Order #{order.orderNumber}
                    </span>
                    <p className="text-xs text-neutral-600 font-medium">
                      Placed on {new Date(order.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <StatusBadge status={order.orderStatus} />
                    <span className="text-xs font-black text-black">{formatINR(order.total)}</span>
                  </div>
                </div>

                {/* Items in Order */}
                <div className="divide-y divide-neutral-100">
                  {order.items.map((item) => (
                    <div key={item.id} className="py-3 flex gap-4 items-center">
                      <div className="relative w-14 h-18 bg-neutral-100 shrink-0 overflow-hidden">
                        <Image src={item.image} alt={item.productName} fill className="object-cover object-top" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/products/${item.productSlug}`}
                          className="text-xs font-bold uppercase tracking-tight text-neutral-900 hover:underline truncate block"
                        >
                          {item.productName}
                        </Link>
                        <p className="text-[11px] text-neutral-500 mt-0.5">
                          Size: {item.size} • Color: {item.color} • Qty: {item.quantity}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-neutral-800">
                        {formatINR(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Tracking Footer */}
                <div className="pt-3 border-t border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F5F4F0] p-3 -mx-6 -mb-6">
                  <div className="flex items-center gap-2 text-xs text-neutral-700">
                    <Truck className="w-4 h-4 text-black shrink-0" />
                    <span>
                      Air Courier AWB: <strong className="font-mono text-black">{order.trackingNumber}</strong>
                    </span>
                  </div>

                  <Link
                    href={`/account/orders/${order.id}`}
                    className="text-xs uppercase tracking-wider font-bold text-black hover:underline flex items-center gap-1 self-start sm:self-auto"
                  >
                    <span>View Tracking Timeline & Invoice</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AccountLayout>
  );
}
