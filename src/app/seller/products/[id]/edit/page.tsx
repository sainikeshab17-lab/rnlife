import React from "react";
import { notFound } from "next/navigation";
import { PRODUCTS } from "@/data/mock-data";
import { productService } from "@/services/product-service";
import { EditProductClient } from "./EditProductClient";

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  return PRODUCTS.map((p) => ({
    id: p.id,
  }));
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params;
  const product = await productService.getProductById(id);

  if (!product) {
    notFound();
  }

  return <EditProductClient initialProduct={product} />;
}
