"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { PlusCircle, Layers, ExternalLink, Edit3 } from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { COLLECTIONS, PRODUCTS } from "@/data/mock-data";

export default function AdminCollectionsPage() {
  return (
    <AdminLayout
      title="Collections & Curated Drops"
      subtitle="Configure seasonal drop banners, series taglines, and associated T-shirt catalogs."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {COLLECTIONS.map((col) => {
          const count = PRODUCTS.filter((p) => p.collectionSlug === col.slug).length;
          return (
            <div
              key={col.id}
              className="border border-neutral-200 bg-white shadow-sm overflow-hidden flex flex-col justify-between"
            >
              <div className="relative h-44 bg-neutral-900">
                <Image
                  src={col.heroImage}
                  alt={col.name}
                  fill
                  className="object-cover object-top opacity-60"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-4 left-4 text-white">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-[#B8FF3B] font-bold">
                    SERIES: {col.slug}
                  </span>
                  <h3 className="text-xl font-black uppercase font-editorial">{col.name}</h3>
                </div>
              </div>

              <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <p className="text-xs font-semibold text-black uppercase">{col.title}</p>
                  <p className="text-xs text-neutral-600 mt-1 line-clamp-2">{col.description}</p>
                </div>

                <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-xs">
                  <span className="font-mono text-neutral-500 font-bold">
                    {count} Live Products
                  </span>
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/collections/${col.slug}`}
                      target="_blank"
                      className="text-xs font-bold text-black hover:underline flex items-center gap-1"
                    >
                      <span>View Live</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AdminLayout>
  );
}
