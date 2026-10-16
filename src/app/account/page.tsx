"use client";

import React from "react";
import Link from "next/link";
import { Package, MapPin, Heart, ArrowRight, ShieldCheck, Clock } from "lucide-react";
import { AccountLayout } from "@/components/layout/AccountLayout";
import { useAuth } from "@/context/auth-context";
import { useWishlist } from "@/context/wishlist-context";
import { DEMO_ORDERS } from "@/data/mock-data";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatINR } from "@/lib/utils";

export default function AccountOverviewPage() {
  const { user } = useAuth();
  const { itemCount: wishlistCount } = useWishlist();

  const recentOrder = DEMO_ORDERS[0];
  const defaultAddress = user?.addresses.find((a) => a.isDefault) || user?.addresses[0];

  return (
    <AccountLayout
      title="Overview"
      subtitle="Welcome back. Review your recent orders, shipment timelines, and delivery addresses."
    >
      <div className="space-y-8">
        {/* Metric Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/account/orders"
            className="p-5 border border-neutral-200 bg-white hover:border-black transition-colors shadow-sm group"
          >
            <div className="flex items-center justify-between text-neutral-400 group-hover:text-black">
              <Package className="w-5 h-5" />
              <ArrowRight className="w-4 h-4" />
            </div>
            <p className="text-2xl font-black text-black mt-3 font-mono">
              {DEMO_ORDERS.length}
            </p>
            <p className="text-xs uppercase tracking-wider font-bold text-neutral-600 mt-0.5">
              Orders Placed
            </p>
          </Link>

          <Link
            href="/account/addresses"
            className="p-5 border border-neutral-200 bg-white hover:border-black transition-colors shadow-sm group"
          >
            <div className="flex items-center justify-between text-neutral-400 group-hover:text-black">
              <MapPin className="w-5 h-5" />
              <ArrowRight className="w-4 h-4" />
            </div>
            <p className="text-2xl font-black text-black mt-3 font-mono">
              {user?.addresses.length || 0}
            </p>
            <p className="text-xs uppercase tracking-wider font-bold text-neutral-600 mt-0.5">
              Saved Addresses
            </p>
          </Link>

          <Link
            href="/account/wishlist"
            className="p-5 border border-neutral-200 bg-white hover:border-black transition-colors shadow-sm group"
          >
            <div className="flex items-center justify-between text-neutral-400 group-hover:text-black">
              <Heart className="w-5 h-5" />
              <ArrowRight className="w-4 h-4" />
            </div>
            <p className="text-2xl font-black text-black mt-3 font-mono">{wishlistCount}</p>
            <p className="text-xs uppercase tracking-wider font-bold text-neutral-600 mt-0.5">
              Wishlist Items
            </p>
          </Link>
        </div>

        {/* Most Recent Order with Tracking Preview */}
        {recentOrder && (
          <div className="border border-neutral-200 bg-white p-6 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-neutral-200">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-500 font-bold">
                  LATEST SHIPMENT
                </span>
                <h3 className="text-base font-bold uppercase tracking-wider text-black">
                  Order #{recentOrder.orderNumber}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={recentOrder.orderStatus} />
                <Link
                  href={`/account/orders/${recentOrder.id}`}
                  className="text-xs uppercase tracking-wider font-bold text-black underline ml-2"
                >
                  Track Shipment &rarr;
                </Link>
              </div>
            </div>

            {/* Tracking Timeline Bar */}
            <div className="p-4 bg-[#F5F4F0] border border-neutral-200 text-xs">
              <div className="flex items-center justify-between text-neutral-700 mb-2 font-semibold">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-black" />
                  Air Express Dispatch via {recentOrder.trackingNumber.split("-")[0]}
                </span>
                <span className="font-mono text-neutral-500">{recentOrder.trackingNumber}</span>
              </div>
              <div className="grid grid-cols-4 gap-2 pt-2">
                {recentOrder.timeline.slice(0, 4).map((step, idx) => (
                  <div key={idx} className="space-y-1">
                    <div
                      className={`h-1.5 rounded-full ${
                        step.completed ? "bg-black" : "bg-neutral-300"
                      }`}
                    />
                    <p className="text-[10px] uppercase font-bold truncate text-neutral-800">
                      {step.title}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Items inside recent order */}
            <div className="space-y-2 pt-1">
              <p className="text-xs uppercase font-bold tracking-wider text-neutral-500">
                Garments in this shipment:
              </p>
              {recentOrder.items.map((item) => (
                <div key={item.id} className="flex justify-between items-center text-xs py-1">
                  <span className="font-bold text-black uppercase truncate">
                    {item.productName} ({item.size} / {item.color})
                  </span>
                  <span className="font-semibold text-neutral-700">
                    {formatINR(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Default Shipping Address */}
        {defaultAddress && (
          <div className="border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-black">
                Primary Delivery Address
              </h3>
              <Link
                href="/account/addresses"
                className="text-xs uppercase font-bold text-neutral-600 hover:text-black underline"
              >
                Manage Addresses
              </Link>
            </div>
            <div className="pt-3 text-xs space-y-1 text-neutral-700">
              <p className="font-bold text-black">{defaultAddress.fullName} • {defaultAddress.phone}</p>
              <p>{defaultAddress.addressLine1}</p>
              {defaultAddress.addressLine2 && <p>{defaultAddress.addressLine2}</p>}
              <p>{defaultAddress.city}, {defaultAddress.state} – {defaultAddress.pinCode}</p>
            </div>
          </div>
        )}
      </div>
    </AccountLayout>
  );
}
