"use client";

import React from "react";
import { ToastProvider } from "./toast-context";
import { AuthProvider } from "./auth-context";
import { CartProvider } from "./cart-context";
import { WishlistProvider } from "./wishlist-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <CartProvider>
          <WishlistProvider>{children}</WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
