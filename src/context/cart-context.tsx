"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { CartItem, TShirtSize, TShirtFit } from "@/types";
import { useToast } from "./toast-context";

interface CartContextType {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  couponCode: string;
  appliedCoupon: string | null;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  addToBag: (item: {
    productId: string;
    productSlug: string;
    productName: string;
    color: string;
    size: TShirtSize;
    price: number;
    image: string;
    fit: TShirtFit;
    quantity?: number;
  }) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  removeFromBag: (itemId: string) => void;
  applyCoupon: (code: string) => boolean;
  removeCoupon: () => void;
  clearBag: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "rnl_bag_items_v2";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const { toast } = useToast();

  // Load from LocalStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        setItems(JSON.parse(stored));
      } else {
        // Pre-populate with 1 realistic initial product from the actual catalogue
        const initialItem: CartItem = {
          id: "rnl-init-1",
          productId: "rnl-design-01",
          productSlug: "rightnowlife-design-01",
          productName: "DESIGN 01 — GRAPHIC RAGLAN TEE",
          color: "As pictured",
          size: "L",
          price: 999,
          image: "/products/design_01_front.png",
          quantity: 1,
          fit: "Regular",
          sku: "RNL-DESIGN-01-L",
        };
        setItems([initialItem]);
      }
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }, []);

  // Sync to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore storage errors
    }
  }, [items]);

  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);

  const addToBag = useCallback(
    (product: {
      productId: string;
      productSlug: string;
      productName: string;
      color: string;
      size: TShirtSize;
      price: number;
      image: string;
      fit: TShirtFit;
      quantity?: number;
    }) => {
      const qty = product.quantity || 1;
      const sku = `${product.productId}-${product.color.toUpperCase().replace(/\s+/g, "")}-${product.size}`;

      setItems((prev) => {
        const existingIdx = prev.findIndex(
          (i) => i.productId === product.productId && i.color === product.color && i.size === product.size
        );

        if (existingIdx > -1) {
          const updated = [...prev];
          updated[existingIdx].quantity += qty;
          return updated;
        }

        const newItem: CartItem = {
          id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          productId: product.productId,
          productSlug: product.productSlug,
          productName: product.productName,
          color: product.color,
          size: product.size,
          price: product.price,
          image: product.image,
          fit: product.fit,
          quantity: qty,
          sku,
        };
        return [...prev, newItem];
      });

      toast({
        type: "success",
        title: "Added to Bag",
        message: `${product.productName} (${product.size} / ${product.color})`,
      });

      setIsDrawerOpen(true);
    },
    [toast]
  );

  const updateQuantity = useCallback((itemId: string, qty: number) => {
    if (qty <= 0) {
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } else {
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, quantity: Math.min(qty, 10) } : i))
      );
    }
  }, []);

  const removeFromBag = useCallback(
    (itemId: string) => {
      setItems((prev) => {
        const target = prev.find((i) => i.id === itemId);
        if (target) {
          toast({
            type: "info",
            title: "Removed from Bag",
            message: target.productName,
          });
        }
        return prev.filter((i) => i.id !== itemId);
      });
    },
    [toast]
  );

  const applyCoupon = useCallback(
    (code: string): boolean => {
      const trimmed = code.trim().toUpperCase();
      if (trimmed === "DROP20" || trimmed === "RNLFIRST") {
        setAppliedCoupon(trimmed);
        toast({
          type: "success",
          title: "Promo Code Applied",
          message: trimmed === "DROP20" ? "20% Discount applied to your bag" : "₹200 Discount applied",
        });
        return true;
      } else {
        toast({
          type: "error",
          title: "Invalid Code",
          message: "Please try DROP20 or RNLFIRST",
        });
        return false;
      }
    },
    [toast]
  );

  const removeCoupon = useCallback(() => {
    setAppliedCoupon(null);
    setCouponCode("");
  }, []);

  const clearBag = useCallback(() => {
    setItems([]);
  }, []);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Discount calculation
  let discount = 0;
  if (appliedCoupon === "DROP20") {
    discount = Math.round(subtotal * 0.2);
  } else if (appliedCoupon === "RNLFIRST") {
    discount = Math.min(200, subtotal);
  }

  // Shipping policy: Free for orders over ₹1,499, else ₹99
  const shipping = subtotal > 1499 || items.length === 0 ? 0 : 99;
  const total = Math.max(0, subtotal - discount + shipping);

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        subtotal,
        discount,
        shipping,
        total,
        couponCode,
        appliedCoupon,
        isDrawerOpen,
        openDrawer,
        closeDrawer,
        addToBag,
        updateQuantity,
        removeFromBag,
        applyCoupon,
        removeCoupon,
        clearBag,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
