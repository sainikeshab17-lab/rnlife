"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { X, Plus, Minus, ShoppingBag, ArrowRight } from "lucide-react";
import { useCart } from "@/context/cart-context";
import { formatINR } from "@/lib/utils";

export function CartDrawer() {
  const {
    items,
    itemCount,
    subtotal,
    shipping,
    total,
    isDrawerOpen,
    closeDrawer,
    updateQuantity,
    removeFromBag,
  } = useCart();

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

  if (!isMounted) return null;

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-300 ${
        isDrawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
      aria-hidden={!isDrawerOpen}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={closeDrawer}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        tabIndex={-1}
        className={`fixed top-0 right-0 bottom-0 w-full max-w-md bg-white shadow-2xl flex flex-col z-10 transform transition-transform duration-300 ease-in-out ${
          isDrawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-neutral-200">
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

        {/* Free Shipping Notice */}
        <div className="bg-[#FFFFFF] px-4 py-3 border-b border-[#E5E5E5] text-xs">
          <p className="font-bold text-[#079447] flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-[#079447]" />
            FREE Express Air Shipping on all orders (₹0)
          </p>
        </div>

        {/* Bag Items list */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 divide-y divide-neutral-100">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-16 px-4">
              <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 mb-4">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <p className="text-sm font-bold uppercase tracking-wide text-neutral-900 mb-1">
                Your bag is empty
              </p>
              <p className="text-xs text-neutral-500 mb-6 max-w-xs">
                Explore our heavyweight graphic tees priced at ₹999.
              </p>
              <Link
                href="/shop"
                onClick={closeDrawer}
                className="btn-morph btn-yellow px-6 py-2.5 text-xs uppercase tracking-wider font-bold inline-flex items-center gap-1.5"
              >
                <span>Shop All Tees</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="py-4 flex gap-3 sm:gap-4 first:pt-0">
                <div className="relative w-20 h-24 bg-neutral-100 shrink-0 border border-neutral-200 overflow-hidden">
                  <Image
                    src={item.image}
                    alt={item.productName}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </div>

                <div className="flex-1 flex flex-col justify-between min-w-0">
                  <div>
                    <div className="flex justify-between items-start gap-2">
                      <Link
                        href={item.customization ? "/wear-your-mood" : `/products/${item.productSlug}`}
                        onClick={closeDrawer}
                        className="text-xs font-bold text-neutral-900 hover:underline uppercase truncate block"
                      >
                        {item.productName}
                      </Link>
                      <button
                        onClick={() => removeFromBag(item.id)}
                        className="text-neutral-400 hover:text-red-600 transition-colors"
                        aria-label="Remove item"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      {item.size} / {item.color}
                    </p>
                    {item.customization && <p className="mt-1 text-[11px] text-neutral-600">“{item.customization.quote}” · {item.customization.font} · {item.customization.printColor} · {item.customization.placement}</p>}
                    <p className="text-[11px] font-mono text-neutral-400">
                      ₹{item.customization ? "1,999" : "999"} each
                    </p>
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center border border-neutral-300">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="p-1 hover:bg-neutral-100 text-neutral-600 transition-colors"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center text-xs font-bold font-mono">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="p-1 hover:bg-neutral-100 text-neutral-600 transition-colors"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <p className="text-xs font-bold text-neutral-900">
                      {formatINR((item.customization ? 1999 : 999) * item.quantity)}
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
            {/* Price Breakdown */}
            <div className="space-y-1.5 text-xs text-neutral-600 pt-1">
              <div className="flex justify-between">
                <span>Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"})</span>
                <span className="font-semibold text-neutral-900">{formatINR(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Express Air Shipping</span>
                <span className="font-semibold text-[#079447]">
                  FREE (₹0)
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold text-neutral-900 pt-2 border-t border-neutral-200">
                <span>Total (Incl. all taxes)</span>
                <span>{formatINR(total)}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <Link
                href="/checkout"
                onClick={closeDrawer}
                className="w-full btn-morph btn-yellow py-3 text-xs uppercase tracking-widest font-black flex items-center justify-center gap-2 shadow-sm text-center"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/cart"
                onClick={closeDrawer}
                className="w-full block py-2.5 text-center text-xs uppercase tracking-wider font-bold text-neutral-600 hover:text-black border border-neutral-200 hover:bg-neutral-50 transition-colors"
              >
                View Bag & Order Summary
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
