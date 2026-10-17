"use client";

import React, { useEffect, useRef, useState } from "react";
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
  const drawerRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);

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

  useEffect(() => {
    if (isDrawerOpen) {
      setIsMounted(true);
      return;
    }
    const timeout = window.setTimeout(() => setIsMounted(false), 240);
    return () => window.clearTimeout(timeout);
  }, [isDrawerOpen]);

  useEffect(() => {
    if (!isDrawerOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const focusDrawer = () => drawerRef.current?.querySelector<HTMLElement>("button, a, input")?.focus();
    const frame = window.requestAnimationFrame(focusDrawer);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDrawer();
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])"),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [isDrawerOpen, closeDrawer]);

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (promoInput.trim()) {
      applyCoupon(promoInput);
      setPromoInput("");
    }
  };

  if (!isMounted) return null;

  const freeShippingThreshold = 1499;
  const progressToFreeShipping = Math.min(100, Math.round((subtotal / freeShippingThreshold) * 100));
  const amountRemainingForFreeShipping = Math.max(0, freeShippingThreshold - subtotal);

  return (
    <div className={`fixed inset-0 z-50 overflow-hidden transition-opacity duration-200 ${isDrawerOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close shopping bag"
        className="fixed inset-0 border-0 bg-black/50 p-0 backdrop-blur-[1px]"
        onClick={closeDrawer}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cart-drawer-title"
          tabIndex={-1}
          className={`w-screen max-w-md bg-white border-l border-neutral-200 flex flex-col transition-transform duration-200 ease-out ${isDrawerOpen ? "translate-x-0" : "translate-x-full"}`}
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-neutral-200 flex items-center justify-between bg-white">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-neutral-900" />
              <h2 id="cart-drawer-title" className="text-sm font-bold uppercase tracking-wider text-neutral-900">
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
          <div className="bg-[#F5F4F0] px-4 py-3 border-b border-[#E5E5E5] text-xs">
            {amountRemainingForFreeShipping > 0 ? (
              <p className="text-[#858585]">
                Add <span className="font-bold text-[#111111]">{formatINR(amountRemainingForFreeShipping)}</span> more for{" "}
                <span className="font-bold text-[#111111]">FREE Express Shipping</span>
              </p>
            ) : (
              <p className="font-bold text-[#079447] flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-[#079447]" />
                You unlocked FREE Express Shipping!
              </p>
            )}
            <div className="w-full h-1.5 bg-[#E5E5E5] mt-2 overflow-hidden">
              <div
                className="h-full bg-[#079447] transition-all duration-500"
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
                  className="btn-morph btn-yellow px-6 py-3 text-xs uppercase tracking-widest font-semibold inline-flex items-center gap-2"
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
                  className="btn-morph btn-yellow w-full py-3.5 text-xs uppercase tracking-widest font-bold flex items-center justify-center gap-2"
                >
                  Proceed to Checkout <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/cart"
                  onClick={closeDrawer}
                  className="w-full py-2.5 border border-[#E5E5E5] hover:border-[#111111] text-[#858585] hover:text-[#111111] text-xs uppercase tracking-widest font-bold flex items-center justify-center transition-colors"
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
