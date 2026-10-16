"use client";

import React, { useState } from "react";
import { Heart, ShoppingBag, Zap, Share2, Ruler, AlertCircle } from "lucide-react";
import { Product, TShirtSize } from "@/types";
import { formatINR } from "@/lib/utils";
import { useCart } from "@/context/cart-context";
import { useWishlist } from "@/context/wishlist-context";
import { useToast } from "@/context/toast-context";
import { SizeGuideModal } from "./SizeGuideModal";
import { DeliveryPinChecker } from "./DeliveryPinChecker";
import { useRouter } from "next/navigation";

interface VariantSelectorProps {
  product: Product;
  selectedColorIdx: number;
  onSelectColor: (idx: number) => void;
}

export function VariantSelector({
  product,
  selectedColorIdx,
  onSelectColor,
}: VariantSelectorProps) {
  const [selectedSize, setSelectedSize] = useState<TShirtSize | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [sizeError, setSizeError] = useState(false);
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);

  const { addToBag } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { toast } = useToast();
  const router = useRouter();

  const currentColor = product.colors[selectedColorIdx] || product.colors[0];
  const isFavorited = isInWishlist(product.id);

  const handleAddToBag = () => {
    if (!selectedSize) {
      setSizeError(true);
      toast({
        type: "error",
        title: "Please Select a Size",
        message: "Choose an available size before adding this T-shirt to your bag.",
      });
      return;
    }

    setSizeError(false);
    addToBag({
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      color: currentColor.name,
      size: selectedSize,
      price: product.price,
      image: currentColor.images[0] || product.colors[0].images[0],
      fit: product.fit,
      quantity,
    });
  };

  const handleBuyNow = () => {
    if (!selectedSize) {
      setSizeError(true);
      toast({
        type: "error",
        title: "Please Select a Size",
        message: "Choose an available size before proceeding to checkout.",
      });
      return;
    }

    handleAddToBag();
    router.push("/checkout");
  };

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard?.writeText(window.location.href);
      toast({
        type: "info",
        title: "Link Copied",
        message: "Product URL copied to clipboard.",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Fit & Specifications Pill */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="px-2.5 py-1 bg-[#111111] text-white text-[10px] uppercase tracking-widest font-bold">
          {product.fit} FIT
        </span>
        <span className="px-2.5 py-1 bg-neutral-100 text-neutral-800 text-[10px] uppercase tracking-wider font-semibold">
          {product.gsm} GSM
        </span>
        <span className="px-2.5 py-1 bg-neutral-100 text-neutral-800 text-[10px] uppercase tracking-wider font-semibold">
          {product.sleeve}
        </span>
        <span className="px-2.5 py-1 bg-neutral-100 text-neutral-800 text-[10px] uppercase tracking-wider font-semibold">
          {product.neck}
        </span>
      </div>

      {/* Color Selection */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="uppercase tracking-wider font-bold text-neutral-900">
            Color: <span className="font-normal text-neutral-600">{currentColor.name}</span>
          </span>
          <span className="text-[11px] text-neutral-400 font-mono">
            {product.colors.length} {product.colors.length === 1 ? "Option" : "Options"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {product.colors.map((color, idx) => (
            <button
              key={color.name}
              onClick={() => onSelectColor(idx)}
              className={`group flex items-center gap-2 p-1 border transition-all ${
                selectedColorIdx === idx
                  ? "border-black ring-1 ring-black"
                  : "border-neutral-300 hover:border-neutral-500"
              }`}
              aria-label={`Select ${color.name}`}
            >
              <span
                className="w-5 h-5 border border-black/10 inline-block shrink-0"
                style={{ backgroundColor: color.hex }}
              />
              <span className="text-xs uppercase font-medium pr-1.5 text-neutral-800 hidden sm:inline">
                {color.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Size Selection */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <span className="uppercase tracking-wider font-bold text-neutral-900">Size:</span>
            {selectedSize ? (
              <span className="font-bold text-black">{selectedSize}</span>
            ) : (
              <span className="text-neutral-500">Select your size</span>
            )}
          </div>
          <button
            onClick={() => setIsSizeGuideOpen(true)}
            className="flex items-center gap-1 text-xs text-neutral-700 hover:text-black underline font-semibold"
          >
            <Ruler className="w-3.5 h-3.5" /> Size Guide
          </button>
        </div>

        {/* Size Buttons */}
        <div className="grid grid-cols-6 gap-2">
          {product.sizes.map((size) => {
            const isSelected = selectedSize === size;
            return (
              <button
                key={size}
                onClick={() => {
                  setSelectedSize(size);
                  setSizeError(false);
                }}
                className={`py-3 text-xs uppercase font-bold tracking-wider border transition-all ${
                  isSelected
                    ? "bg-[#111111] text-white border-black shadow-sm"
                    : "bg-white text-neutral-900 border-neutral-300 hover:border-black"
                }`}
                aria-label={`Select size ${size}`}
              >
                {size}
              </button>
            );
          })}
        </div>

        {sizeError && (
          <div className="flex items-center gap-1.5 text-xs text-red-600 pt-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Please select a size before adding to bag.</span>
          </div>
        )}

        {/* Fit Guidance Note */}
        <p className="text-[11px] text-neutral-500 leading-normal pt-1">
          {product.fit === "Oversized"
            ? "Silhouette note: Cut with exaggerated drop shoulders and wide sleeves. Choose your standard size for the intended boxy drape."
            : product.fit === "Relaxed"
            ? "Silhouette note: Relaxed chest cut with standard drop. Fits true to size."
            : "Silhouette note: Classic regular architectural fit."}
        </p>
      </div>

      {/* Quantity Selector */}
      <div className="flex items-center gap-4">
        <span className="text-xs uppercase tracking-wider font-bold text-neutral-900">Quantity</span>
        <div className="flex items-center border border-neutral-300">
          <button
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="px-3 py-1.5 text-sm hover:bg-neutral-100 text-neutral-700 transition-colors"
            aria-label="Decrease quantity"
          >
            -
          </button>
          <span className="w-10 text-center text-xs font-bold text-black">{quantity}</span>
          <button
            onClick={() => setQuantity(Math.min(10, quantity + 1))}
            className="px-3 py-1.5 text-sm hover:bg-neutral-100 text-neutral-700 transition-colors"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
        <span className="text-[11px] text-neutral-400 font-mono">
          {product.stock > 10 ? "In Stock" : `Only ${product.stock} units left in stock`}
        </span>
      </div>

      {/* Action Buttons: Add to Bag & Buy Now */}
      <div className="space-y-2.5 pt-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={handleAddToBag}
            className="w-full py-4 bg-[#111111] hover:bg-black text-white text-xs uppercase tracking-widest font-black flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <ShoppingBag className="w-4 h-4" /> Add to Bag
          </button>
          <button
            onClick={handleBuyNow}
            className="w-full py-4 bg-[#B8FF3B] hover:bg-[#a5f022] text-black text-xs uppercase tracking-widest font-black flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <Zap className="w-4 h-4" /> Buy Now
          </button>
        </div>

        {/* Secondary Actions: Wishlist & Share */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() =>
              toggleWishlist({
                productId: product.id,
                productSlug: product.slug,
                productName: product.name,
                price: product.price,
                image: currentColor.images[0] || product.colors[0].images[0],
                fit: product.fit,
                color: currentColor.name,
              })
            }
            className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 hover:text-black py-1"
          >
            <Heart
              className={`w-4 h-4 ${isFavorited ? "fill-black text-black" : "text-neutral-500"}`}
            />
            <span>{isFavorited ? "Saved to Wishlist" : "Add to Wishlist"}</span>
          </button>

          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 hover:text-black py-1"
          >
            <Share2 className="w-4 h-4 text-neutral-500" />
            <span>Share Garment</span>
          </button>
        </div>
      </div>

      {/* Delivery PIN Code Checker */}
      <DeliveryPinChecker />

      {/* Size Guide Modal */}
      <SizeGuideModal
        isOpen={isSizeGuideOpen}
        onClose={() => setIsSizeGuideOpen(false)}
        initialFit={product.fit}
      />

      {/* Mobile Discreet Sticky Purchase Bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-neutral-200 p-3 z-30 sm:hidden flex items-center justify-between gap-3 shadow-lg">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase truncate">{product.name}</p>
          <p className="text-xs font-black text-black">{formatINR(product.price)}</p>
        </div>
        <button
          onClick={handleAddToBag}
          className="px-5 py-2.5 bg-[#111111] text-white text-[11px] uppercase tracking-widest font-black shrink-0 flex items-center gap-1.5"
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Add to Bag</span>
        </button>
      </div>
    </div>
  );
}
