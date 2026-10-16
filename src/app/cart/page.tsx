"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ShieldCheck,
  Tag,
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
    discount,
    shipping,
    total,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    updateQuantity,
    removeFromBag,
    clearBag,
  } = useCart();

  const [couponInput, setCouponInput] = useState("");

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (couponInput.trim()) {
      applyCoupon(couponInput);
      setCouponInput("");
    }
  };

  const freeShippingThreshold = 1499;
  const progressToFreeShipping = Math.min(100, Math.round((subtotal / freeShippingThreshold) * 100));
  const amountRemainingForFreeShipping = Math.max(0, freeShippingThreshold - subtotal);

  return (
    <StoreLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumbs items={[{ label: "Your Bag" }]} />

        {/* Page Header */}
        <div className="pt-4 pb-8 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-[11px] uppercase tracking-widest font-mono text-neutral-500 font-bold block mb-1">
              CURRENT SELECTION
            </span>
            <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight font-editorial">
              YOUR BAG ({itemCount})
            </h1>
          </div>
          {items.length > 0 && (
            <button
              onClick={clearBag}
              className="text-xs text-neutral-500 hover:text-red-600 underline font-semibold uppercase tracking-wider self-start sm:self-end"
            >
              Clear Entire Bag
            </button>
          )}
        </div>

        {items.length === 0 ? (
          /* Empty Bag State */
          <div className="py-24 text-center max-w-md mx-auto">
            <div className="w-20 h-20 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 mx-auto mb-6">
              <ShoppingBag className="w-10 h-10" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight font-editorial mb-2">
              YOUR BAG IS EMPTY
            </h2>
            <p className="text-xs sm:text-sm text-neutral-500 leading-relaxed mb-8">
              Explore our latest seasonal drop, oversized heavyweight tees, and essential street basics.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/collections/new-drops"
                className="px-8 py-4 bg-[#111111] hover:bg-black text-white text-xs uppercase tracking-widest font-black transition-colors inline-flex items-center justify-center gap-2"
              >
                <span>SHOP NEW DROPS</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/shop"
                className="px-8 py-4 border border-neutral-300 hover:border-black text-neutral-800 text-xs uppercase tracking-widest font-black transition-colors inline-flex items-center justify-center"
              >
                <span>EXPLORE ALL TEES</span>
              </Link>
            </div>
          </div>
        ) : (
          /* Populated Bag Content */
          <div className="pt-8 pb-16 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            {/* Left Items Column (8 cols) */}
            <div className="lg:col-span-8 space-y-6">
              {/* Free Shipping Meter */}
              <div className="bg-[#F5F4F0] p-4 border border-neutral-200">
                <div className="flex items-center justify-between text-xs mb-2">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-black" />
                    {amountRemainingForFreeShipping > 0 ? (
                      <span className="text-neutral-700">
                        Add <strong className="text-black">{formatINR(amountRemainingForFreeShipping)}</strong> more for <strong>FREE Express Shipping</strong>
                      </span>
                    ) : (
                      <span className="font-bold text-emerald-700">
                        Unlocked! You qualify for FREE Pan-India Express Air Shipping.
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-neutral-500 text-[11px]">
                    {progressToFreeShipping}%
                  </span>
                </div>
                <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-black transition-all duration-500"
                    style={{ width: `${progressToFreeShipping}%` }}
                  />
                </div>
              </div>

              {/* Items Table / Cards */}
              <div className="border border-neutral-200 divide-y divide-neutral-200 bg-white">
                <div className="hidden sm:grid grid-cols-12 p-4 text-[11px] uppercase tracking-wider font-bold text-neutral-500 bg-neutral-50">
                  <div className="col-span-6">Garment</div>
                  <div className="col-span-2 text-center">Unit Price</div>
                  <div className="col-span-2 text-center">Quantity</div>
                  <div className="col-span-2 text-right">Subtotal</div>
                </div>

                {items.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 sm:p-5 flex flex-col sm:grid sm:grid-cols-12 sm:items-center gap-4 group"
                  >
                    {/* Product Info & Thumb */}
                    <div className="sm:col-span-6 flex gap-4">
                      <div className="relative w-20 h-26 bg-neutral-100 shrink-0 overflow-hidden">
                        <Image
                          src={item.image}
                          alt={item.productName}
                          fill
                          className="object-cover object-top"
                          sizes="80px"
                        />
                      </div>
                      <div className="min-w-0 flex-1 flex flex-col justify-between">
                        <div>
                          <Link
                            href={`/products/${item.productSlug}`}
                            className="text-xs font-bold uppercase tracking-tight text-neutral-900 hover:underline line-clamp-2"
                          >
                            {item.productName}
                          </Link>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-neutral-500">
                            <span className="font-semibold text-neutral-800">Size: {item.size}</span>
                            <span>•</span>
                            <span>{item.color}</span>
                            <span>•</span>
                            <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 bg-neutral-100">
                              {item.fit}
                            </span>
                          </div>
                          <p className="text-[10px] text-neutral-400 font-mono mt-1">
                            SKU: {item.sku}
                          </p>
                        </div>

                        <button
                          onClick={() => removeFromBag(item.id)}
                          className="text-neutral-400 hover:text-red-600 transition-colors text-xs flex items-center gap-1 mt-2 self-start"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>

                    {/* Unit Price */}
                    <div className="sm:col-span-2 text-left sm:text-center text-xs font-semibold text-neutral-700">
                      <span className="sm:hidden text-neutral-500 mr-2">Unit:</span>
                      {formatINR(item.price)}
                    </div>

                    {/* Quantity Stepper */}
                    <div className="sm:col-span-2 flex items-center justify-start sm:justify-center">
                      <div className="flex items-center border border-neutral-300">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="px-2.5 py-1 text-xs hover:bg-neutral-100 text-neutral-700"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center text-xs font-bold">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="px-2.5 py-1 text-xs hover:bg-neutral-100 text-neutral-700"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Subtotal */}
                    <div className="sm:col-span-2 text-left sm:text-right text-xs font-bold text-neutral-900">
                      <span className="sm:hidden text-neutral-500 mr-2">Item Total:</span>
                      {formatINR(item.price * item.quantity)}
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

                {/* Promo Coupon Form */}
                {appliedCoupon ? (
                  <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Promo <strong>{appliedCoupon}</strong> Applied (-{formatINR(discount)})
                      </span>
                    </div>
                    <button
                      onClick={removeCoupon}
                      className="text-emerald-700 underline font-semibold hover:text-black ml-2"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyCoupon} className="space-y-1.5">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value)}
                        placeholder="ENTER PROMO CODE (e.g. DROP20)"
                        className="flex-1 px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none uppercase font-mono"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-wider font-bold"
                      >
                        Apply
                      </button>
                    </div>
                    <p className="text-[10px] text-neutral-500">
                      Try <strong>DROP20</strong> for 20% off or <strong>RNLFIRST</strong> for ₹200 off.
                    </p>
                  </form>
                )}

                {/* Calculation Breakdown */}
                <div className="space-y-2 text-xs text-neutral-600 pt-2 border-t border-neutral-100">
                  <div className="flex justify-between">
                    <span>Bag Subtotal</span>
                    <span className="font-semibold text-black">{formatINR(subtotal)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-medium">
                      <span>Promotional Discount</span>
                      <span>-{formatINR(discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Estimated Shipping</span>
                    <span className="font-semibold text-black">
                      {shipping === 0 ? "FREE" : formatINR(shipping)}
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
                  <span>Razorpay Secure Protocol Preview</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </StoreLayout>
  );
}
