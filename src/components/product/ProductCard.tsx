"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, Plus, ShoppingBag } from "lucide-react";
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
  const [justAdded, setJustAdded] = useState(false);

  const { isInWishlist, toggleWishlist } = useWishlist();
  const { addToBag } = useCart();

  const isFavorited = isInWishlist(product.id);
  const currentColor = product.colors[selectedColorIdx] || product.colors[0];

  const primaryImage = currentColor?.images[0] || product.colors[0]?.images[0] || "";
  const hoverImage =
    currentColor?.images[1] || product.colors[0]?.images[1] || primaryImage;
  const primaryImageAlt = currentColor?.imageAlts?.[0] || product.name;
  const hoverImageAlt =
    currentColor?.imageAlts?.[1] || `${product.name} alternate view`;

  const discountPercent = product.compareAtPrice
    ? Math.round(
        ((product.compareAtPrice - product.price) / product.compareAtPrice) * 100
      )
    : 0;

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
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1800);
  };

  return (
    <div
      className="card-morph group relative flex flex-col bg-white"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowQuickSizes(false);
      }}
    >
      {/* Image Container */}
      <div className="relative aspect-[3/4] w-full bg-[#FFFFFF]">
        <Link href={`/products/${product.slug}`} className="relative block w-full h-full">
          {/* Primary image */}
          <Image
            src={primaryImage}
            alt={primaryImageAlt}
            fill
            priority={priority}
            className={`img-morph object-contain object-center transition-opacity duration-400 ${
              isHovered && hoverImage !== primaryImage ? "opacity-0" : "opacity-100"
            }`}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />

          {/* Hover image */}
          {hoverImage !== primaryImage && (
            <Image
              src={hoverImage}
              alt={hoverImageAlt}
              fill
              className={`object-contain object-center transition-opacity duration-400 ${
                isHovered ? "opacity-100" : "opacity-0"
              }`}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          )}
        </Link>

        {/* Badges — top left */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 z-10 pointer-events-none">
          {product.isNewDrop && (
            <span className="bg-[#111111] text-[#FFB900] text-[9px] font-black uppercase tracking-widest px-2 py-0.5">
              NEW
            </span>
          )}
          {discountPercent > 0 && (
            <span className="bg-[#F5141C] text-white text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5">
              -{discountPercent}%
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
          aria-pressed={isFavorited}
          className={`absolute top-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 z-10 ${
            isFavorited
              ? "bg-white text-[#F5141C]"
              : "bg-white/80 hover:bg-white text-[#858585] hover:text-[#F5141C] backdrop-blur-sm"
          }`}
          aria-label={isFavorited ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart
            className={`w-3.5 h-3.5 ${isFavorited ? "fill-[#F5141C]" : ""}`}
          />
        </button>

        {/* Quick Add overlay */}
        <div
          className={`absolute inset-x-0 bottom-0 z-10 transition-all duration-200 focus-within:opacity-100 focus-within:translate-y-0 ${
            isHovered ? "opacity-100 translate-y-0" : "opacity-100 translate-y-0 md:opacity-0 md:translate-y-1"
          }`}
        >
          {showQuickSizes ? (
            <div className="bg-white/97 backdrop-blur-md p-2.5 border-t border-[#E5E5E5]">
              <p className="text-[10px] uppercase font-bold tracking-wider text-[#858585] mb-2 text-center">
                Select Size
              </p>
              <div className="grid grid-cols-5 gap-1">
                {product.sizes.map((size) => (
                  <button
                    key={size}
                    onClick={(e) => handleQuickAdd(size, e)}
                    disabled={product.stock <= 0}
                    className="py-1.5 text-[11px] font-bold text-[#111111] bg-[#FFFFFF] hover:bg-[#FFB900] hover:text-[#111111] transition-colors border border-[#E5E5E5]"
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
              className={`w-full py-2.5 text-[11px] uppercase tracking-widest font-bold flex items-center justify-center gap-1.5 transition-all duration-200 ${
                justAdded
                  ? "bg-[#079447] text-white"
                  : "bg-[#FFB900] text-[#111111] hover:bg-[#FFB900]"
              }`}
            >
              {justAdded ? (
                <>
                  <ShoppingBag className="w-3.5 h-3.5" /> Added!
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" /> Quick Add
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Product Info */}
      <div className="pt-3 pb-2 flex flex-col gap-1.5">
        {/* Fit & Specifications */}
        <div className="flex items-center justify-between text-[10px] text-[#858585] uppercase tracking-wider font-semibold">
          <span>{product.fit} Fit</span>
          <span>{product.gsm > 0 ? `${product.gsm} GSM` : product.sleeve}</span>
        </div>

        {/* Title */}
        <Link
          href={`/products/${product.slug}`}
          className="block min-h-[4.5rem] break-words [overflow-wrap:anywhere] text-xs font-bold uppercase tracking-tight text-[#111111] hover:text-[#0876A8] transition-colors leading-snug"
        >
          {product.name}
        </Link>

        {/* Price */}
        <div className="flex items-baseline gap-2 pt-0.5">
          <span className="text-sm font-black text-[#111111] tracking-tight">
            {formatINR(product.price)}
          </span>
          {product.compareAtPrice && (
            <span className="text-xs text-[#858585] line-through">
              {formatINR(product.compareAtPrice)}
            </span>
          )}
        </div>

        {/* Color Swatches */}
        {product.colors.length > 1 && (
          <div className="flex items-center gap-1.5 pt-0.5">
            {product.colors.map((color, idx) => (
              <button
                key={color.name}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedColorIdx(idx);
                }}
                className={`chip-morph w-3 h-3 rounded-full border transition-all ${
                  selectedColorIdx === idx
                    ? "ring-1 ring-offset-1 ring-[#0876A8] border-[#0876A8]"
                    : "border-[#E5E5E5] hover:border-[#858585]"
                }`}
                style={{ backgroundColor: color.hex }}
                title={color.name}
                aria-label={`View ${color.name}`}
              />
            ))}
            <span className="text-[10px] text-[#858585] font-mono ml-0.5">
              {product.colors.length} colors
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
