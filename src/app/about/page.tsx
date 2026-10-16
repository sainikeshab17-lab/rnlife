"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Layers, Award, Sparkles } from "lucide-react";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { BRAND_INFO } from "@/data/mock-data";

export default function AboutPage() {
  return (
    <StoreLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumbs items={[{ label: "About RightNowLife" }]} />

        {/* Hero Section */}
        <div className="py-12 sm:py-16 text-center max-w-3xl mx-auto space-y-4">
          <span className="text-[11px] uppercase tracking-widest-custom font-mono text-neutral-500 font-bold">
            INDEPENDENT STREETWEAR LABEL
          </span>
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black uppercase tracking-tight font-editorial">
            BUILT AROUND EVERYDAY EXPRESSION.
          </h1>
          <p className="text-sm sm:text-base text-neutral-600 leading-relaxed max-w-2xl mx-auto">
            {BRAND_INFO.aboutStory}
          </p>
        </div>

        {/* Large Editorial Image Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-8">
          <div className="relative aspect-[4/3] bg-neutral-100 overflow-hidden">
            <Image
              src="https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=1200&q=80"
              alt="Streetwear Culture"
              fill
              className="object-cover object-top"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
          <div className="relative aspect-[4/3] bg-neutral-100 overflow-hidden">
            <Image
              src="https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1200&q=80"
              alt="Graphic Print Craftsmanship"
              fill
              className="object-cover object-top"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
        </div>

        {/* Core Pillars */}
        <div className="py-16 border-t border-neutral-200">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight font-editorial">
              OUR PILLARS OF CRAFT
            </h2>
            <p className="text-xs text-neutral-500 mt-1">
              Every detail engineered from cotton yarn to finished garment.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 bg-[#F5F4F0] border border-neutral-200 space-y-3">
              <div className="p-2.5 bg-black text-[#B8FF3B] w-fit">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-black">
                Custom Milled 240–280 GSM
              </h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                We custom-knit our combed cotton single jersey to achieve an architectural boxy drape that holds its structure through repetitive wear and machine cycles.
              </p>
            </div>

            <div className="p-6 bg-[#F5F4F0] border border-neutral-200 space-y-3">
              <div className="p-2.5 bg-black text-[#B8FF3B] w-fit">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-black">
                Tactile Print Finishes
              </h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                From high-density 3D puff typography to zero-feel discharge water-based prints, our graphics are treated as wearable works of contemporary art.
              </p>
            </div>

            <div className="p-6 bg-[#F5F4F0] border border-neutral-200 space-y-3">
              <div className="p-2.5 bg-black text-[#B8FF3B] w-fit">
                <Award className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-black">
                Reinforced Ribbed Collars
              </h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Featuring 1.25-inch Lycra blended ribbed necklines with twin-needle collar topstitching that prevents sagging or bacon-neck distortion.
              </p>
            </div>
          </div>
        </div>

        {/* Manifesto Quote Banner */}
        <div className="my-12 p-8 sm:p-16 bg-[#111111] text-white text-center space-y-6">
          <span className="text-[10px] uppercase font-mono tracking-widest text-[#B8FF3B] font-bold">
            THE MANIFESTO
          </span>
          <blockquote className="text-xl sm:text-3xl font-black uppercase tracking-tight font-editorial max-w-3xl mx-auto leading-relaxed">
            &ldquo;{BRAND_INFO.manifesto}&rdquo;
          </blockquote>
          <div className="pt-2">
            <Link
              href="/collections/new-drops"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black hover:bg-[#B8FF3B] text-xs uppercase tracking-widest font-black transition-colors"
            >
              <span>Explore Latest Drop</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </StoreLayout>
  );
}
