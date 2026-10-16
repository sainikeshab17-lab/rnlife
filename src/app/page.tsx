"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Truck, RefreshCw, Shield } from "lucide-react";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { ProductGrid } from "@/components/product/ProductGrid";
import { PRODUCTS, COLLECTIONS } from "@/data/mock-data";
import { PrototypeNotice } from "@/components/common/PrototypeNotice";

export default function HomePage() {
  const newArrivals = PRODUCTS.filter((p) => p.isNewDrop).slice(0, 4);

  // Collection tiles — first 3 only
  const collectionTiles = COLLECTIONS.slice(0, 3);

  return (
    <StoreLayout>
      <PrototypeNotice />

      {/* ── HERO ── */}
      <section className="bg-[#111111] text-white py-20 md:py-28 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl">
            {/* Drop tag */}
            <div className="inline-flex items-center gap-2 mb-6 text-[10px] uppercase tracking-widest font-mono text-[#FFB900] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FFB900] animate-pulse" />
              <span>Drop 04 — Midnight District</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black uppercase tracking-tight leading-[0.92] font-editorial text-white mb-6">
              Wear What
              <br />
              You Feel.
            </h1>

            {/* Sub */}
            <p className="text-sm sm:text-base text-neutral-400 max-w-md leading-relaxed mb-8">
              Heavyweight 260 GSM combed cotton. Distinctive graphics. Made in India for everyday expression.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/collections/new-drops"
                className="btn-morph btn-yellow inline-flex items-center justify-center gap-2 px-8 py-4 text-xs uppercase tracking-widest font-black"
              >
                Shop the Drop
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/shop"
                className="btn-morph inline-flex items-center justify-center gap-2 px-8 py-4 text-xs uppercase tracking-widest font-bold border border-white/30 text-white hover:border-white transition-colors"
              >
                Explore All Tees
              </Link>
            </div>
          </div>
        </div>

        {/* Marquee ticker */}
        <div className="mt-16 border-t border-neutral-800 pt-4 overflow-hidden">
          <div className="animate-marquee text-[11px] uppercase tracking-widest font-mono text-neutral-500 whitespace-nowrap">
            <span className="mr-10">• 100% Combed Cotton</span>
            <span className="mr-10">• 240–280 GSM Heavyweight</span>
            <span className="mr-10">• Drop Shoulder Silhouettes</span>
            <span className="mr-10">• Discharge Print Inks</span>
            <span className="mr-10">• Engineered in India</span>
            <span className="mr-10">• Express Dispatch</span>
            <span className="mr-10">• 7-Day Size Exchange</span>
            <span className="mr-10">• 100% Combed Cotton</span>
            <span className="mr-10">• 240–280 GSM Heavyweight</span>
            <span className="mr-10">• Drop Shoulder Silhouettes</span>
            <span className="mr-10">• Discharge Print Inks</span>
            <span className="mr-10">• Engineered in India</span>
          </div>
        </div>
      </section>

      {/* ── COLLECTION TILES ── */}
      <section className="py-14 md:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <span className="text-[10px] uppercase tracking-widest font-mono text-[#858585] font-semibold block mb-1">
              Curated Collections
            </span>
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight font-editorial">
              Shop by Collection
            </h2>
          </div>
          <Link
            href="/shop"
            className="text-xs uppercase tracking-wider font-bold text-[#858585] hover:text-[#111111] transition-colors flex items-center gap-1.5"
          >
            View All <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {collectionTiles.map((col, idx) => (
            <Link
              key={col.id}
              href={`/collections/${col.slug}`}
              className="card-morph group relative bg-[#F5F4F0] overflow-hidden block aspect-[4/5]"
            >
              {/* Collection image placeholder with brand color accent */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/80 z-10" />
              <div
                className="absolute inset-0 bg-cover bg-center img-morph"
                style={{ backgroundImage: `url(${col.heroImage})` }}
              />

              <div className="absolute inset-x-0 bottom-0 z-20 p-5">
                <span className="text-[9px] uppercase font-mono tracking-widest text-[#FFB900] block mb-1">
                  Series 0{idx + 1}
                </span>
                <h3 className="text-lg font-black uppercase tracking-tight font-editorial text-white leading-tight">
                  {col.name}
                </h3>
                <div className="mt-3 flex items-center gap-1.5 text-xs uppercase tracking-wider font-bold text-white/80 group-hover:text-[#FFB900] transition-colors">
                  Shop <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── NEW ARRIVALS ── */}
      <section className="py-14 md:py-20 bg-[#F5F4F0] border-y border-[#E5E5E5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8">
            <div>
              <span className="text-[10px] uppercase tracking-widest font-mono text-[#858585] font-semibold block mb-1">
                Fresh Off the Loom
              </span>
              <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight font-editorial">
                New Arrivals
              </h2>
            </div>
            <Link
              href="/collections/new-drops"
              className="mt-3 sm:mt-0 text-xs uppercase tracking-wider font-bold text-[#858585] hover:text-[#111111] transition-colors flex items-center gap-1.5"
            >
              Shop New Drops <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <ProductGrid products={newArrivals} columns={4} />
        </div>
      </section>

      {/* ── BRAND STATEMENT ── */}
      <section className="py-16 md:py-24 bg-white border-b border-[#E5E5E5]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center space-y-5">
          <span className="text-[10px] uppercase tracking-widest font-mono text-[#858585] font-bold">
            Our Craft
          </span>
          <p className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-tight leading-tight font-editorial text-[#111111]">
            Right now is yours. We make T-shirts that are part of your story.
          </p>
          <p className="text-xs sm:text-sm text-[#858585] max-w-lg mx-auto leading-relaxed">
            Crafted in limited drops. Heavyweight construction. Obsessively refined fit, weight, and artwork.
          </p>
          <div className="pt-2">
            <Link
              href="/shop"
              className="btn-morph btn-yellow inline-flex items-center gap-2 px-6 py-3 text-xs uppercase tracking-widest font-black"
            >
              Shop All Tees <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── TRUST STRIP ── */}
      <section className="py-10 bg-[#F5F4F0] border-b border-[#E5E5E5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3">
              <div className="p-2.5 bg-white border border-[#E5E5E5] text-[#079447] shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider font-bold text-[#111111]">
                  Pan-India Air Dispatch
                </p>
                <p className="text-[11px] text-[#858585] mt-0.5">
                  Express courier. Real-time tracking on every order.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3">
              <div className="p-2.5 bg-white border border-[#E5E5E5] text-[#0876A8] shrink-0">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider font-bold text-[#111111]">
                  Hassle-Free Size Swaps
                </p>
                <p className="text-[11px] text-[#858585] mt-0.5">
                  Easy size exchanges arranged from your doorstep.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3">
              <div className="p-2.5 bg-white border border-[#E5E5E5] text-[#858585] shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider font-bold text-[#111111]">
                  Razorpay Secure Checkout
                </p>
                <p className="text-[11px] text-[#858585] mt-0.5">
                  UPI, Cards, NetBanking — preview integration.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </StoreLayout>
  );
}
