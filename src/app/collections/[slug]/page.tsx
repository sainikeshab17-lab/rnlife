import React from "react";
import { notFound } from "next/navigation";
import Image from "next/image";
import { COLLECTIONS, PRODUCTS } from "@/data/mock-data";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { CollectionClientView } from "./CollectionClientView";

interface CollectionPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return COLLECTIONS.map((c) => ({
    slug: c.slug,
  }));
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { slug } = await params;
  const collection = COLLECTIONS.find((c) => c.slug === slug);

  if (!collection) {
    notFound();
  }

  const initialProducts = PRODUCTS.filter((p) => p.collectionSlug === collection.slug);

  return (
    <StoreLayout>
      {/* Collection Hero Campaign Header */}
      <div className="relative w-full h-72 sm:h-96 bg-[#111111] text-white flex items-center overflow-hidden">
        <Image
          src={collection.heroImage}
          alt={collection.title}
          fill
          priority
          className="object-cover object-center opacity-40 scale-105"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="max-w-2xl space-y-2">
            <span className="text-[11px] uppercase tracking-widest-custom font-mono text-[#B8FF3B] font-bold">
              CURATED COLLECTION
            </span>
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black uppercase tracking-tight font-editorial">
              {collection.title}
            </h1>
            <p className="text-xs sm:text-sm text-neutral-300 max-w-lg leading-relaxed">
              {collection.description}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumbs
          items={[
            { label: "Collections", href: "/shop" },
            { label: collection.name },
          ]}
        />

        <CollectionClientView
          collection={collection}
          initialProducts={initialProducts}
        />
      </div>
    </StoreLayout>
  );
}
