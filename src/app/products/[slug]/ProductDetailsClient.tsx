"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Product } from "@/types";
import { ProductGallery } from "@/components/product/ProductGallery";
import { VariantSelector } from "@/components/product/VariantSelector";
import { ProductGrid } from "@/components/product/ProductGrid";
import { formatINR } from "@/lib/utils";
import {
  ChevronDown,
  ChevronUp,
  Layers,
} from "lucide-react";

interface ProductDetailsClientProps {
  product: Product;
  relatedProducts: Product[];
}

type AccordionId = "desc" | "specs" | "care" | "shipping" | "";

export function ProductDetailsClient({
  product,
  relatedProducts,
}: ProductDetailsClientProps) {
  const [selectedColorIdx, setSelectedColorIdx] = useState(0);
  const [openSection, setOpenSection] = useState<AccordionId>("specs");

  // Track recently viewed in localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("rnl_recently_viewed_v1");
      const list: string[] = stored ? JSON.parse(stored) : [];
      const updated = [
        product.slug,
        ...list.filter((s) => s !== product.slug),
      ].slice(0, 6);
      localStorage.setItem("rnl_recently_viewed_v1", JSON.stringify(updated));
    } catch {
      // Ignore
    }
  }, [product.slug]);

  const currentColor = product.colors[selectedColorIdx] || product.colors[0];
  const galleryImages = currentColor?.images || product.colors[0]?.images || [];
  const galleryImageAlts =
    currentColor?.imageAlts || product.colors[0]?.imageAlts;

  const toggleSection = (id: AccordionId) => {
    setOpenSection((prev) => (prev === id ? "" : id));
  };

  const discountPercent = product.compareAtPrice
    ? Math.round(
        ((product.compareAtPrice - product.price) / product.compareAtPrice) *
          100
      )
    : 0;

  return (
    <div className="pt-4 pb-20">
      {/* ── Breadcrumb ── */}
      <nav
        className="flex items-center gap-1.5 text-[11px] text-[#858585] mb-6 uppercase tracking-wide font-medium"
        aria-label="Breadcrumb"
      >
        <Link href="/" className="hover:text-[#111111] transition-colors">
          Home
        </Link>
        <span>/</span>
        <Link href="/shop" className="hover:text-[#111111] transition-colors">
          Shop
        </Link>
        <span>/</span>
        {product.collectionSlug && (
          <>
            <Link
              href={`/collections/${product.collectionSlug}`}
              className="hover:text-[#111111] transition-colors capitalize"
            >
              {product.collectionSlug.replace(/-/g, " ")}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="text-[#111111] truncate max-w-[180px]">
          {product.name}
        </span>
      </nav>

      {/* ── Two-Column Product Stage ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] gap-8 lg:gap-14">
        {/* Gallery Column */}
        <div>
          <ProductGallery
            images={galleryImages}
            imageAlts={galleryImageAlts}
            productName={`${product.name} — ${currentColor.name}`}
          />
        </div>

        {/* Purchase Details Column */}
        <div className="flex flex-col justify-start lg:sticky lg:top-24 lg:self-start">
          {/* Title block */}
          <div className="border-b border-[#E5E5E5] pb-5">
            <span className="text-[10px] uppercase tracking-widest font-mono text-[#858585] font-bold block mb-2">
              RIGHTNOWLIFE
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111111] leading-tight">
              {product.name}
            </h1>
            {product.tagline && (
              <p className="text-xs text-[#858585] mt-2 leading-relaxed">
                {product.tagline}
              </p>
            )}

            {/* Pricing */}
            <div className="mt-4 flex items-baseline gap-3 flex-wrap">
              <span className="text-2xl font-bold text-[#111111]">
                {formatINR(product.price)}
              </span>
              {product.compareAtPrice && (
                <>
                  <span className="text-sm text-[#858585] line-through">
                    {formatINR(product.compareAtPrice)}
                  </span>
                  <span className="px-2 py-0.5 bg-[#F5141C] text-white text-[10px] font-black uppercase tracking-wider">
                    {discountPercent}% OFF
                  </span>
                </>
              )}
              {product.isNewDrop && !product.compareAtPrice && (
                <span className="px-2 py-0.5 bg-[#111111] text-[#FFB900] text-[10px] font-black uppercase tracking-wider">
                  NEW DROP
                </span>
              )}
            </div>
          </div>

          {/* Variant Selection */}
          <div className="py-6">
            <VariantSelector
              product={product}
              selectedColorIdx={selectedColorIdx}
              onSelectColor={setSelectedColorIdx}
            />
          </div>

          {/* Value Props Strip */}
          <div className="grid grid-cols-2 gap-x-5 gap-y-3 border-y border-[#E5E5E5] py-4 text-xs">
            <div>
              <span className="block text-[10px] uppercase tracking-wider text-[#858585]">Fit</span>
              <span className="mt-1 block font-medium">{product.fit}</span>
            </div>
            {product.gsm > 0 && (
              <div>
                <span className="block text-[10px] uppercase tracking-wider text-[#858585]">Fabric weight</span>
                <span className="mt-1 flex items-center gap-1.5 font-medium"><Layers className="h-3.5 w-3.5" />{product.gsm} GSM</span>
              </div>
            )}
            {product.fabricComposition !== "Fabric details coming soon" && (
              <div className="col-span-2">
                <span className="block text-[10px] uppercase tracking-wider text-[#858585]">Composition</span>
                <span className="mt-1 block font-medium">{product.fabricComposition}</span>
              </div>
            )}
          </div>

          {/* Accordion Sections */}
          <div className="divide-y divide-[#E5E5E5] border-b border-[#E5E5E5] text-xs mt-4">
            {/* Description & Fit */}
            <AccordionSection
              id="desc"
              label="Garment Description & Fit"
              open={openSection === "desc"}
              onToggle={toggleSection}
            >
              <p className="text-[#858585] leading-relaxed">{product.description}</p>
              <p className="font-semibold text-[#111111] mt-2">
                Silhouette: {product.fit} Fit · {product.sleeve} · {product.neck}
              </p>
            </AccordionSection>

            {/* Specifications */}
            <AccordionSection
              id="specs"
              label="Fabric & Print Specifications"
              open={openSection === "specs"}
              onToggle={toggleSection}
            >
              <dl className="space-y-1.5 text-[#111111]">
                <SpecRow label="Fabric" value={product.fabricComposition} />
                {product.gsm > 0 && (
                  <SpecRow
                    label="Fabric Weight"
                    value={`${product.gsm} GSM`}
                  />
                )}
                {product.printTechnique && (
                  <SpecRow
                    label="Print Technique"
                    value={product.printTechnique}
                  />
                )}
                <SpecRow label="Sleeve" value={product.sleeve} />
                <SpecRow label="Neckline" value={product.neck} />
              </dl>
            </AccordionSection>

            {/* Care */}
            <AccordionSection
              id="care"
              label="Washing & Care Instructions"
              open={openSection === "care"}
              onToggle={toggleSection}
            >
              <ul className="text-[#858585] space-y-1.5 list-disc list-inside leading-relaxed">
                {product.careInstructions.map((inst, idx) => (
                  <li key={idx}>{inst}</li>
                ))}
              </ul>
            </AccordionSection>

            {/* Shipping */}
            <AccordionSection
              id="shipping"
              label="Shipping & exchanges"
              open={openSection === "shipping"}
              onToggle={toggleSection}
            >
              <p className="text-[#858585] leading-relaxed">
                Delivery coverage and exchange eligibility are not checked live in this prototype. Review the current policies before placing an order.
              </p>
              <div className="mt-3 flex gap-4 font-semibold text-[#0876A8]">
                <Link href="/shipping" className="underline underline-offset-2">Shipping policy</Link>
                <Link href="/returns" className="underline underline-offset-2">Exchange policy</Link>
              </div>
            </AccordionSection>
          </div>
        </div>
      </div>

      {/* ── Related Products ── */}
      {relatedProducts.length > 0 && (
        <div className="mt-16 sm:mt-24 pt-12 border-t border-[#E5E5E5]">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight font-editorial">
              You May Also Like
            </h2>
            <Link
              href="/shop"
              className="text-xs uppercase tracking-wider font-bold text-[#858585] hover:text-[#111111] transition-colors"
            >
              View All →
            </Link>
          </div>
          <ProductGrid products={relatedProducts} columns={4} />
        </div>
      )}
    </div>
  );
}

/* ── Accordion Section Sub-component ── */
function AccordionSection({
  id,
  label,
  open,
  onToggle,
  children,
}: {
  id: AccordionId;
  label: string;
  open: boolean;
  onToggle: (id: AccordionId) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="py-3.5">
      <button
        onClick={() => onToggle(id)}
        className="w-full flex items-center justify-between text-left uppercase font-bold tracking-wider text-[#111111] py-0.5 hover:text-[#0876A8] transition-colors"
        aria-expanded={open}
      >
        <span>{label}</span>
        {open ? (
          <ChevronUp className="w-4 h-4 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 shrink-0" />
        )}
      </button>
      {open && (
        <div className="accordion-body pt-3 pb-2 text-xs">{children}</div>
      )}
    </div>
  );
}

/* ── Spec Row Sub-component ── */
function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 border-b border-[#E5E5E5] last:border-0">
      <span className="text-[#858585]">{label}:</span>
      <span className="font-medium text-[#111111]">{value}</span>
    </div>
  );
}
