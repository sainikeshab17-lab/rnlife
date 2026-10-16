import React from "react";
import { notFound } from "next/navigation";
import { PRODUCTS } from "@/data/mock-data";
import { productService } from "@/services/product-service";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { ProductDetailsClient } from "./ProductDetailsClient";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return PRODUCTS.map((p) => ({
    slug: p.slug,
  }));
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await productService.getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const relatedProducts = await productService.getRelatedProducts(product.id, 4);

  return (
    <StoreLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumbs
          items={[
            { label: "Shop", href: "/shop" },
            {
              label: product.fit + " Tees",
              href: `/shop?fit=${encodeURIComponent(product.fit)}`,
            },
            { label: product.name },
          ]}
        />

        <ProductDetailsClient product={product} relatedProducts={relatedProducts} />
      </div>
    </StoreLayout>
  );
}
