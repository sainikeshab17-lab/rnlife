"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { Heart, Plus, ShoppingBag } from "lucide-react";
import { Product, ProductGender, TShirtSize } from "@/types";
import { formatINR } from "@/lib/utils";
import { useWishlist } from "@/context/wishlist-context";
import { useCart } from "@/context/cart-context";
import { confirmGenderSelection, genderDisplayLabel, isAvailableGender, parseGenderOptionsResponse } from "@/lib/gender-options";

interface ProductCardProps {
  product: Product;
  priority?: boolean;
}

export function ProductCard({ product, priority = false }: ProductCardProps) {
  const [selectedColorIdx, setSelectedColorIdx] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [showQuickSizes, setShowQuickSizes] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [availableSizes, setAvailableSizes] = useState<Record<string, number | null>>({});
  const [availabilityLoaded, setAvailabilityLoaded] = useState(false);
  const [availabilityError, setAvailabilityError] = useState(false);
  const [genderOptions, setGenderOptions] = useState<ProductGender[]>(product.genders ?? []);
  const [genderOptionsLoaded, setGenderOptionsLoaded] = useState(false);
  const [genderOptionsError, setGenderOptionsError] = useState(false);
  const [pendingSize, setPendingSize] = useState<TShirtSize | null>(null);
  const [selectedGender, setSelectedGender] = useState<ProductGender | null>(null);
  const [isGenderDialogOpen, setIsGenderDialogOpen] = useState(false);
  const confirmingRef = useRef(false);
  const firstGenderOptionRef = useRef<HTMLButtonElement>(null);

  const { isInWishlist, toggleWishlist } = useWishlist();
  const { addToBag } = useCart();

  const isFavorited = isInWishlist(product.id);
  const currentColor = product.colors[selectedColorIdx] || product.colors[0];

  useEffect(() => {
    let active = true;
    setAvailabilityLoaded(false);
    setAvailabilityError(false);
    fetch(`/api/products/${encodeURIComponent(product.id)}/inventory`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("unavailable");
        return response.json();
      })
      .then((data: { sizes?: Array<{ size: string; available: number | null }> }) => {
        if (active) {
          setAvailableSizes(Object.fromEntries((data.sizes ?? []).map(({ size, available }) => [size, available])));
          setAvailabilityLoaded(true);
        }
      })
      .catch(() => { if (active) { setAvailableSizes({}); setAvailabilityError(true); setAvailabilityLoaded(true); } });
    return () => { active = false; };
  }, [product.id]);

  useEffect(() => {
    let active = true;
    setGenderOptionsLoaded(false);
    setGenderOptionsError(false);
    fetch(`/api/product-genders/${encodeURIComponent(product.slug)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("unavailable");
        return response.json();
      })
      .then((data: unknown) => {
        if (active) {
          const configuration = parseGenderOptionsResponse(data);
          setGenderOptions(configuration.productFound ? configuration.genders : []);
          setGenderOptionsLoaded(true);
        }
      })
      .catch(() => { if (active) { setGenderOptionsError(true); setGenderOptionsLoaded(true); } });
    return () => { active = false; };
  }, [product.id, product.slug, product.genders]);

  useEffect(() => {
    if (isGenderDialogOpen) firstGenderOptionRef.current?.focus();
  }, [isGenderDialogOpen]);

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
    if (!genderOptionsLoaded || genderOptionsError) return;
    if (genderOptions.length > 0) {
      setPendingSize(size);
      setSelectedGender(genderOptions.length === 1 ? genderOptions[0] : null);
      setIsGenderDialogOpen(true);
      return;
    }
    commitQuickAdd(size);
  };

  const commitQuickAdd = (size: TShirtSize, gender?: ProductGender) => {
    addToBag({
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      color: currentColor.name,
      ...(gender ? { gender } : {}),
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

  const confirmQuickAddGender = () => {
    if (confirmingRef.current || !pendingSize || !isAvailableGender(genderOptions, selectedGender)) return;
    confirmingRef.current = true;
    try {
      confirmGenderSelection(genderOptions, selectedGender, (gender) => commitQuickAdd(pendingSize, gender));
      setIsGenderDialogOpen(false);
      setPendingSize(null);
    } finally {
      confirmingRef.current = false;
    }
  };

  return (
    <>
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
                    disabled={!availabilityLoaded || availabilityError || availableSizes[size] == null || availableSizes[size] <= 0 || !genderOptionsLoaded || genderOptionsError}
                    className="py-1.5 text-[11px] font-bold text-[#111111] bg-[#FFFFFF] hover:bg-[#FFB900] hover:text-[#111111] transition-colors border border-[#E5E5E5]"
                  >
                    {size}{availableSizes[size] != null && availableSizes[size] > 0 && availableSizes[size] <= 5 ? " · Low" : ""}
                  </button>
                ))}
              </div>
              {availabilityError && <p role="status" className="mt-2 text-center text-[10px] text-amber-700">Stock availability is unavailable. Refresh to retry.</p>}
              {genderOptionsError && <p role="status" className="mt-2 text-center text-[10px] text-amber-700">Product options are unavailable. Refresh to retry.</p>}
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
    {isGenderDialogOpen && typeof document !== "undefined" && createPortal(
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4 py-6" onKeyDown={(event) => { if (event.key === "Escape" && !confirmingRef.current) { setIsGenderDialogOpen(false); setPendingSize(null); } }} onMouseDown={(event) => { if (event.target === event.currentTarget && !confirmingRef.current) { setIsGenderDialogOpen(false); setPendingSize(null); } }}>
        <section role="dialog" aria-modal="true" aria-labelledby={`quick-gender-title-${product.id}`} className="w-full max-w-sm border border-neutral-200 bg-white p-5 shadow-2xl sm:p-6">
          <h2 id={`quick-gender-title-${product.id}`} className="text-sm font-black uppercase tracking-widest">Select gender</h2>
          <p className="mt-2 text-xs text-neutral-600">Choose an option for {product.name}.</p>
          <div role="group" aria-label="Available gender options" className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {genderOptions.map((gender, index) => <button ref={index === 0 ? firstGenderOptionRef : undefined} key={gender} type="button" aria-label={genderDisplayLabel(gender)} aria-pressed={selectedGender === gender} onClick={() => setSelectedGender(gender)} className={`min-h-12 border px-4 py-3 text-xs font-bold uppercase tracking-wider ${selectedGender === gender ? "border-black bg-black text-white" : "border-neutral-300 hover:border-black"}`}>{genderDisplayLabel(gender)}</button>)}
          </div>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => { setIsGenderDialogOpen(false); setPendingSize(null); }} className="min-h-11 border border-neutral-300 px-5 text-xs font-bold uppercase">Cancel</button>
            <button type="button" disabled={!isAvailableGender(genderOptions, selectedGender) || !genderOptionsLoaded || genderOptionsError} onClick={confirmQuickAddGender} className="min-h-11 bg-[#FFB900] px-5 text-xs font-black uppercase disabled:cursor-not-allowed disabled:opacity-50">Add to Cart</button>
          </div>
        </section>
      </div>, document.body,
    )}
    </>
  );
}
