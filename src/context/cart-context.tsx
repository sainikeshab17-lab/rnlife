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
  const { toast } = useToast();

  // Load from LocalStorage once on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Ensure all items strictly have price = 999
          setItems(parsed.map((item: CartItem) => ({ ...item, price: 999 })));
        }
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
      const authoritativePrice = 999; // Every T-shirt is strictly ₹999

      setItems((prev) => {
        const existingIdx = prev.findIndex(
          (i) => i.productId === product.productId && i.color === product.color && i.size === product.size
        );

        if (existingIdx > -1) {
          const updated = [...prev];
          updated[existingIdx].quantity += qty;
          updated[existingIdx].price = authoritativePrice;
          return updated;
        }

        const newItem: CartItem = {
          id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          productId: product.productId,
          productSlug: product.productSlug,
          productName: product.productName,
          color: product.color,
          size: product.size,
          price: authoritativePrice,
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
        message: `${product.productName} (${product.size} / ${product.color}) · ₹999`,
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
        prev.map((i) => (i.id === itemId ? { ...i, quantity: Math.min(qty, 10), price: 999 } : i))
      );
    }
  }, []);

  const removeFromBag = useCallback(
    (itemId: string) => {
      const target = items.find((item) => item.id === itemId);

      setItems((prev) => prev.filter((item) => item.id !== itemId));

      if (target) {
        toast({
          type: "info",
          title: "Removed from Bag",
          message: target.productName,
        });
      }
    },
    [items, toast]
  );

  // Promo code feature removed per Section 6
  const applyCoupon = useCallback((_code: string): boolean => {
    return false;
  }, []);

  const removeCoupon = useCallback(() => {}, []);

  const clearBag = useCallback(() => {
    setItems([]);
  }, []);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + 999 * item.quantity, 0);

  // Section 7 pricing rules:
  // Discount: ₹0 (Promo codes removed)
  // Shipping: ₹0 (Free shipping on all items)
  // Total: strictly ₹999 * total quantity
  const discount = 0;
  const shipping = 0;
  const total = subtotal;

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        subtotal,
        discount,
        shipping,
        total,
        couponCode: "",
        appliedCoupon: null,
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
