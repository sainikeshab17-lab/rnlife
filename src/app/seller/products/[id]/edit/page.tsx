import React from "react";
import { notFound } from "next/navigation";
import { productService } from "@/services/product-service";
import { EditProductClient } from "./EditProductClient";

export const dynamic = "force-dynamic";

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params;
  const product = await productService.getProductById(id);

  if (!product) {
    notFound();
  }

  return <EditProductClient initialProduct={product} />;
}
