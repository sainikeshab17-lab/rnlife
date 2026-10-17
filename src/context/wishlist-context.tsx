"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { WishlistItem } from "@/types";
import { useToast } from "./toast-context";

interface WishlistContextType {
  items: WishlistItem[];
  itemCount: number;
  isInWishlist: (productId: string) => boolean;
  toggleWishlist: (item: WishlistItem) => void;
  removeFromWishlist: (productId: string) => void;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

const WISHLIST_STORAGE_KEY = "rnl_wishlist_items_v2";

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(WISHLIST_STORAGE_KEY);
      if (stored) {
        setItems(JSON.parse(stored));
      } else {
        // Sample item from actual catalogue
        setItems([
          {
            productId: "rnl-design-02",
            productSlug: "rightnowlife-design-02",
            productName: "RIGHTNOWLIFE Design 02",
            price: 999,
            image: "/products/tshirt_product_images_high_quality/design_02_01_front_view.jpg",
            fit: "Regular",
            color: "As pictured",
          },
        ]);
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore
    }
  }, [items]);

  const isInWishlist = useCallback(
    (productId: string) => {
      return items.some((i) => i.productId === productId);
    },
    [items]
  );

  const toggleWishlist = useCallback(
    (item: WishlistItem) => {
      setItems((prev) => {
        const exists = prev.some((i) => i.productId === item.productId);
        if (exists) {
          toast({
            type: "info",
            title: "Removed from Wishlist",
            message: item.productName,
          });
          return prev.filter((i) => i.productId !== item.productId);
        } else {
          toast({
            type: "success",
            title: "Saved to Wishlist",
            message: item.productName,
          });
          return [...prev, item];
        }
      });
    },
    [toast]
  );

  const removeFromWishlist = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  return (
    <WishlistContext.Provider
      value={{
        items,
        itemCount: items.length,
        isInWishlist,
        toggleWishlist,
        removeFromWishlist,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
}
