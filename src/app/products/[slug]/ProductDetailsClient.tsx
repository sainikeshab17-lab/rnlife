"use client";

import React, { useState, useEffect } from "react";
import { Product } from "@/types";
import { ProductGallery } from "@/components/product/ProductGallery";
import { VariantSelector } from "@/components/product/VariantSelector";
import { ProductGrid } from "@/components/product/ProductGrid";
import { formatINR } from "@/lib/utils";
import {
  ChevronDown,
  ChevronUp,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Truck,
  Layers,
  Star,
} from "lucide-react";

interface ProductDetailsClientProps {
  product: Product;
  relatedProducts: Product[];
}

export function ProductDetailsClient({
  product,
  relatedProducts,
}: ProductDetailsClientProps) {
  const [selectedColorIdx, setSelectedColorIdx] = useState(0);
  const [openSection, setOpenSection] = useState<string>("specs");

  // Track recently viewed in localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("rnl_recently_viewed_v1");
      const list: string[] = stored ? JSON.parse(stored) : [];
      const updated = [product.slug, ...list.filter((s) => s !== product.slug)].slice(0, 6);
      localStorage.setItem("rnl_recently_viewed_v1", JSON.stringify(updated));
    } catch {
      // Ignore
    }
  }, [product.slug]);

  const currentColor = product.colors[selectedColorIdx] || product.colors[0];
  const galleryImages = currentColor?.images || product.colors[0]?.images || [];

  const toggleSection = (id: string) => {
    setOpenSection((prev) => (prev === id ? "" : id));
  };

  const discountPercent = product.compareAtPrice
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
    : 0;

  return (
    <div className="pt-4 pb-16">
      {/* Top 2-Column Product Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14">
        {/* Gallery Column (7 cols on Desktop) */}
        <div className="lg:col-span-7">
          <ProductGallery
            images={galleryImages}
            productName={`${product.name} - ${currentColor.name}`}
          />
        </div>

        {/* Product Details & Purchase Column (5 cols on Desktop) */}
        <div className="lg:col-span-5 flex flex-col justify-start">
          <div className="border-b border-neutral-200 pb-5">
            <span className="text-[11px] uppercase tracking-widest font-mono text-neutral-500 font-bold block mb-1">
              RIGHTNOWLIFE STREETWEAR
            </span>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-tight font-editorial text-neutral-900 leading-tight">
              {product.name}
            </h1>
            <p className="text-xs sm:text-sm text-neutral-600 mt-2 leading-relaxed">
              {product.tagline}
            </p>

            {/* Pricing Area */}
            <div className="mt-4 flex items-baseline gap-3">
              <span className="text-2xl sm:text-3xl font-black text-neutral-900">
                {formatINR(product.price)}
              </span>
              {product.compareAtPrice && (
                <>
                  <span className="text-sm text-neutral-400 line-through">
                    {formatINR(product.compareAtPrice)}
                  </span>
                  <span className="px-2 py-0.5 bg-black text-[#B8FF3B] text-xs font-bold uppercase tracking-wider">
                    {discountPercent}% OFF
                  </span>
                </>
              )}
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">Inclusive of all taxes. Free express shipping above ₹1,499.</p>
          </div>

          {/* Interactive Variant Selection */}
          <div className="py-6">
            <VariantSelector
              product={product}
              selectedColorIdx={selectedColorIdx}
              onSelectColor={setSelectedColorIdx}
            />
          </div>

          {/* Value Props Strip */}
          <div className="grid grid-cols-3 gap-2 py-4 border-y border-neutral-200 text-center text-[10px] text-neutral-600 uppercase tracking-wider font-semibold">
            <div className="flex flex-col items-center gap-1">
              <Layers className="w-4 h-4 text-neutral-900" />
              <span>{product.gsm} GSM Combed Jersey</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Truck className="w-4 h-4 text-neutral-900" />
              <span>Express Air Courier</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <RefreshCw className="w-4 h-4 text-neutral-900" />
              <span>Hassle-Free Size Swaps</span>
            </div>
          </div>

          {/* Accordion Sections */}
          <div className="divide-y divide-neutral-200 border-b border-neutral-200 text-xs">
            {/* Description & Fit */}
            <div className="py-3.5">
              <button
                onClick={() => toggleSection("desc")}
                className="w-full flex items-center justify-between text-left uppercase font-bold tracking-wider text-neutral-900 py-1"
              >
                <span>Garment Description & Fit</span>
                {openSection === "desc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {openSection === "desc" && (
                <div className="pt-2.5 pb-2 text-neutral-600 space-y-2 leading-relaxed">
                  <p>{product.description}</p>
                  <p className="font-semibold text-black">
                    Silhouette: {product.fit} Fit with {product.sleeve.toLowerCase()} and {product.neck.toLowerCase()}.
                  </p>
                </div>
              )}
            </div>

            {/* Specifications */}
            <div className="py-3.5">
              <button
                onClick={() => toggleSection("specs")}
                className="w-full flex items-center justify-between text-left uppercase font-bold tracking-wider text-neutral-900 py-1"
              >
                <span>Fabric & Print Specifications</span>
                {openSection === "specs" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {openSection === "specs" && (
                <div className="pt-2.5 pb-2 text-neutral-700 space-y-1.5 font-medium">
                  <div className="flex justify-between py-1 border-b border-neutral-100">
                    <span className="text-neutral-500">Fabric:</span>
                    <span>{product.fabricComposition}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-neutral-100">
                    <span className="text-neutral-500">Fabric Weight:</span>
                    <span>{product.gsm} GSM Heavyweight</span>
                  </div>
                  {product.printTechnique && (
                    <div className="flex justify-between py-1 border-b border-neutral-100">
                      <span className="text-neutral-500">Print Technique:</span>
                      <span>{product.printTechnique}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 border-b border-neutral-100">
                    <span className="text-neutral-500">Collar:</span>
                    <span>1.25&quot; Lycra Ribbed (Anti-curl)</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-neutral-500">Origin:</span>
                    <span>Engineered & Crafted in India</span>
                  </div>
                </div>
              )}
            </div>

            {/* Care Instructions */}
            <div className="py-3.5">
              <button
                onClick={() => toggleSection("care")}
                className="w-full flex items-center justify-between text-left uppercase font-bold tracking-wider text-neutral-900 py-1"
              >
                <span>Washing & Care Instructions</span>
                {openSection === "care" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {openSection === "care" && (
                <ul className="pt-2.5 pb-2 text-neutral-600 space-y-1.5 list-disc list-inside">
                  {product.careInstructions.map((inst, idx) => (
                    <li key={idx}>{inst}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Shipping & Returns */}
            <div className="py-3.5">
              <button
                onClick={() => toggleSection("shipping")}
                className="w-full flex items-center justify-between text-left uppercase font-bold tracking-wider text-neutral-900 py-1"
              >
                <span>Pan-India Shipping & Returns</span>
                {openSection === "shipping" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {openSection === "shipping" && (
                <div className="pt-2.5 pb-2 text-neutral-600 space-y-2 leading-relaxed">
                  <p>
                    • Dispatched within 24 hours via express air courier (Delhivery / BlueDart).
                  </p>
                  <p>
                    • Delivery timeline: 2 to 4 business days across metro cities; 3 to 5 days across rest of India.
                  </p>
                  <p>
                    • Easy 7-day size exchange if your silhouette requires adjustment. Return pickups arranged from your doorstep.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Customer Demonstration Reviews Section */}
      <div className="mt-16 sm:mt-24 pt-12 border-t border-neutral-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-neutral-500 font-bold mb-1">
              <span>CUSTOMER COMMUNITY FEEDBACK</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight font-editorial">
              GARMENT REVIEWS (DEMO CONTENT)
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-500 font-mono">
            <span>[Demonstration Fixtures for Phase 1 Review]</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              author: "Rohan M.",
              city: "Bengaluru",
              rating: 5,
              review:
                "The 260 GSM fabric is genuinely heavyweight without being stiff. The drop shoulder sits perfectly boxy. Easily better than most high-street fast fashion brands.",
              verified: "Verified Buyer (Size L)",
            },
            {
              author: "Kritika S.",
              city: "Mumbai",
              rating: 5,
              review:
                "Loved the collar construction — washed it twice inside out and the neckline didn't warp at all. Puff print has awesome tactile texture.",
              verified: "Verified Buyer (Size M)",
            },
            {
              author: "Aditya P.",
              city: "Delhi NCR",
              rating: 5,
              review:
                "Ordered my normal size M and got the exact streetwear oversized drape shown on the model. Clean aesthetics, zero compromises.",
              verified: "Verified Buyer (Size M)",
            },
          ].map((rev, idx) => (
            <div key={idx} className="p-5 bg-[#F5F4F0] border border-neutral-200 space-y-3">
              <div className="flex items-center gap-1 text-black">
                {[...Array(rev.rating)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-black" />
                ))}
              </div>
              <p className="text-xs text-neutral-800 leading-relaxed italic">
                &ldquo;{rev.review}&rdquo;
              </p>
              <div className="pt-2 border-t border-neutral-200/60 flex items-center justify-between text-[11px]">
                <span className="font-bold text-neutral-900">{rev.author} ({rev.city})</span>
                <span className="text-neutral-500 text-[10px]">{rev.verified}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Related Products Carousel / Grid */}
      {relatedProducts.length > 0 && (
        <div className="mt-16 sm:mt-24 pt-12 border-t border-neutral-200">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight font-editorial">
              YOU MAY ALSO LIKE
            </h2>
            <span className="text-xs uppercase tracking-wider font-bold text-neutral-500 font-mono">
              CURATED STYLES
            </span>
          </div>

          <ProductGrid products={relatedProducts} columns={4} />
        </div>
      )}
    </div>
  );
}
