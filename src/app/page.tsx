"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Sparkles, Shield, Repeat, Truck, Award } from "lucide-react";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { ProductGrid } from "@/components/product/ProductGrid";
import { PRODUCTS, COLLECTIONS, INSTAGRAM_GRID, BRAND_INFO } from "@/data/mock-data";
import { PrototypeNotice } from "@/components/common/PrototypeNotice";

export default function HomePage() {
  const newArrivals = PRODUCTS.filter((p) => p.isNewDrop).slice(0, 4);
  const bestsellers = PRODUCTS.filter((p) => p.isBestseller).slice(0, 4);
  const oversizedPicks = PRODUCTS.filter((p) => p.fit === "Oversized").slice(0, 4);
  const essentialPicks = PRODUCTS.filter((p) => p.collectionSlug === "essentials").slice(0, 3);

  return (
    <StoreLayout>
      <PrototypeNotice />

      {/* SECTION A: FULL-WIDTH HERO CAMPAIGN */}
      <section className="relative w-full min-h-[85vh] sm:min-h-[90vh] bg-[#111111] text-white flex items-center overflow-hidden">
        {/* Background Editorial Campaign Image */}
        <div className="absolute inset-0 z-0">
          <Image
            src="https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=2200&q=85"
            alt="RightNowLife Streetwear Hero Campaign"
            fill
            priority
            className="object-cover object-center opacity-45 sm:opacity-55 scale-105 transition-transform duration-1000"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32 w-full flex flex-col justify-end">
          <div className="max-w-2xl space-y-4 sm:space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md border border-white/20 text-[#B8FF3B] text-[10px] sm:text-xs uppercase tracking-widest font-mono font-bold">
              <span className="w-2 h-2 rounded-full bg-[#B8FF3B] animate-pulse" />
              <span>DROP 04 / MIDNIGHT DISTRICT</span>
            </div>

            <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black uppercase tracking-tight leading-[0.9] font-editorial text-white">
              WEAR WHAT YOU FEEL.
            </h1>

            <p className="text-sm sm:text-base md:text-lg text-neutral-300 max-w-lg leading-relaxed font-normal">
              Everyday essentials. Distinctive graphics. Heavyweight 260 GSM combed cotton made for your own kind of expression.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                href="/collections/new-drops"
                className="px-8 py-4 bg-[#B8FF3B] hover:bg-[#a6ec29] text-black text-xs uppercase tracking-widest font-black transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <span>SHOP THE DROP</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/shop"
                className="px-8 py-4 bg-white/10 hover:bg-white text-white hover:text-black border border-white/30 hover:border-white text-xs uppercase tracking-widest font-black transition-all flex items-center justify-center gap-2 backdrop-blur-sm"
              >
                <span>EXPLORE ALL TEES</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom marquee ticker accent */}
        <div className="absolute bottom-0 inset-x-0 bg-black/80 border-t border-neutral-800 py-2.5 overflow-hidden text-[11px] uppercase tracking-widest-custom font-mono text-neutral-400">
          <div className="flex gap-8 whitespace-nowrap animate-marquee">
            <span>• 100% COMBED COTTON</span>
            <span>• 240–280 GSM HEAVYWEIGHT</span>
            <span>• DROP SHOULDER SILHOUETTES</span>
            <span>• ZERO-FEEL DISCHARGE PRINTS</span>
            <span>• ENGINEERED IN INDIA</span>
            <span>• EXPRESS DISPATCH</span>
            <span>• 100% COMBED COTTON</span>
            <span>• 240–280 GSM HEAVYWEIGHT</span>
            <span>• DROP SHOULDER SILHOUETTES</span>
          </div>
        </div>
      </section>

      {/* SECTION B: SHOP THE COLLECTION (EDITORIAL TILES) */}
      <section className="py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 sm:mb-12">
          <div>
            <span className="text-[11px] uppercase tracking-widest font-mono text-neutral-500 font-semibold block mb-1">
              Curated Silhouettes
            </span>
            <h2 className="text-2xl sm:text-4xl font-black uppercase tracking-tight font-editorial">
              SHOP THE COLLECTIONS
            </h2>
          </div>
          <Link
            href="/shop"
            className="text-xs uppercase tracking-wider font-bold text-neutral-800 hover:text-black flex items-center gap-1.5 mt-2 md:mt-0 hover:underline"
          >
            View All Series <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {COLLECTIONS.slice(0, 3).map((col, idx) => (
            <Link
              key={col.id}
              href={`/collections/${col.slug}`}
              className="group relative h-96 sm:h-[460px] bg-neutral-900 overflow-hidden block"
            >
              <Image
                src={col.heroImage}
                alt={col.name}
                fill
                className="object-cover object-top opacity-75 group-hover:opacity-90 group-hover:scale-105 transition-all duration-700"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

              <div className="absolute inset-x-0 bottom-0 p-6 flex flex-col justify-end text-white">
                <span className="text-[10px] uppercase font-mono tracking-widest text-[#B8FF3B] mb-1">
                  SERIES 0{idx + 1}
                </span>
                <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight font-editorial">
                  {col.name}
                </h3>
                <p className="text-xs text-neutral-300 line-clamp-2 mt-1 font-normal leading-relaxed">
                  {col.tagline}
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-white group-hover:text-[#B8FF3B] transition-colors">
                  <span>Shop Collection</span>
                  <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* SECTION C: NEW ARRIVALS */}
      <section className="py-16 md:py-20 bg-[#F5F4F0] border-y border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 sm:mb-12">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-mono text-neutral-600 font-bold mb-1">
                <Sparkles className="w-3.5 h-3.5 text-black" />
                <span>FRESH OFF THE LOOM</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-black uppercase tracking-tight font-editorial">
                NEW ARRIVALS
              </h2>
            </div>
            <Link
              href="/collections/new-drops"
              className="text-xs uppercase tracking-wider font-bold text-neutral-800 hover:text-black flex items-center gap-1.5 mt-2 sm:mt-0 hover:underline"
            >
              Shop New Drop Edit <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <ProductGrid products={newArrivals} columns={4} />
        </div>
      </section>

      {/* SECTION D: SIGNATURE GRAPHIC COLLECTION (EDITORIAL EDIT) */}
      <section className="py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-7 relative aspect-[4/5] sm:aspect-[16/11] bg-neutral-100 overflow-hidden group">
            <Image
              src="https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1600&q=80"
              alt="Signature Graphic Artworks"
              fill
              className="object-cover object-top group-hover:scale-102 transition-transform duration-700"
              sizes="(max-width: 1024px) 100vw, 60vw"
            />
            <div className="absolute top-4 left-4 bg-black text-white text-[10px] uppercase font-mono tracking-widest px-2.5 py-1">
              ARTWORK FOCUS
            </div>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <span className="text-[11px] uppercase tracking-widest font-mono text-neutral-500 font-bold">
              Original Graphic Direction
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight leading-[0.95] font-editorial">
              SIGNATURE GRAPHIC COLLECTION.
            </h2>
            <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
              We design artworks that tell unscripted stories. From full-bleed back prints to subtle front insignia, our graphic tees use specialized high-density plastisol and discharge print inks that become one with the cotton fabric.
            </p>
            <div className="space-y-3 pt-2 text-xs uppercase font-bold tracking-wider text-neutral-800">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-black" />
                <span>Dual-pass silkscreen craftsmanship</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-black" />
                <span>Zero-crack plastisol and tactile puff accents</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-black" />
                <span>Pre-washed to eliminate shrinkage</span>
              </div>
            </div>
            <div className="pt-2">
              <Link
                href="/collections/graphic-tees"
                className="inline-flex items-center gap-2 px-8 py-4 bg-[#111111] hover:bg-black text-white text-xs uppercase tracking-widest font-black transition-colors"
              >
                <span>SHOP GRAPHICS</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION E: THE OVERSIZED EDIT */}
      <section className="py-16 md:py-24 bg-[#111111] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 sm:mb-12">
            <div>
              <span className="text-[11px] uppercase tracking-widest font-mono text-[#B8FF3B] font-bold block mb-1">
                ENGINEERED PROPORTIONS
              </span>
              <h2 className="text-3xl sm:text-5xl font-black uppercase tracking-tight font-editorial text-white">
                THE OVERSIZED EDIT
              </h2>
              <p className="text-xs sm:text-sm text-neutral-400 mt-2 max-w-lg">
                Generous drop shoulders, elongated sleeves, and a substantial 260 GSM torso cut for an effortless boxy drape that never clings.
              </p>
            </div>
            <Link
              href="/collections/oversized-tees"
              className="text-xs uppercase tracking-widest font-black text-[#B8FF3B] hover:underline flex items-center gap-1.5 mt-4 md:mt-0"
            >
              <span>SHOP OVERSIZED</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {oversizedPicks.map((product) => (
              <div key={product.id} className="bg-neutral-900 border border-neutral-800">
                <ProductGrid products={[product]} columns={2} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION F: ESSENTIALS (CLEAN MINIMAL BASICS) */}
      <section className="py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
          <span className="text-[11px] uppercase tracking-widest font-mono text-neutral-500 font-bold">
            TIMELESS FOUNDATIONS
          </span>
          <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight font-editorial">
            THE RAW ESSENTIALS
          </h2>
          <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
            Ultra-heavyweight 280 GSM combed cotton in monochrome tones. No unnecessary noise — just clean lines, Lycra ribbed necklines, and unmatched daily comfort.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
          {essentialPicks.map((product) => (
            <div key={product.id} className="border border-neutral-200 p-2 sm:p-4 bg-white">
              <ProductGrid products={[product]} columns={2} />
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <Link
            href="/collections/essentials"
            className="inline-flex items-center gap-2 px-8 py-3.5 border-2 border-black hover:bg-black hover:text-white text-xs uppercase tracking-widest font-black transition-colors"
          >
            <span>EXPLORE ESSENTIALS</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* SECTION G: BRAND MANIFESTO */}
      <section className="py-20 md:py-32 bg-[#F5F4F0] border-y border-neutral-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6">
          <span className="text-xs uppercase tracking-widest font-mono text-neutral-500 font-bold">
            RIGHTNOWLIFE MANIFESTO
          </span>
          <blockquote className="text-2xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight leading-tight font-editorial text-neutral-900">
            “Right now is yours. The way you move, what you create, and what you choose to wear. RightNowLife is built around everyday expression — T-shirts designed to be part of your story.”
          </blockquote>
          <p className="text-xs sm:text-sm text-neutral-600 max-w-lg mx-auto leading-relaxed">
            Crafted in limited drops with heavy-duty construction. We focus solely on T-shirts, refining the fit, weight, and artwork with obsessive dedication.
          </p>
          <div className="pt-4">
            <Link
              href="/about"
              className="text-xs uppercase tracking-widest font-black text-black underline underline-offset-4 hover:opacity-75"
            >
              READ OUR STORY
            </Link>
          </div>
        </div>
      </section>

      {/* BRAND VALUES / TRUST */}
      <section className="py-12 bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3">
              <div className="p-2.5 bg-neutral-100 rounded-full text-black shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider font-bold text-neutral-900">
                  Custom Milled Cotton
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  240 to 280 GSM combed jersey with zero-curl ribbed collars.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3">
              <div className="p-2.5 bg-neutral-100 rounded-full text-black shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider font-bold text-neutral-900">
                  Pan-India Air Dispatch
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  Express air courier with real-time tracking on all orders.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3">
              <div className="p-2.5 bg-neutral-100 rounded-full text-black shrink-0">
                <Repeat className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider font-bold text-neutral-900">
                  Hassle-Free Size Swaps
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  Easy size exchanges if your silhouette doesn&apos;t sit right.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3">
              <div className="p-2.5 bg-neutral-100 rounded-full text-black shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider font-bold text-neutral-900">
                  Razorpay Secure Checkout
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  UPI, Cards, and NetBanking preview integration.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION H: INSTAGRAM-INSPIRED EDITORIAL GRID */}
      <section className="py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8">
          <div>
            <span className="text-[11px] uppercase tracking-widest font-mono text-neutral-500 font-bold block mb-1">
              COMMUNITY & MOOD
            </span>
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight font-editorial">
              TAG @RIGHTNOWLIFE
            </h2>
          </div>
          <span className="text-xs text-neutral-500 mt-2 sm:mt-0 font-mono">
            #WearWhatYouFeel #RightNowLife
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {INSTAGRAM_GRID.map((item) => (
            <div
              key={item.id}
              className="group relative aspect-square bg-neutral-100 overflow-hidden cursor-pointer"
            >
              <Image
                src={item.image}
                alt={item.tag}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 text-center text-white">
                <span className="text-[10px] font-mono text-[#B8FF3B]">{item.handle}</span>
                <span className="text-[9px] uppercase tracking-wider mt-1 text-neutral-300">
                  {item.tag}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </StoreLayout>
  );
}
