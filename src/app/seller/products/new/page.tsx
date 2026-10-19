
"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Save,
  Send,
} from "lucide-react";
import { SellerLayout } from "@/components/layout/SellerLayout";
import { useToast } from "@/context/toast-context";
import { TShirtFit, TShirtSize } from "@/types";
import { slugify } from "@/lib/utils";

export default function AddProductPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [collection, setCollection] = useState("new-drops");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("999");
  const [compareAtPrice, setCompareAtPrice] = useState("");
  const [fit, setFit] = useState<TShirtFit>("Oversized");
  const [gsm, setGsm] = useState("260");
  const [sleeve, setSleeve] = useState("Drop Shoulder");
  const [neck, setNeck] = useState("Ribbed Collar");
  const [fabricComposition, setFabricComposition] = useState(
    "100% Super Combed Organic Cotton"
  );
  const [printTechnique, setPrintTechnique] = useState(
    "Screenprint with 3D Puff Print"
  );
  const [stock, setStock] = useState("50");
  const [sku, setSku] = useState("");

  const [selectedSizes, setSelectedSizes] = useState<TShirtSize[]>([
    "S",
    "M",
    "L",
    "XL",
  ]);

  const [colors, setColors] = useState([
    { name: "Pitch Black", hex: "#111111" },
    { name: "Bone Cream", hex: "#F3EFE6" },
  ]);

  const [frontImage, setFrontImage] = useState(
    "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=1200&q=80"
  );
  const [backImage, setBackImage] = useState(
    "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1200&q=80"
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleNameChange = (value: string) => {
    setName(value);
    setSlug(slugify(value));
  };

  const toggleSize = (size: TShirtSize) => {
    setSelectedSizes((previous) =>
      previous.includes(size)
        ? previous.filter((item) => item !== size)
        : [...previous, size]
    );
  };

  const handlePublish = async (asDraft = false) => {
    const productName = name.trim();
    const productSku = sku.trim();
    const productSlug = slugify(slug.trim() || productName);

    if (!productName || !productSku || !productSlug || !price.trim()) {
      toast({
        type: "error",
        title: "Missing required fields",
        message: "Enter the product name, price, and SKU.",
      });
      return;
    }

    const numericPrice = Number(price);
    const numericCompareAtPrice = compareAtPrice.trim()
      ? Number(compareAtPrice)
      : null;
    const numericGsm = Number(gsm);
    const numericStock = Number(stock);

    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      toast({
        type: "error",
        title: "Invalid price",
        message: "Enter a valid, non-negative price.",
      });
      return;
    }

    if (
      numericCompareAtPrice !== null &&
      (!Number.isFinite(numericCompareAtPrice) ||
        numericCompareAtPrice < 0)
    ) {
      toast({
        type: "error",
        title: "Invalid compare-at price",
        message: "Enter a valid price or leave this field empty.",
      });
      return;
    }

    if (
      !Number.isInteger(numericGsm) ||
      numericGsm < 1 ||
      numericGsm > 1000 ||
      !Number.isInteger(numericStock) ||
      numericStock < 0 ||
      numericStock > 100000
    ) {
      toast({
        type: "error",
        title: "Invalid specifications",
        message: "Check the GSM and stock values.",
      });
      return;
    }

    const imageUrls = [frontImage.trim(), backImage.trim()].filter(Boolean);

    const hasInvalidImageUrl = imageUrls.some((url) => {
      try {
        const parsedUrl = new URL(url);
        return !["http:", "https:"].includes(parsedUrl.protocol);
      } catch {
        return true;
      }
    });

    if (imageUrls.length === 0 || hasInvalidImageUrl) {
      toast({
        type: "error",
        title: "Invalid image URL",
        message: "Enter valid HTTP or HTTPS image URLs.",
      });
      return;
    }

    if (selectedSizes.length === 0 || colors.length === 0) {
      toast({
        type: "error",
        title: "Missing product options",
        message: "Select at least one size and add at least one color.",
      });
      return;
    }

    if (
      colors.some(
        (color) =>
          !color.name.trim() ||
          !/^#[0-9a-fA-F]{6}$/.test(color.hex)
      )
    ) {
      toast({
        type: "error",
        title: "Invalid color variants",
        message: "Each color needs a name and a valid hex color.",
      });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/seller/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: productName,
          slug: productSlug,
          tagline: tagline.trim() || null,
          description: description.trim() || null,
          category: "T-Shirts",
          collection_slug: collection,
          sku: productSku,
          price: numericPrice,
          compare_at_price: numericCompareAtPrice,
          fit,
          gsm: numericGsm,
          sleeve: sleeve || null,
          neck: neck || null,
          fabric_composition: fabricComposition.trim() || null,
          print_technique: printTechnique.trim() || null,
          images: imageUrls,
          sizes: selectedSizes,
          colors: colors.map((color) => color.name.trim()),
          color_variants: colors.map((color) => ({
            name: color.name.trim(),
            hex: color.hex.toUpperCase(),
          })),
          stock: numericStock,
          is_active: !asDraft,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.error || `Unable to save product (HTTP ${response.status}).`
        );
      }

      setStatusMessage(
        asDraft
          ? "Product saved successfully as a draft."
          : "Product published successfully."
      );

      toast({
        type: "success",
        title: asDraft ? "Draft Saved" : "Product Published",
        message: `${productName} has been saved to your catalog.`,
      });

      router.push("/seller/products");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong while saving the product.";

      toast({
        type: "error",
        title: "Product could not be saved",
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none";
  const labelClass = "text-[11px] uppercase font-bold text-neutral-800";

  return (
    <SellerLayout
      title="Add New T-Shirt Listing"
      subtitle="Define garment fit, GSM, print craftsmanship, and inventory matrix."
      actions={
        <div className="flex items-center gap-2">
          <Link
            href="/seller/products"
            className="px-3 py-2 border border-neutral-300 text-xs uppercase font-bold text-neutral-700 hover:text-black hover:border-black"
          >
            Cancel
          </Link>

          <button
            type="button"
            onClick={() => handlePublish(true)}
            disabled={isSubmitting}
            className="px-4 py-2 border border-black text-xs uppercase font-bold text-black hover:bg-neutral-100 disabled:opacity-50 flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSubmitting ? "Saving..." : "Save Draft"}</span>
          </button>

          <button
            type="button"
            onClick={() => handlePublish(false)}
            disabled={isSubmitting}
            className="px-5 py-2 bg-black hover:bg-neutral-800 text-white text-xs uppercase tracking-widest font-black transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSubmitting ? "Saving..." : "Publish T-Shirt"}</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {statusMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        <div className="p-3 bg-neutral-100 border border-neutral-200 text-xs text-neutral-600">
          <strong>Live Catalog:</strong> Products are saved through the
          authenticated seller API. Published products are marked active;
          drafts remain inactive.
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            <section className="bg-white border border-neutral-200 p-6 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-black pb-2 border-b border-neutral-100">
                1. Garment Identity
              </h3>

              <div className="space-y-1">
                <label className={labelClass}>Product Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(event) => handleNameChange(event.target.value)}
                  placeholder="e.g. DESIGN 09 — GRAPHIC RAGLAN TEE"
                  className={`${inputClass} font-bold uppercase`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className={labelClass}>URL Slug</label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(event) => setSlug(event.target.value)}
                    placeholder="rightnowlife-design-09"
                    className={`${inputClass} font-mono`}
                  />
                </div>

                <div className="space-y-1">
                  <label className={labelClass}>Curated Collection *</label>
                  <select
                    value={collection}
                    onChange={(event) => setCollection(event.target.value)}
                    className={`${inputClass} font-bold uppercase bg-white cursor-pointer`}
                  >
                    <option value="new-drops">New Drops (Seasonal)</option>
                    <option value="graphic-tees">Graphic Tees</option>
                    <option value="essentials">Essential Tees</option>
                    <option value="statement-prints">Statement Prints</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className={labelClass}>Tagline / Short Summary</label>
                <input
                  type="text"
                  value={tagline}
                  onChange={(event) => setTagline(event.target.value)}
                  placeholder="260 GSM drop-shoulder silhouette with puff-print typography."
                  className={`${inputClass} font-medium`}
                />
              </div>

              <div className="space-y-1">
                <label className={labelClass}>Full Garment Description</label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Describe the silhouette, print technique, inspiration, and fabric weight..."
                  className={`${inputClass} font-medium`}
                />
              </div>
            </section>

            <section className="bg-white border border-neutral-200 p-6 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-black pb-2 border-b border-neutral-100">
                2. Craftsmanship & Fit Specifications
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className={labelClass}>Fit Type *</label>
                  <select
                    value={fit}
                    onChange={(event) =>
                      setFit(event.target.value as TShirtFit)
                    }
                    className={`${inputClass} font-bold uppercase bg-white`}
                  >
                    <option value="Oversized">Oversized Fit</option>
                    <option value="Relaxed">Relaxed Fit</option>
                    <option value="Regular">Regular Fit</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className={labelClass}>Fabric GSM *</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={gsm}
                    onChange={(event) => setGsm(event.target.value)}
                    className={`${inputClass} font-mono`}
                  />
                </div>

                <div className="space-y-1">
                  <label className={labelClass}>Sleeve Silhouette</label>
                  <select
                    value={sleeve}
                    onChange={(event) => setSleeve(event.target.value)}
                    className={`${inputClass} font-bold uppercase bg-white`}
                  >
                    <option value="Drop Shoulder">Drop Shoulder</option>
                    <option value="Half Sleeve">Half Sleeve</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className={labelClass}>Neck Style</label>
                  <input
                    type="text"
                    value={neck}
                    onChange={(event) => setNeck(event.target.value)}
                    className={`${inputClass} font-medium`}
                  />
                </div>

                <div className="space-y-1">
                  <label className={labelClass}>Fabric Composition</label>
                  <input
                    type="text"
                    value={fabricComposition}
                    onChange={(event) =>
                      setFabricComposition(event.target.value)
                    }
                    className={`${inputClass} font-medium`}
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className={labelClass}>Print Technique</label>
                  <input
                    type="text"
                    value={printTechnique}
                    onChange={(event) => setPrintTechnique(event.target.value)}
                    className={`${inputClass} font-medium`}
                  />
                </div>
              </div>
            </section>

            <section className="bg-white border border-neutral-200 p-6 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-black pb-2 border-b border-neutral-100">
                3. Pricing & Inventory
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className={labelClass}>Price (₹ INR) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    className={`${inputClass} font-bold`}
                  />
                </div>

                <div className="space-y-1">
                  <label className={labelClass}>Compare-at Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={compareAtPrice}
                    onChange={(event) => setCompareAtPrice(event.target.value)}
                    className={inputClass}
                  />
                </div>

                <div className="space-y-1">
                  <label className={labelClass}>Base SKU *</label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(event) => setSku(event.target.value)}
                    placeholder="RNL-TEE-014"
                    className={`${inputClass} font-mono uppercase`}
                  />
                </div>

                <div className="space-y-1">
                  <label className={labelClass}>Stock Quantity *</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={stock}
                    onChange={(event) => setStock(event.target.value)}
                    className={`${inputClass} font-mono`}
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <label className={`${labelClass} block`}>
                  Available Sizes
                </label>
                <div className="flex flex-wrap gap-2">
                  {(["XS", "S", "M", "L", "XL", "XXL"] as TShirtSize[]).map(
                    (size) => (
                      <button
                        type="button"
                        key={size}
                        onClick={() => toggleSize(size)}
                        aria-pressed={selectedSizes.includes(size)}
                        className={`px-3 py-1.5 text-xs font-bold uppercase border ${
                          selectedSizes.includes(size)
                            ? "bg-black text-white border-black"
                            : "border-neutral-300 text-neutral-700 hover:border-black"
                        }`}
                      >
                        {size}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className={labelClass}>Color Variants</label>
                  <button
                    type="button"
                    onClick={() =>
                      setColors((previous) => [
                        ...previous,
                        { name: "", hex: "#000000" },
                      ])
                    }
                    className="text-xs font-bold uppercase underline"
                  >
                    Add Color
                  </button>
                </div>

                {colors.map((color, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[1fr_90px_auto] gap-2 items-center"
                  >
                    <input
                      type="text"
                      value={color.name}
                      aria-label={`Color ${index + 1} name`}
                      onChange={(event) =>
                        setColors((previous) =>
                          previous.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, name: event.target.value }
                              : item
                          )
                        )
                      }
                      placeholder="Color name"
                      className={inputClass}
                    />
                    <input
                      type="color"
                      value={color.hex}
                      aria-label={`Color ${index + 1} hex`}
                      onChange={(event) =>
                        setColors((previous) =>
                          previous.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, hex: event.target.value }
                              : item
                          )
                        )
                      }
                      className="h-9 w-full border border-neutral-300"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setColors((previous) =>
                          previous.filter((_, itemIndex) => itemIndex !== index)
                        )
                      }
                      disabled={colors.length === 1}
                      aria-label={`Remove color ${index + 1}`}
                      className="px-2 py-2 text-xs border border-neutral-300 disabled:opacity-30"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <section className="bg-white border border-neutral-200 p-6 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-black pb-2 border-b border-neutral-100">
                Front View Image
              </h3>
              <div className="relative aspect-[3/4] bg-neutral-100 border border-neutral-200 overflow-hidden">
                <Image
                  src={frontImage}
                  alt="Front view product preview"
                  fill
                  unoptimized
                  className="object-cover object-top"
                  sizes="(max-width: 1024px) 100vw, 33vw"
                />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Front Image URL</label>
                <input
                  type="url"
                  value={frontImage}
                  onChange={(event) => setFrontImage(event.target.value)}
                  className={`${inputClass} font-mono`}
                />
              </div>
            </section>

            <section className="bg-white border border-neutral-200 p-6 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-black pb-2 border-b border-neutral-100">
                Back View / Model Image
              </h3>
              <div className="relative aspect-[3/4] bg-neutral-100 border border-neutral-200 overflow-hidden">
                <Image
                  src={backImage}
                  alt="Back view product preview"
                  fill
                  unoptimized
                  className="object-cover object-top"
                  sizes="(max-width: 1024px) 100vw, 33vw"
                />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Back Image URL</label>
                <input
                  type="url"
                  value={backImage}
                  onChange={(event) => setBackImage(event.target.value)}
                  className={`${inputClass} font-mono`}
                />
              </div>
            </section>
          </div>
        </div>
      </div>
    </SellerLayout>
  );
}
