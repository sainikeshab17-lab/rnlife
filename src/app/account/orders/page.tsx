"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { Package, Truck, ExternalLink, ArrowRight, Loader2 } from "lucide-react";
import { AccountLayout } from "@/components/layout/AccountLayout";
import { useAuth } from "@/context/auth-context";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatINR } from "@/lib/utils";
import type { OrderStatus } from "@/types";
import { hasRequiredOrderPayment } from "@/services/order-payment-state";
import { OrderReviewForm } from "@/components/order/OrderReviewForm";

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  product_slug: string;
  size: string;
  color: string;
  quantity: number;
  price: number;
  image: string;
  fulfillment_type?: "stock" | "made_to_order";
  customization?: { quote: string; mood: string; quoteStyle: string; font: string; printColor: string; placement: string } | null;
}

interface OrderRecord {
  id: string;
  order_number: string;
  created_at: string;
  order_status: string;
  payment_status: string;
  total: number;
  payment_method?: string;
  payment_attempts?: { purpose: string; payment_state: string; amount_paisa: number }[];
  items: OrderItem[];
}

function OrdersContent() {
  const { user } = useAuth();

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const activeEmail = user?.email || "";

  useEffect(() => {
    let isMounted = true;

    async function fetchOrders() {
      if (!activeEmail) {
        setIsLoading(false);
        setOrders([]);
        setOrdersError("Sign in to view your orders.");
        return;
      }
      setIsLoading(true);
      setOrders([]);
      setOrdersError(null);
      try {
        const res = await fetch("/api/orders", { credentials: "same-origin", cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.orders) {
            setOrders(data.orders);
          }
        } else if (isMounted) {
          setOrdersError(res.status === 401 ? "Sign in to view your orders." : "We could not load your orders. Please try again.");
        }
      } catch (err) {
        console.error("Failed to load customer orders:", err);
        if (isMounted) setOrdersError("We could not load your orders. Please try again.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchOrders();

    return () => {
      isMounted = false;
    };
  }, [activeEmail]);

  const filteredOrders = orders.filter((order) => {
    if (filterStatus === "all") return true;
    return (
      order.order_status === filterStatus ||
      order.payment_status === filterStatus
    );
  });

  return (
    <AccountLayout
      title="My Orders & Tracking"
      subtitle="View your complete order history, real-time shipment dispatch status, and verified payment records."
    >
      <div className="space-y-6">
        {/* Active Customer Identifier */}
        <div className="p-3 bg-[#F5F4F0] border border-[#E5E5E5] flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
          <div>
            Showing orders linked to account: <strong className="text-[#111111]">{activeEmail}</strong>
          </div>
          <span className="text-[10px] uppercase font-mono text-[#858585]">
            Verified SQL Database Records
          </span>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2 pb-2">
          {[
            { label: "All Orders", value: "all" },
            { label: "Paid", value: "paid" },
            { label: "Advance Paid", value: "partially_paid" },
            { label: "Pending", value: "pending_payment" },
            { label: "Shipped", value: "shipped" },
            { label: "Delivered", value: "delivered" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilterStatus(tab.value)}
              className={`px-3.5 py-1.5 text-xs uppercase font-bold tracking-wider transition-colors ${
                filterStatus === tab.value
                  ? "bg-[#111111] text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Loading Spinner */}
        {isLoading ? (
          <div className="p-12 text-center border border-[#E5E5E5] bg-white">
            <Loader2 className="w-8 h-8 text-[#FFB900] animate-spin mx-auto mb-3" />
            <p className="text-xs uppercase tracking-wider font-bold text-[#858585]">
              Loading verified customer orders...
            </p>
          </div>
        ) : ordersError ? (
          <div role="alert" className="p-8 text-center border border-red-200 bg-red-50 text-sm text-red-800">
            {ordersError}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-[#E5E5E5] bg-white">
            <Package className="w-10 h-10 text-[#858585] mx-auto mb-3" />
            <p className="text-xs uppercase tracking-wider font-bold text-[#111111]">
              No orders found for this status.
            </p>
            <p className="text-xs text-[#858585] mt-1">
              Place a test order from checkout to view real-time records here.
            </p>
            <div className="mt-4">
              <Link
                href="/shop"
                className="btn-morph btn-yellow px-5 py-2.5 text-xs uppercase tracking-wider font-black inline-flex items-center gap-1.5"
              >
                <span>Explore Designs</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const verifiedAdvance = order.payment_attempts?.find((attempt) => attempt.purpose === "cod_advance" && attempt.payment_state === "captured");
              const isPaid = hasRequiredOrderPayment(order.payment_method || "", order.payment_status, Boolean(verifiedAdvance));
              return (
                <div
                  key={order.id}
                  className="border border-[#E5E5E5] bg-white p-6 shadow-sm space-y-4"
                >
                  {/* Header row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E5E5E5] gap-2">
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-mono tracking-widest text-[#858585] font-bold">
                        {isPaid ? `Order #${order.order_number}` : `Checkout #${order.order_number}`}
                      </span>
                      <p className="text-xs text-[#858585] font-medium">
                        {isPaid ? "Placed on " : "Checkout started on "}{" "}
                        {new Date(order.created_at).toLocaleDateString("en-IN", {
                          dateStyle: "medium",
                        })}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider ${
                          isPaid
                            ? "bg-[#079447]/10 text-[#079447] border border-[#079447]/30"
                            : "bg-amber-100 text-amber-800 border border-amber-200"
                        }`}
                      >
                        {order.payment_status === "partially_paid" && verifiedAdvance
                          ? `₹${verifiedAdvance.amount_paisa / 100} ADVANCE PAID`
                          : isPaid ? "PAID" : "PENDING PAYMENT"}
                      </span>
                      <StatusBadge status={(isPaid ? order.order_status : "pending_payment") as OrderStatus} />
                      <span className="text-xs font-black text-[#111111]">
                        {formatINR(order.total)}
                      </span>
                    </div>
                  </div>

                  {/* Items in Order */}
                  <div className="divide-y divide-[#E5E5E5]">
                    {order.items.map((item) => (
                      <div key={item.id} className="py-3 flex gap-4 items-center">
                        <div className="relative w-14 h-18 bg-[#F5F4F0] shrink-0 overflow-hidden">
                          <Image
                            src={item.image}
                            alt={item.product_name}
                            fill
                            className="object-cover object-top"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link
                            href={item.customization ? "/wear-your-mood" : `/products/${item.product_slug}`}
                            className="text-xs font-bold uppercase tracking-tight text-[#111111] hover:underline truncate block"
                          >
                            {item.product_name}
                          </Link>
                          <p className="text-[11px] text-[#858585] mt-0.5">
                            Size: {item.size} • Color: {item.color} • Qty: {item.quantity} ({formatINR(item.price)} each)
                          </p>
                          {item.customization && <p className="mt-1 text-[11px] text-[#0876A8]">“{item.customization.quote}” · {item.customization.mood} · {item.customization.quoteStyle} · {item.customization.font} · {item.customization.printColor} · {item.customization.placement} · {item.fulfillment_type === "made_to_order" ? "Made to order" : ""}</p>}
                          {order.order_status === "delivered" && /^rnl-design-0[1-8]$/.test(item.product_id) && <OrderReviewForm productId={item.product_id} orderItemId={item.id} />}
                        </div>
                        <span className="text-xs font-semibold text-[#111111]">
                          {formatINR(item.price * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {verifiedAdvance && <p className="text-xs font-semibold text-[#079447]">COD Advance verified: {formatINR(verifiedAdvance.amount_paisa / 100)} · Balance due on delivery: {formatINR(order.total - verifiedAdvance.amount_paisa / 100)}</p>}

                  {/* Footer actions */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-between text-xs gap-3">
                    <span className="text-[11px] text-[#858585] flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-[#079447]" />
                      Express Air Courier dispatch within 24 hours
                    </span>

                    <Link
                      href={`/account/orders/${order.id}`}
                      className="text-xs uppercase font-bold tracking-wider text-[#0876A8] hover:text-[#111111] flex items-center gap-1"
                    >
                      <span>View Full Order Details</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AccountLayout>
  );
}

export default function AccountOrdersPage() {
  return (
    <Suspense
      fallback={
        <AccountLayout
          title="My Orders & Tracking"
          subtitle="Loading your order history..."
        >
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#111111] mb-4" />
            <p className="text-xs uppercase font-mono tracking-widest text-[#858585]">
              Loading orders...
            </p>
          </div>
        </AccountLayout>
      }
    >
      <OrdersContent />
    </Suspense>
  );
}
