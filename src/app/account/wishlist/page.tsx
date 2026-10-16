"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import { AccountLayout } from "@/components/layout/AccountLayout";
import { useWishlist } from "@/context/wishlist-context";
import { useCart } from "@/context/cart-context";
import { formatINR } from "@/lib/utils";

export default function AccountWishlistPage() {
  const { items, removeFromWishlist } = useWishlist();
  const { addToBag } = useCart();

  return (
    <AccountLayout
      title="Saved Wishlist"
      subtitle="Your curated list of favorite silhouettes, graphic prints, and upcoming drops."
    >
      {items.length === 0 ? (
        <div className="p-16 text-center border border-dashed border-neutral-200 bg-white">
          <Heart className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-black">
            Your wishlist is empty
          </h2>
          <p className="text-xs text-neutral-500 mt-1 max-w-xs mx-auto mb-6">
            Tap the heart icon on any T-shirt card across our drops to save it for later.
          </p>
          <Link
            href="/shop"
            className="px-6 py-3 bg-black text-white text-xs uppercase tracking-widest font-black inline-flex items-center gap-2"
          >
            <span>Explore All Tees</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {items.map((item) => (
            <div
              key={item.productId}
              className="border border-neutral-200 bg-white group flex flex-col justify-between"
            >
              <div className="relative aspect-[3/4] bg-neutral-100 overflow-hidden">
                <Link href={`/products/${item.productSlug}`} className="block w-full h-full">
                  <Image
                    src={item.image}
                    alt={item.productName}
                    fill
                    className="object-cover object-top group-hover:scale-105 transition-transform duration-500"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                </Link>

                <button
                  onClick={() => removeFromWishlist(item.productId)}
                  className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-neutral-600 hover:text-red-600 flex items-center justify-center shadow-sm"
                  aria-label="Remove item from wishlist"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 flex flex-col gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                  {item.fit} FIT
                </span>
                <Link
                  href={`/products/${item.productSlug}`}
                  className="text-xs font-bold uppercase tracking-tight text-neutral-900 hover:underline truncate"
                >
                  {item.productName}
                </Link>
                <p className="text-xs font-black text-black">{formatINR(item.price)}</p>

                <div className="pt-2">
                  <button
                    onClick={() => {
                      addToBag({
                        productId: item.productId,
                        productSlug: item.productSlug,
                        productName: item.productName,
                        color: item.color,
                        size: "L", // Standard default
                        price: item.price,
                        image: item.image,
                        fit: item.fit,
                        quantity: 1,
                      });
                    }}
                    className="w-full py-2.5 bg-neutral-900 hover:bg-black text-white text-[11px] uppercase tracking-widest font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Quick Add (Size L)</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AccountLayout>
  );
}
