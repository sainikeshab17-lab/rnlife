import React from "react";
import { notFound } from "next/navigation";
import { PRODUCTS } from "@/data/mock-data";
import { productService } from "@/services/product-service";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { ProductDetailsClient } from "./ProductDetailsClient";
import { getConfiguredProductGenders } from "@/services/product-genders";

export const dynamic = "force-dynamic";

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

  let genders: Awaited<ReturnType<typeof getConfiguredProductGenders>> = [];
  let genderOptionsError = false;
  try {
    genders = await getConfiguredProductGenders(product.slug);
  } catch (error) {
    genderOptionsError = true;
    console.error(`[product-page] Unable to load gender options for ${product.slug}.`, error);
  }
  const storefrontProduct = { ...product, genders, genderOptionsError };

  const relatedProducts = await productService.getRelatedProducts(product.id, 4);

  return (
    <StoreLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumbs
          items={[
            { label: "Shop", href: "/shop" },
            {
              label: storefrontProduct.fit + " Tees",
              href: `/shop?fit=${encodeURIComponent(storefrontProduct.fit)}`,
            },
            { label: storefrontProduct.name },
          ]}
        />

        <ProductDetailsClient product={storefrontProduct} relatedProducts={relatedProducts} />
      </div>
    </StoreLayout>
  );
}
