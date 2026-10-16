"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, Plus } from "lucide-react";
import { Product, TShirtSize } from "@/types";
import { formatINR } from "@/lib/utils";
import { useWishlist } from "@/context/wishlist-context";
import { useCart } from "@/context/cart-context";

interface ProductCardProps {
  product: Product;
  priority?: boolean;
}

export function ProductCard({ product, priority = false }: ProductCardProps) {
  const [selectedColorIdx, setSelectedColorIdx] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [showQuickSizes, setShowQuickSizes] = useState(false);

  const { isInWishlist, toggleWishlist } = useWishlist();
  const { addToBag } = useCart();

  const isFavorited = isInWishlist(product.id);
  const currentColor = product.colors[selectedColorIdx] || product.colors[0];

  const primaryImage = currentColor?.images[0] || product.colors[0]?.images[0] || "";
  const hoverImage = currentColor?.images[1] || product.colors[0]?.images[1] || primaryImage;

  const handleQuickAdd = (size: TShirtSize, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToBag({
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      color: currentColor.name,
      size,
      price: product.price,
      image: primaryImage,
      fit: product.fit,
      quantity: 1,
    });
    setShowQuickSizes(false);
  };

  const discountPercent = product.compareAtPrice
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
    : 0;

  return (
    <div
      className="group relative flex flex-col bg-white"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowQuickSizes(false);
      }}
    >
      {/* Product Image Container */}
      <div className="relative aspect-[3/4] w-full bg-[#F5F4F0] overflow-hidden">
        <Link href={`/products/${product.slug}`} className="block w-full h-full">
          {/* Main front image */}
          <Image
            src={primaryImage}
            alt={product.name}
            fill
            priority={priority}
            className={`object-cover object-top transition-opacity duration-500 ${
              isHovered && hoverImage !== primaryImage ? "opacity-0" : "opacity-100"
            }`}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />

          {/* Secondary hover image */}
          {hoverImage !== primaryImage && (
            <Image
              src={hoverImage}
              alt={`${product.name} alternate view`}
              fill
              className={`object-cover object-top transition-opacity duration-500 ${
                isHovered ? "opacity-100" : "opacity-0"
              }`}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          )}
        </Link>

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 z-10 pointer-events-none">
          {product.isNewDrop && (
            <span className="bg-[#111111] text-[#B8FF3B] text-[9px] font-black uppercase tracking-widest px-2 py-0.5">
              NEW DROP
            </span>
          )}
          {discountPercent > 0 && (
            <span className="bg-white text-black border border-neutral-200 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5">
              {discountPercent}% OFF
            </span>
          )}
        </div>

        {/* Wishlist Button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleWishlist({
              productId: product.id,
              productSlug: product.slug,
              productName: product.name,
              price: product.price,
              image: primaryImage,
              fit: product.fit,
              color: currentColor.name,
            });
          }}
          className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 z-10 ${
            isFavorited
              ? "bg-black text-[#B8FF3B]"
              : "bg-white/80 hover:bg-white text-neutral-700 hover:text-black backdrop-blur-sm"
          }`}
          aria-label={isFavorited ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart className={`w-4 h-4 ${isFavorited ? "fill-[#B8FF3B]" : ""}`} />
        </button>

        {/* Quick Add Overlay / Trigger */}
        <div className="absolute inset-x-2 bottom-2 z-10 transition-all duration-200">
          {showQuickSizes ? (
            <div className="bg-white/95 backdrop-blur-md p-2 shadow-lg border border-neutral-200 animate-in fade-in duration-150">
              <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-500 mb-1.5 text-center">
                Select Size:
              </p>
              <div className="grid grid-cols-5 gap-1">
                {product.sizes.map((size) => (
                  <button
                    key={size}
                    onClick={(e) => handleQuickAdd(size, e)}
                    className="py-1.5 text-xs font-bold text-neutral-800 bg-neutral-100 hover:bg-black hover:text-white transition-colors"
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowQuickSizes(true);
              }}
              className="w-full py-2.5 bg-white/95 hover:bg-black hover:text-white text-neutral-900 text-[11px] uppercase tracking-widest font-bold shadow-md transition-all duration-200 opacity-90 group-hover:opacity-100 flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Quick Add
            </button>
          )}
        </div>
      </div>

      {/* Product Details Info */}
      <div className="pt-3 pb-2 flex flex-col gap-1.5">
        {/* Fit & GSM Indicators */}
        <div className="flex items-center justify-between text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">
          <span>{product.fit} FIT</span>
          <span>{product.gsm} GSM</span>
        </div>

        {/* Product Title */}
        <Link
          href={`/products/${product.slug}`}
          className="text-xs font-bold uppercase tracking-tight text-neutral-900 hover:underline line-clamp-1 leading-snug"
        >
          {product.name}
        </Link>

        {/* Price in INR */}
        <div className="flex items-baseline gap-2 pt-0.5">
          <span className="text-sm font-black text-neutral-900 tracking-tight">
            {formatINR(product.price)}
          </span>
          {product.compareAtPrice && (
            <span className="text-xs text-neutral-400 line-through">
              {formatINR(product.compareAtPrice)}
            </span>
          )}
        </div>

        {/* Color Swatch Dots */}
        {product.colors.length > 1 && (
          <div className="flex items-center gap-1.5 pt-1">
            {product.colors.map((color, idx) => (
              <button
                key={color.name}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedColorIdx(idx);
                }}
                className={`w-3 h-3 rounded-full border transition-all ${
                  selectedColorIdx === idx
                    ? "ring-1 ring-offset-1 ring-black border-black"
                    : "border-neutral-300 hover:scale-110"
                }`}
                style={{ backgroundColor: color.hex }}
                title={color.name}
                aria-label={`View ${color.name}`}
              />
            ))}
            <span className="text-[10px] text-neutral-400 font-mono ml-1">
              {product.colors.length} colors
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
