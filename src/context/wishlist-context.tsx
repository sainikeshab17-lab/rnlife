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

const WISHLIST_STORAGE_KEY = "rnl_wishlist_items_v1";

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(WISHLIST_STORAGE_KEY);
      if (stored) {
        setItems(JSON.parse(stored));
      } else {
        // Sample item
        setItems([
          {
            productId: "prod-2",
            productSlug: "metropolis-archive-boxy-tee",
            productName: "METROPOLIS ARCHIVE BOXY TEE",
            price: 1599,
            image:
              "https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=600&q=80",
            fit: "Oversized",
            color: "Acid Washed Charcoal",
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
