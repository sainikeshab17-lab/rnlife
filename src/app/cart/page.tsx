"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ShieldCheck,
  ArrowLeft,
  Truck,
} from "lucide-react";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { useCart } from "@/context/cart-context";
import { formatINR } from "@/lib/utils";

export default function CartPage() {
  const {
    items,
    itemCount,
    subtotal,
    shipping,
    total,
    updateQuantity,
    removeFromBag,
    clearBag,
  } = useCart();

  return (
    <StoreLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumbs items={[{ label: "Bag" }]} />

        <div className="flex items-center justify-between pb-6 border-b border-neutral-200 mb-8">
          <div>
            <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight font-editorial">
              YOUR BAG ({itemCount})
            </h1>
            <p className="text-xs text-neutral-500 mt-1">
              Graphic tees are ₹999; custom quote tees are ₹1,999. Complimentary express air shipping on all orders.
            </p>
          </div>

          {items.length > 0 && (
            <button
              onClick={clearBag}
              className="text-xs text-neutral-500 hover:text-red-600 transition-colors uppercase tracking-wider font-semibold"
            >
              Clear Bag
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="py-20 text-center max-w-md mx-auto">
            <div className="w-20 h-20 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 mx-auto mb-4">
              <ShoppingBag className="w-10 h-10" />
            </div>
            <h2 className="text-lg font-bold uppercase tracking-wider text-black mb-1">
              Your bag is empty
            </h2>
            <p className="text-xs text-neutral-500 mb-8 leading-relaxed">
              Find your design from our curated collection of heavyweight graphic raglan tees.
            </p>
            <Link
              href="/shop"
              className="btn-morph btn-yellow px-8 py-3.5 text-xs uppercase tracking-widest font-black inline-flex items-center gap-2"
            >
              <span>Explore All Tees</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* Left Items Column (8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              {/* Free Express Shipping Banner */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-3">
                <Truck className="w-5 h-5 text-emerald-700 shrink-0" />
                <p>
                  <strong>FREE Express Air Shipping</strong> applies to your order. Delivery in 2–4 business days across India.
                </p>
              </div>

              {/* Items Table */}
              <div className="border border-neutral-200 divide-y divide-neutral-200 bg-white shadow-sm">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:gap-6 items-start sm:items-center justify-between"
                  >
                    <div className="flex gap-4 items-center">
                      <div className="relative w-20 h-24 sm:w-24 sm:h-28 bg-neutral-100 shrink-0 border border-neutral-200 overflow-hidden">
                        <Image
                          src={item.image}
                          alt={item.productName}
                          fill
                          sizes="96px"
                          className="object-cover"
                        />
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 font-bold">
                          {item.fit} FIT
                        </span>
                        <Link
                          href={`/products/${item.productSlug}`}
                          className="text-sm font-bold text-black uppercase hover:underline block"
                        >
                          {item.productName}
                        </Link>
                        <div className="flex flex-wrap gap-2 text-xs text-neutral-600 pt-0.5">
                          <span>Size: <strong>{item.size}</strong></span>
                          <span>•</span>
                          <span>Color: <strong>{item.color}</strong></span>
                        </div>
                        <p className="text-xs font-mono font-bold text-neutral-700 pt-1">
                          ₹{item.customization ? "1,999" : "999"} per item
                        </p>
                        {item.customization && <p className="mt-1 text-xs text-neutral-600">“{item.customization.quote}” · {item.customization.font} · {item.customization.printColor} · {item.customization.placement}</p>}
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-4 pt-3 sm:pt-0 border-t sm:border-t-0 border-neutral-100">
                      <div className="flex items-center border border-neutral-300 bg-neutral-50">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="p-1.5 hover:bg-neutral-200 text-neutral-700 transition-colors"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-10 text-center text-xs font-bold font-mono">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="p-1.5 hover:bg-neutral-200 text-neutral-700 transition-colors"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="text-sm font-black font-editorial">
                          {formatINR((item.customization ? 1299 : 999) * item.quantity)}
                        </span>
                        <button
                          onClick={() => removeFromBag(item.id)}
                          className="text-neutral-400 hover:text-red-600 transition-colors"
                          title="Remove from bag"
                          aria-label="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <Link
                  href="/shop"
                  className="inline-flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-neutral-700 hover:text-black hover:underline"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Continue Shopping All Drops
                </Link>
              </div>
            </div>

            {/* Right Summary Column (4 cols) */}
            <div className="lg:col-span-4 space-y-6">
              {/* Order Summary Box */}
              <div className="border border-neutral-200 bg-white p-6 space-y-4 shadow-sm">
                <h2 className="text-sm font-bold uppercase tracking-wider text-black pb-3 border-b border-neutral-200">
                  Order Summary
                </h2>

                {/* Calculation Breakdown */}
                <div className="space-y-2 text-xs text-neutral-600 pt-2 border-t border-neutral-100">
                  <div className="flex justify-between">
                    <span>Bag Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"})</span>
                    <span className="font-semibold text-black">{formatINR(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Express Air Shipping</span>
                    <span className="font-semibold text-[#079447]">
                      FREE (₹0)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Goods & Services Tax (GST)</span>
                    <span className="font-semibold text-black">Included</span>
                  </div>
                  <div className="flex justify-between text-base font-black text-black pt-3 border-t border-neutral-200">
                    <span>Total Amount</span>
                    <span>{formatINR(total)}</span>
                  </div>
                </div>

                {/* Checkout CTA */}
                <div className="pt-2 space-y-2">
                  <Link
                    href="/checkout"
                    className="w-full py-4 bg-[#111111] hover:bg-black text-white text-xs uppercase tracking-widest font-black flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    <span>Proceed to Checkout</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>

                <div className="flex items-center justify-center gap-2 pt-2 text-[10px] text-neutral-400 uppercase tracking-wider text-center">
                  <ShieldCheck className="w-4 h-4 text-neutral-600" />
                  <span>Secure 256-bit Encrypted Checkout</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </StoreLayout>
  );
}
