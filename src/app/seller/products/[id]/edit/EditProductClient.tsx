"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Save, Send, CheckCircle2, ArrowLeft } from "lucide-react";
import { SellerLayout } from "@/components/layout/SellerLayout";
import { Product, TShirtFit, TShirtSize } from "@/types";
import { useToast } from "@/context/toast-context";

export function EditProductClient({ initialProduct }: { initialProduct: Product }) {
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState(initialProduct.name);
  const [tagline, setTagline] = useState(initialProduct.tagline);
  const [price, setPrice] = useState(initialProduct.price.toString());
  const [compareAtPrice, setCompareAtPrice] = useState(
    initialProduct.compareAtPrice ? initialProduct.compareAtPrice.toString() : ""
  );
  const [fit, setFit] = useState<TShirtFit>(initialProduct.fit);
  const [gsm, setGsm] = useState(initialProduct.gsm.toString());
  const [stock, setStock] = useState(initialProduct.stock.toString());
  const [isSaved, setIsSaved] = useState(false);

  const handleUpdate = () => {
    setIsSaved(true);
    toast({
      type: "success",
      title: "Garment Updated (Demo)",
      message: `${name} modifications saved.`,
    });
  };

  return (
    <SellerLayout
      title={`Edit: ${initialProduct.name}`}
      subtitle={`SKU: ${initialProduct.sku} • Series: ${initialProduct.collectionSlug}`}
      actions={
        <div className="flex items-center gap-2">
          <Link
            href="/seller/products"
            className="px-3 py-2 border border-neutral-300 text-xs uppercase font-bold text-neutral-700 hover:text-black"
          >
            Cancel
          </Link>
          <button
            onClick={handleUpdate}
            className="px-5 py-2 bg-black hover:bg-neutral-800 text-white text-xs uppercase tracking-widest font-black transition-colors flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Changes</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {isSaved && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Garment specifications successfully updated in prototype catalog.</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 bg-white border border-neutral-200 p-6 space-y-4 shadow-sm">
            <div className="space-y-1">
              <label className="text-[11px] uppercase font-bold text-neutral-800">
                T-Shirt Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-bold uppercase"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] uppercase font-bold text-neutral-800">
                Tagline Summary
              </label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[11px] uppercase font-bold text-neutral-800">
                  Price (₹)
                </label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] uppercase font-bold text-neutral-800">
                  Compare Price (₹)
                </label>
                <input
                  type="number"
                  value={compareAtPrice}
                  onChange={(e) => setCompareAtPrice(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] uppercase font-bold text-neutral-800">
                  Total Warehouse Stock
                </label>
                <input
                  type="number"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[11px] uppercase font-bold text-neutral-800">
                  Fit Type
                </label>
                <select
                  value={fit}
                  onChange={(e) => setFit(e.target.value as TShirtFit)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-bold uppercase bg-white cursor-pointer"
                >
                  <option value="Oversized">Oversized Fit</option>
                  <option value="Relaxed">Relaxed Fit</option>
                  <option value="Regular">Regular Fit</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] uppercase font-bold text-neutral-800">
                  Fabric Weight (GSM)
                </label>
                <input
                  type="number"
                  value={gsm}
                  onChange={(e) => setGsm(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-mono"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 bg-white border border-neutral-200 p-6 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-black pb-2 border-b border-neutral-100">
              Active Visual Asset
            </h3>
            <div className="relative aspect-[3/4] bg-neutral-100 border border-neutral-200 overflow-hidden">
              <Image
                src={initialProduct.colors[0]?.images[0] || ""}
                alt={initialProduct.name}
                fill
                className="object-cover object-top"
              />
            </div>
            <Link
              href={`/products/${initialProduct.slug}`}
              target="_blank"
              className="text-xs text-black font-bold uppercase tracking-wider underline block text-center"
            >
              Preview Live Storefront View &rarr;
            </Link>
          </div>
        </div>
      </div>
    </SellerLayout>
  );
}
