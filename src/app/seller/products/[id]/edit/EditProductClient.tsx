"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Save, CheckCircle2, ArrowLeft, RefreshCw, AlertCircle } from "lucide-react";
import { SellerLayout } from "@/components/layout/SellerLayout";
import { Product, TShirtFit } from "@/types";
import { useToast } from "@/context/toast-context";

export function EditProductClient({ initialProduct }: { initialProduct: Product }) {
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState(initialProduct.name);
  const [tagline, setTagline] = useState(initialProduct.tagline);
  const [compareAtPrice, setCompareAtPrice] = useState(
    initialProduct.compareAtPrice ? initialProduct.compareAtPrice.toString() : ""
  );
  const [fit, setFit] = useState<TShirtFit>(initialProduct.fit);
  const [gsm, setGsm] = useState(initialProduct.gsm.toString());
  const [stock, setStock] = useState(initialProduct.stock.toString());
  const [genders, setGenders] = useState<Array<"Men" | "Women" | "Unisex">>(initialProduct.genders ?? []);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleUpdate = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    setIsSaved(false);

    try {
      const payload = {
        name: name.trim(),
        tagline: tagline.trim() || null,
        price: 999, // Authoritative ₹999 price
        compare_at_price: compareAtPrice.trim() ? Number(compareAtPrice) : null,
        fit,
        gsm: Number(gsm),
        stock: Number(stock),
        genders,
      };

      const res = await fetch(`/api/seller/products?id=${encodeURIComponent(initialProduct.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update product.");
      }

      setIsSaved(true);
      toast({
        type: "success",
        title: "Product Updated",
        message: `${name} has been updated in the database.`,
      });
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to update product.";
      setErrorMessage(msg);
      toast({
        type: "error",
        title: "Update Failed",
        message: msg,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const imageSrc =
    initialProduct.colors[0]?.images[0] || "/rightnowlife-logo.png";

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
            onClick={() => void handleUpdate()}
            disabled={isSaving}
            className="px-5 py-2 bg-black hover:bg-neutral-800 text-white text-xs uppercase tracking-widest font-black transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            {isSaving ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>{isSaving ? "Saving..." : "Save Changes"}</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {isSaved && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Product details updated successfully.</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-neutral-200 p-6 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-black pb-2 border-b border-neutral-100">
                General Information
              </h3>
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-700">
                  Product Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-bold uppercase"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-700">
                  Tagline
                </label>
                <input
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-700">
                      Selling Price (₹)
                    </label>
                    <span className="text-[9px] bg-neutral-100 text-neutral-800 font-bold uppercase px-1 py-0.5 border border-neutral-300">
                      Fixed Brand Price
                    </span>
                  </div>
                  <input
                    type="number"
                    disabled
                    readOnly
                    value="999"
                    className="w-full px-3 py-2 text-xs border border-neutral-300 bg-neutral-100 font-bold font-mono cursor-not-allowed"
                  />
                  <p className="text-[10px] text-neutral-500">
                    All pieces are strictly ₹999 across the storefront.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-700">
                    Compare-At Price (₹)
                  </label>
                  <input
                    type="number"
                    value={compareAtPrice}
                    onChange={(e) => setCompareAtPrice(e.target.value)}
                    placeholder="Optional compare price"
                    className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white border border-neutral-200 p-6 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-black pb-2 border-b border-neutral-100">
                Craftsmanship & Inventory
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-700">
                    Fit
                  </label>
                  <select
                    value={fit}
                    onChange={(e) => setFit(e.target.value as TShirtFit)}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-bold uppercase"
                  >
                    <option value="Oversized">Oversized</option>
                    <option value="Relaxed">Relaxed</option>
                    <option value="Regular">Regular</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-700">
                    GSM
                  </label>
                  <input
                    type="number"
                    value={gsm}
                    onChange={(e) => setGsm(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-700">
                    Stock
                  </label>
                  <input
                    type="number"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-mono"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-700">Gender Variants (optional)</label>
                <div className="flex flex-wrap gap-2">
                  {(["Men", "Women", "Unisex"] as const).map((gender) => <button key={gender} type="button" aria-pressed={genders.includes(gender)} onClick={() => setGenders((prev) => prev.includes(gender) ? prev.filter((item) => item !== gender) : [...prev, gender])} className={`px-3 py-2 text-xs font-bold border ${genders.includes(gender) ? "bg-black text-white border-black" : "border-neutral-300 hover:border-black"}`}>{gender}</button>)}
                </div>
                <p className="text-[10px] text-neutral-500">Leave empty to keep this product gender-neutral without a selector.</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white border border-neutral-200 p-6 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-black pb-2 border-b border-neutral-100">
                Product Image
              </h3>
              <div className="relative aspect-[3/4] bg-neutral-100 border border-neutral-200 overflow-hidden">
                <Image
                  src={imageSrc}
                  alt={initialProduct.name}
                  fill
                  unoptimized
                  className="object-cover object-top"
                />
              </div>
              <p className="text-[11px] text-neutral-500 font-mono">
                {initialProduct.sku}
              </p>
            </div>
          </div>
        </div>
      </div>
    </SellerLayout>
  );
}
