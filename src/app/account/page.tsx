"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Heart, Loader2, MapPin, Package } from "lucide-react";
import { AccountLayout } from "@/components/layout/AccountLayout";
import { useAuth } from "@/context/auth-context";
import { useWishlist } from "@/context/wishlist-context";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatINR } from "@/lib/utils";

interface RecentOrder {
  id: string;
  order_number: string;
  order_status: string;
  total: number;
  items: Array<{ id: string; product_name: string; size: string; quantity: number; price: number }>;
}

export default function AccountOverviewPage() {
  const { user } = useAuth();
  const { itemCount: wishlistCount } = useWishlist();
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [ordersLoadError, setOrdersLoadError] = useState<string | null>(null);
  const defaultAddress = user?.addresses.find((address) => address.isDefault) || user?.addresses[0];

  useEffect(() => {
    let isMounted = true;

    async function loadOrders() {
      if (!user?.email) {
        setOrders([]);
        setOrdersLoadError("Sign in to view your orders.");
        setIsLoadingOrders(false);
        return;
      }

      setIsLoadingOrders(true);
      setOrdersLoadError(null);
      try {
        const response = await fetch("/api/orders", {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Unable to load your orders.");
        const result = await response.json();
        if (isMounted) setOrders(Array.isArray(result.orders) ? result.orders : []);
      } catch (error) {
        console.error("Failed to load account overview orders:", error);
        if (isMounted) {
          setOrders([]);
          setOrdersLoadError("We could not load your orders. Please try again.");
        }
      } finally {
        if (isMounted) setIsLoadingOrders(false);
      }
    }

    void loadOrders();
    return () => { isMounted = false; };
  }, [user?.email]);

  const recentOrder = orders[0];

  return (
    <AccountLayout
      title="Overview"
      subtitle="Welcome back. Review your recent orders, shipment timelines, and delivery addresses."
    >
      <div className="space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link href="/account/orders" className="p-5 border border-neutral-200 bg-white hover:border-black transition-colors shadow-sm group">
            <div className="flex items-center justify-between text-neutral-400 group-hover:text-black"><Package className="w-5 h-5" /><ArrowRight className="w-4 h-4" /></div>
            <p className="text-2xl font-black text-black mt-3 font-mono">{isLoadingOrders || ordersLoadError ? "—" : orders.length}</p>
            <p className="text-xs uppercase tracking-wider font-bold text-neutral-600 mt-0.5">Orders Placed</p>
          </Link>
          <Link href="/account/addresses" className="p-5 border border-neutral-200 bg-white hover:border-black transition-colors shadow-sm group">
            <div className="flex items-center justify-between text-neutral-400 group-hover:text-black"><MapPin className="w-5 h-5" /><ArrowRight className="w-4 h-4" /></div>
            <p className="text-2xl font-black text-black mt-3 font-mono">{user?.addresses.length || 0}</p>
            <p className="text-xs uppercase tracking-wider font-bold text-neutral-600 mt-0.5">Saved Addresses</p>
          </Link>
          <Link href="/account/wishlist" className="p-5 border border-neutral-200 bg-white hover:border-black transition-colors shadow-sm group">
            <div className="flex items-center justify-between text-neutral-400 group-hover:text-black"><Heart className="w-5 h-5" /><ArrowRight className="w-4 h-4" /></div>
            <p className="text-2xl font-black text-black mt-3 font-mono">{wishlistCount}</p>
            <p className="text-xs uppercase tracking-wider font-bold text-neutral-600 mt-0.5">Wishlist Items</p>
          </Link>
        </div>

        {isLoadingOrders ? (
          <div className="border border-neutral-200 bg-white p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" aria-label="Loading orders" /></div>
        ) : ordersLoadError ? (
          <div role="alert" className="border border-red-200 bg-red-50 p-6 text-center text-sm text-red-800">{ordersLoadError}</div>
        ) : recentOrder ? (
          <div className="border border-neutral-200 bg-white p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-neutral-200">
              <div><span className="text-[10px] uppercase font-mono tracking-widest text-neutral-500 font-bold">LATEST ORDER</span><h3 className="text-base font-bold uppercase tracking-wider text-black">Order #{recentOrder.order_number}</h3></div>
              <div className="flex items-center gap-3"><StatusBadge status={recentOrder.order_status as never} /><Link href="/account/orders" className="text-xs uppercase tracking-wider font-bold text-black underline">All orders →</Link></div>
            </div>
            <div className="space-y-2">
              {recentOrder.items.map((item) => (
                <div key={item.id} className="flex justify-between items-center text-xs py-1 gap-3">
                  <span className="font-bold text-black uppercase truncate">{item.product_name} ({item.size}) × {item.quantity}</span>
                  <span className="font-semibold text-neutral-700">{formatINR(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="text-right text-sm font-black">Order total: {formatINR(recentOrder.total)}</div>
          </div>
        ) : (
          <div className="border border-dashed border-neutral-200 bg-white p-8 text-center text-sm text-neutral-600">No orders yet. Your orders will appear here.</div>
        )}

        {defaultAddress && (
          <div className="border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200"><h3 className="text-xs font-bold uppercase tracking-wider text-black">Primary Delivery Address</h3><Link href="/account/addresses" className="text-xs uppercase font-bold text-neutral-600 hover:text-black underline">Manage Addresses</Link></div>
            <div className="pt-3 text-xs space-y-1 text-neutral-700"><p className="font-bold text-black">{defaultAddress.fullName} • {defaultAddress.phone}</p><p>{defaultAddress.addressLine1}</p>{defaultAddress.addressLine2 && <p>{defaultAddress.addressLine2}</p>}<p>{defaultAddress.city}, {defaultAddress.state} – {defaultAddress.pinCode}</p></div>
          </div>
        )}
      </div>
    </AccountLayout>
  );
}
