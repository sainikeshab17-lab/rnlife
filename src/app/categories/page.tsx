"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { COLLECTIONS, PRODUCTS } from "@/data/mock-data";

export default function CategoriesPage() {
  return (
    <StoreLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumbs items={[{ label: "All Collections & Series" }]} />

        <div className="pt-4 pb-8 border-b border-neutral-200">
          <span className="text-[11px] uppercase tracking-widest font-mono text-neutral-500 font-bold block mb-1">
            CURATED ARCHIVE
          </span>
          <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight font-editorial">
            COLLECTIONS & EDITS
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 mt-2 max-w-xl">
            Explore our T-shirt catalog categorized by fit silhouettes, seasonal drop themes, and graphic art direction.
          </p>
        </div>

        <div className="py-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {COLLECTIONS.map((col, idx) => {
            const count = PRODUCTS.filter((p) => p.collectionSlug === col.slug).length;
            return (
              <Link
                key={col.id}
                href={`/collections/${col.slug}`}
                className="group relative h-96 bg-neutral-900 overflow-hidden block"
              >
                <Image
                  src={col.heroImage}
                  alt={col.name}
                  fill
                  className="object-cover object-top opacity-70 group-hover:opacity-85 group-hover:scale-105 transition-all duration-700"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

                <div className="absolute inset-x-0 bottom-0 p-6 flex flex-col justify-end text-white">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-[#B8FF3B] mb-1">
                    SERIES 0{idx + 1} • {count} PIECES
                  </span>
                  <h2 className="text-2xl font-black uppercase tracking-tight font-editorial">
                    {col.name}
                  </h2>
                  <p className="text-xs text-neutral-300 line-clamp-2 mt-1">
                    {col.tagline}
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-white group-hover:text-[#B8FF3B] transition-colors">
                    <span>Explore Collection</span>
                    <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </StoreLayout>
  );
}
