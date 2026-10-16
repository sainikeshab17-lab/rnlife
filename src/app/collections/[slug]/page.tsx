import React from "react";
import { notFound } from "next/navigation";
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumbs
          items={[
            { label: "Collections", href: "/shop" },
            { label: collection.name },
          ]}
        />

        <header className="border-b border-[#E5E5E5] py-5">
          <p className="mb-1 text-[10px] font-mono font-semibold uppercase tracking-widest text-neutral-500">Collection</p>
          <h1 className="text-3xl font-black uppercase tracking-tight sm:text-4xl">{collection.name}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">{collection.description}</p>
        </header>

        <CollectionClientView
          collection={collection}
          initialProducts={initialProducts}
        />
      </div>
    </StoreLayout>
  );
}
