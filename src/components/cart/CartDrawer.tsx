"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { X, Trash2, Plus, Minus, ArrowRight, ShoppingBag, ShieldCheck, Tag } from "lucide-react";
import { useCart } from "@/context/cart-context";
import { formatINR } from "@/lib/utils";

export function CartDrawer() {
  const {
    items,
    itemCount,
    subtotal,
    discount,
    shipping,
    total,
    isDrawerOpen,
    closeDrawer,
    updateQuantity,
    removeFromBag,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
  } = useCart();

  const [promoInput, setPromoInput] = useState("");

  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isDrawerOpen]);

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (promoInput.trim()) {
      applyCoupon(promoInput);
      setPromoInput("");
    }
  };

  if (!isDrawerOpen) return null;

  const freeShippingThreshold = 1499;
  const progressToFreeShipping = Math.min(100, Math.round((subtotal / freeShippingThreshold) * 100));
  const amountRemainingForFreeShipping = Math.max(0, freeShippingThreshold - subtotal);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-300"
        onClick={closeDrawer}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white border-l border-neutral-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-neutral-200 flex items-center justify-between bg-white">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-neutral-900" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-900">
                Your Bag ({itemCount})
              </h2>
            </div>
            <button
              onClick={closeDrawer}
              className="p-1.5 text-neutral-400 hover:text-black transition-colors rounded-full hover:bg-neutral-100"
              aria-label="Close bag drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Free Shipping Progress Meter */}
          <div className="bg-[#F5F4F0] px-4 py-3 border-b border-neutral-200 text-xs">
            {amountRemainingForFreeShipping > 0 ? (
              <p className="text-neutral-700">
                Add <span className="font-bold text-black">{formatINR(amountRemainingForFreeShipping)}</span> more for{" "}
                <span className="font-bold text-black">FREE Express Shipping</span>
              </p>
            ) : (
              <p className="font-bold text-emerald-700 flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                You unlocked FREE Express Shipping!
              </p>
            )}
            <div className="w-full h-1.5 bg-neutral-200 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-[#111111] transition-all duration-500"
                style={{ width: `${progressToFreeShipping}%` }}
              />
            </div>
          </div>

          {/* Bag Items list */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 divide-y divide-neutral-100">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-16 px-4">
                <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 mb-4">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-900 mb-1">
                  Your bag is empty
                </h3>
                <p className="text-xs text-neutral-500 max-w-xs mb-6">
                  Explore our latest drops and heavyweight streetwear essentials designed for everyday expression.
                </p>
                <Link
                  href="/collections/new-drops"
                  onClick={closeDrawer}
                  className="px-6 py-3 bg-[#111111] text-white text-xs uppercase tracking-widest font-semibold hover:bg-black transition-colors inline-flex items-center gap-2"
                >
                  Shop New Drops <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              items.map((item) => (
                <div key={item.id} className="py-4 first:pt-0 last:pb-0 flex gap-4 group">
                  <div className="relative w-20 h-24 bg-neutral-100 shrink-0 overflow-hidden">
                    <Image
                      src={item.image}
                      alt={item.productName}
                      fill
                      className="object-cover object-top"
                      sizes="80px"
                    />
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/products/${item.productSlug}`}
                          onClick={closeDrawer}
                          className="text-xs font-bold uppercase tracking-tight text-neutral-900 hover:underline line-clamp-2"
                        >
                          {item.productName}
                        </Link>
                        <button
                          onClick={() => removeFromBag(item.id)}
                          className="text-neutral-400 hover:text-red-500 transition-colors p-1"
                          aria-label={`Remove ${item.productName}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-[11px] text-neutral-500">
                        <span className="font-semibold text-neutral-700">{item.size}</span>
                        <span>•</span>
                        <span>{item.color}</span>
                        <span>•</span>
                        <span className="text-[10px] uppercase tracking-wider px-1 bg-neutral-100">
                          {item.fit}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      {/* Quantity Stepper */}
                      <div className="flex items-center border border-neutral-300">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="p-1 hover:bg-neutral-100 text-neutral-600 transition-colors"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-7 text-center text-xs font-semibold">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="p-1 hover:bg-neutral-100 text-neutral-600 transition-colors"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <p className="text-xs font-bold text-neutral-900">
                        {formatINR(item.price * item.quantity)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Drawer Footer / Summary */}
          {items.length > 0 && (
            <div className="border-t border-neutral-200 p-4 sm:p-5 bg-white space-y-3">
              {/* Promo code form */}
              {appliedCoupon ? (
                <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-emerald-600" />
                    <span>
                      Promo Code <strong>{appliedCoupon}</strong> Applied (-{formatINR(discount)})
                    </span>
                  </div>
                  <button
                    onClick={removeCoupon}
                    className="text-xs text-emerald-700 underline font-semibold hover:text-black"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyPromo} className="flex gap-2">
                  <input
                    type="text"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value)}
                    placeholder="Promo code (e.g. DROP20)"
                    className="flex-1 px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none uppercase placeholder:normal-case font-medium"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-xs uppercase tracking-wider font-bold transition-colors"
                  >
                    Apply
                  </button>
                </form>
              )}

              {/* Price Breakdown */}
              <div className="space-y-1.5 text-xs text-neutral-600 pt-1">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold text-neutral-900">{formatINR(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount</span>
                    <span className="font-semibold">-{formatINR(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Estimated Shipping</span>
                  <span className="font-semibold text-neutral-900">
                    {shipping === 0 ? "FREE" : formatINR(shipping)}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold text-neutral-900 pt-2 border-t border-neutral-200">
                  <span>Total (Incl. all taxes)</span>
                  <span>{formatINR(total)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                <Link
                  href="/checkout"
                  onClick={closeDrawer}
                  className="w-full py-3.5 bg-[#111111] hover:bg-black text-white text-xs uppercase tracking-widest font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  Proceed to Checkout <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/cart"
                  onClick={closeDrawer}
                  className="w-full py-2.5 border border-neutral-300 hover:border-black text-neutral-800 hover:text-black text-xs uppercase tracking-widest font-bold flex items-center justify-center transition-colors"
                >
                  View Full Bag
                </Link>
              </div>

              <div className="flex items-center justify-center gap-1.5 text-[10px] text-neutral-400 uppercase tracking-wider pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-neutral-500" />
                <span>Encrypted Razorpay Checkout Preview</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
