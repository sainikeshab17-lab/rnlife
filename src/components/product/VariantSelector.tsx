"use client";

import React, { useState } from "react";
import {
  Heart,
  ShoppingBag,
  Zap,
  Share2,
  Ruler,
  AlertCircle,
  CheckCircle2,
  Package,
} from "lucide-react";
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

  const { addToBag, closeDrawer } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { toast } = useToast();
  const router = useRouter();

  const currentColor = product.colors[selectedColorIdx] || product.colors[0];
  const isFavorited = isInWishlist(product.id);

  const isInStock = product.stock > 0;

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
    closeDrawer();
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
    <div className="space-y-5">
      {/* Product Tags: Fit, GSM, Sleeve, Neck */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="px-2 py-0.5 bg-[#111111] text-white text-[10px] uppercase tracking-widest font-bold">
          {product.fit} FIT
        </span>
        {product.gsm > 0 && (
          <span className="px-2 py-0.5 bg-[#FFFFFF] text-[#111111] text-[10px] uppercase tracking-wider font-semibold border border-[#E5E5E5]">
            {product.gsm} GSM
          </span>
        )}
        <span className="px-2 py-0.5 bg-[#FFFFFF] text-[#111111] text-[10px] uppercase tracking-wider font-semibold border border-[#E5E5E5]">
          {product.sleeve}
        </span>
        <span className="px-2 py-0.5 bg-[#FFFFFF] text-[#111111] text-[10px] uppercase tracking-wider font-semibold border border-[#E5E5E5]">
          {product.neck}
        </span>
      </div>

      {/* Stock Status */}
      <div className="flex items-center gap-1.5">
        {isInStock ? (
          <>
            <span className="w-2 h-2 rounded-full bg-[#079447]" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#079447]">
              Available
            </span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-[#858585]" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#858585]">
              Out of Stock
            </span>
          </>
        )}
      </div>

      {/* Color Selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="uppercase tracking-wider font-bold text-[#111111]">
            Color:{" "}
            <span className="font-medium text-[#858585]">{currentColor.name}</span>
          </span>
          <span className="text-[10px] text-[#858585] font-mono">
            {product.colors.length} {product.colors.length === 1 ? "Option" : "Options"}
          </span>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {product.colors.map((color, idx) => (
            <button
              key={color.name}
              onClick={() => {
                onSelectColor(idx);
                setSizeError(false);
              }}
              className={`chip-morph group relative flex items-center gap-2 px-2 py-1 border transition-all ${
                selectedColorIdx === idx
                  ? "border-[#0876A8] ring-2 ring-[#0876A8] ring-offset-1"
                  : "border-[#E5E5E5] hover:border-[#111111]"
              }`}
              aria-label={`Select ${color.name}`}
              aria-pressed={selectedColorIdx === idx}
            >
              <span
                className="w-4 h-4 border border-black/10 inline-block shrink-0"
                style={{ backgroundColor: color.hex }}
              />
              <span className="text-[11px] uppercase font-semibold text-[#111111] hidden sm:inline pr-0.5">
                {color.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Size Selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <span className="uppercase tracking-wider font-bold text-[#111111]">Size:</span>
            {selectedSize ? (
              <span className="font-bold text-[#111111]">{selectedSize}</span>
            ) : (
              <span className="text-[#858585]">Select your size</span>
            )}
          </div>
          <button
            onClick={() => setIsSizeGuideOpen(true)}
            className="flex items-center gap-1 text-xs text-[#0876A8] hover:text-[#111111] font-semibold transition-colors underline underline-offset-2"
          >
            <Ruler className="w-3.5 h-3.5" />
            Size Guide
          </button>
        </div>

        {/* Size Buttons Grid */}
        <div className="grid grid-cols-6 gap-1.5">
          {product.sizes.map((size) => {
            const isSelected = selectedSize === size;
            return (
              <button
                key={size}
                onClick={() => {
                  setSelectedSize(size);
                  setSizeError(false);
                }}
                className={`chip-morph py-3 text-xs uppercase font-bold tracking-wider border transition-all ${
                  isSelected
                    ? "bg-[#111111] text-white border-[#111111] -translate-y-0.5 shadow-sm"
                    : "bg-white text-[#111111] border-[#E5E5E5] hover:border-[#111111]"
                }`}
                disabled={!isInStock}
                aria-label={`Select size ${size}`}
                aria-pressed={isSelected}
              >
                {size}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-[#858585]">
          Size-level inventory is not tracked in this prototype.
        </p>

        {/* Size error */}
        {sizeError && (
          <div className="flex items-center gap-1.5 text-xs text-[#F5141C] pt-0.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Please select a size before adding to bag.</span>
          </div>
        )}

        <p className="text-[11px] text-[#858585] leading-normal pt-0.5">
          {product.fit} fit. Use the size guide to compare garment measurements.
        </p>
      </div>

      {/* Quantity Selector */}
      <div className="flex items-center gap-4">
        <span className="text-xs uppercase tracking-wider font-bold text-[#111111]">
          Qty
        </span>
        <div className="flex items-center border border-[#E5E5E5]">
          <button
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            disabled={!isInStock}
            className="px-3 py-2 text-sm hover:bg-[#FFFFFF] text-[#111111] transition-colors"
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span className="w-10 text-center text-xs font-bold text-[#111111]">
            {quantity}
          </span>
          <button
            onClick={() => setQuantity(Math.min(10, quantity + 1))}
            disabled={!isInStock}
            className="px-3 py-2 text-sm hover:bg-[#FFFFFF] text-[#111111] transition-colors"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2 pt-1">
        {/* Primary: Add to Bag — Yellow */}
        <button
          onClick={handleAddToBag}
          disabled={!isInStock}
          className="btn-morph btn-yellow w-full py-4 text-[11px] uppercase tracking-widest font-black flex items-center justify-center gap-2 shadow-sm"
        >
          <ShoppingBag className="w-4 h-4" />
          Add to Bag
        </button>

        {/* Secondary: Buy Now — Dark */}
        <button
          onClick={handleBuyNow}
          disabled={!isInStock}
          className="btn-morph btn-dark w-full py-3.5 text-[11px] uppercase tracking-widest font-bold flex items-center justify-center gap-2"
        >
          <Zap className="w-4 h-4" />
          Buy Now
        </button>

        {/* Tertiary Actions */}
        <div className="flex items-center justify-between pt-0.5">
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
            className="flex items-center gap-1.5 text-xs font-semibold text-[#858585] hover:text-[#111111] py-1 transition-colors"
          >
            <Heart
              className={`w-4 h-4 ${isFavorited ? "fill-[#F5141C] text-[#F5141C]" : ""}`}
            />
            <span>{isFavorited ? "Saved to Wishlist" : "Add to Wishlist"}</span>
          </button>

          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#858585] hover:text-[#111111] py-1 transition-colors"
          >
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </button>
        </div>
      </div>

      {/* Delivery PIN Checker */}
      <DeliveryPinChecker />

      {/* Size Guide Modal */}
      <SizeGuideModal
        isOpen={isSizeGuideOpen}
        onClose={() => setIsSizeGuideOpen(false)}
        initialFit={product.fit}
      />

      {/* Mobile Sticky Bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-[#E5E5E5] px-4 py-3 z-30 sm:hidden flex items-center justify-between gap-3 shadow-xl">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase truncate text-[#111111]">
            {product.name}
          </p>
          <p className="text-sm font-black text-[#111111]">
            {formatINR(product.price)}
          </p>
        </div>
        <button
          onClick={handleAddToBag}
          className="btn-morph btn-yellow px-6 py-2.5 text-[11px] uppercase tracking-widest font-black shrink-0 flex items-center gap-1.5"
          disabled={!isInStock}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Add to Bag</span>
        </button>
      </div>
    </div>
  );
}
