"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Upload,
  RefreshCw,
  AlertCircle,
  Eye,
  ShieldAlert,
} from "lucide-react";
import { useToast } from "@/context/toast-context";
import { TShirtSize, TShirtFit } from "@/types";

export default function NewProductPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [collection, setCollection] = useState("new-drops");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
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
  const [selectedGenders, setSelectedGenders] = useState<Array<"Men" | "Women" | "Unisex">>([]);

  const [colors, setColors] = useState([
    { name: "Pitch Black", hex: "#111111" },
    { name: "Bone Cream", hex: "#F3EFE6" },
  ]);

  const [frontImage, setFrontImage] = useState(
    "/products/rightnowlife-designs/design_01_02_front.png"
  );
  const [backImage, setBackImage] = useState(
    "/products/rightnowlife-designs/design_01_01_couple.png"
  );

  const [isUploadingFront, setIsUploadingFront] = useState(false);
  const [isUploadingBack, setIsUploadingBack] = useState(false);
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slug || slug === slugify(name)) {
      setSlug(slugify(value));
    }
  };

  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const toggleSize = (size: TShirtSize) => {
    setSelectedSizes((previous) =>
      previous.includes(size)
        ? previous.filter((item) => item !== size)
        : [...previous, size]
    );
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "front" | "back"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === "front") setIsUploadingFront(true);
    else setIsUploadingBack(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/seller/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to upload image.");
      }

      if (type === "front") {
        setFrontImage(data.url);
      } else {
        setBackImage(data.url);
      }

      toast({
        type: "success",
        title: "Image Uploaded",
        message: `${type === "front" ? "Front" : "Back"} view image saved successfully.`,
      });
    } catch (err: unknown) {
      toast({
        type: "error",
        title: "Upload Failed",
        message: err instanceof Error ? err.message : "Could not upload image.",
      });
    } finally {
      if (type === "front") setIsUploadingFront(false);
      else setIsUploadingBack(false);
    }
  };

  const validateProduct = () => {
    const productName = name.trim();
    const productSku = sku.trim().toUpperCase();
    const productSlug = slugify(slug.trim() || productName);

    if (!productName || !productSku || !productSlug) {
      toast({
        type: "error",
        title: "Missing required fields",
        message: "Enter the product name, SKU, and slug.",
      });
      return false;
    }

    const numericCompareAtPrice = compareAtPrice.trim()
      ? Number(compareAtPrice)
      : null;
    const numericGsm = Number(gsm);
    const numericStock = Number(stock);

    if (
      numericCompareAtPrice !== null &&
      (!Number.isFinite(numericCompareAtPrice) || numericCompareAtPrice < 0)
    ) {
      toast({
        type: "error",
        title: "Invalid compare-at price",
        message: "Enter a valid price or leave this field empty.",
      });
      return false;
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
      return false;
    }

    const imageUrls = [frontImage.trim(), backImage.trim()].filter(Boolean);

    const hasInvalidImageUrl = imageUrls.some((url) => {
      if (url.startsWith("/")) return false;
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
        message: "Please upload or provide valid image URLs.",
      });
      return false;
    }

    if (selectedSizes.length === 0 || colors.length === 0) {
      toast({
        type: "error",
        title: "Missing product options",
        message: "Select at least one size and add at least one color.",
      });
      return false;
    }

    const hasInvalidColor = colors.some(
      (color) => !color.name.trim() || !/^#[0-9a-fA-F]{6}$/.test(color.hex)
    );

    if (hasInvalidColor) {
      toast({
        type: "error",
        title: "Invalid color variant",
        message: "All colors must have a name and a valid 6-digit hex code.",
      });
      return false;
    }

    return true;
  };

  const submitProduct = async (isActive: boolean) => {
    if (!validateProduct()) return;

    setIsSubmitting(true);
    setStatusMessage(null);

    const payload = {
      name: name.trim(),
      slug: slugify(slug.trim() || name.trim()),
      tagline: tagline.trim() || null,
      description: description.trim() || null,
      category: collection,
      collection_slug: collection,
      sku: sku.trim().toUpperCase(),
      price: 999, // Authoritative fixed price
      compare_at_price: compareAtPrice.trim() ? Number(compareAtPrice) : null,
      fit,
      gsm: Number(gsm),
      sleeve,
      neck,
      fabric_composition: fabricComposition,
      print_technique: printTechnique,
      images: [frontImage.trim(), backImage.trim()].filter(Boolean),
      sizes: selectedSizes,
      genders: selectedGenders,
      colors: colors.map((color) => color.name.trim()),
      color_variants: colors.map((color) => ({
        name: color.name.trim(),
        hex: color.hex,
      })),
      stock: Number(stock),
      is_active: isActive,
    };

    try {
      const response = await fetch("/api/seller/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to save the product.");
      }

      toast({
        type: "success",
        title: isActive ? "Product Published" : "Draft Saved",
        message: `${payload.name} has been saved at fixed ₹999 price.`,
      });

      router.push("/seller/products");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "An unexpected error occurred.";
      setStatusMessage(message);
      toast({
        type: "error",
        title: "Save failed",
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none transition-colors bg-white";
  const labelClass =
    "text-[11px] uppercase tracking-wider font-bold text-neutral-700";

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200">
        <div>
          <Link
            href="/seller/products"
            className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-black uppercase tracking-wider font-bold mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Products
          </Link>
          <h1 className="text-2xl font-black uppercase tracking-tight font-editorial">
            Add New Streetwear Design
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Create and publish a new graphic T-shirt at the fixed ₹999 brand price.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void submitProduct(false)}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs uppercase tracking-wider font-bold border border-neutral-300 hover:border-black disabled:opacity-50 transition-colors"
          >
            Save as Draft
          </button>
          <button
            type="button"
            onClick={() => void submitProduct(true)}
            disabled={isSubmitting}
            className="px-5 py-2 bg-black hover:bg-neutral-800 text-white text-xs uppercase tracking-wider font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            <span>{isSubmitting ? "Publishing..." : "Publish Product"}</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          role="alert"
          className="p-4 bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{statusMessage}</span>
        </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submitProduct(true);
        }}
        className="space-y-6"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            {/* Identity */}
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
                  <label className={labelClass}>URL Slug *</label>
                  <input
                    type="text"
                    required
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
                  placeholder="260 GSM drop-shoulder silhouette with tactile graphics."
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

            {/* Specifications */}
            <section className="bg-white border border-neutral-200 p-6 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-black pb-2 border-b border-neutral-100">
                2. Craftsmanship & Fit Specifications
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className={labelClass}>Fit Silhouette *</label>
                  <select
                    value={fit}
                    onChange={(event) => setFit(event.target.value as TShirtFit)}
                    className={`${inputClass} font-bold uppercase`}
                  >
                    <option value="Oversized">Oversized</option>
                    <option value="Relaxed">Relaxed</option>
                    <option value="Regular">Regular</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className={labelClass}>Fabric Weight (GSM) *</label>
                  <input
                    type="number"
                    min="100"
                    max="500"
                    value={gsm}
                    onChange={(event) => setGsm(event.target.value)}
                    className={`${inputClass} font-mono`}
                  />
                </div>

                <div className="space-y-1">
                  <label className={labelClass}>Sleeve Style</label>
                  <input
                    type="text"
                    value={sleeve}
                    onChange={(event) => setSleeve(event.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className={labelClass}>Fabric Composition</label>
                  <input
                    type="text"
                    value={fabricComposition}
                    onChange={(event) => setFabricComposition(event.target.value)}
                    className={inputClass}
                  />
                </div>

                <div className="space-y-1">
                  <label className={labelClass}>Print Technique</label>
                  <input
                    type="text"
                    value={printTechnique}
                    onChange={(event) => setPrintTechnique(event.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            </section>

            {/* Pricing & Inventory */}
            <section className="bg-white border border-neutral-200 p-6 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-black pb-2 border-b border-neutral-100">
                3. Fixed Pricing & Inventory
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className={labelClass}>Selling Price (₹) *</label>
                    <span className="text-[10px] bg-neutral-100 text-neutral-800 font-bold uppercase px-1.5 py-0.5 border border-neutral-300">
                      Fixed Brand Price
                    </span>
                  </div>
                  <input
                    type="number"
                    disabled
                    readOnly
                    value="999"
                    className={`${inputClass} font-bold bg-neutral-100 text-neutral-800 cursor-not-allowed`}
                  />
                  <p className="text-[10px] text-neutral-500">
                    All RIGHTNOWLIFE streetwear pieces are strictly ₹999.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className={labelClass}>Compare-at MRP Price (₹)</label>
                  <input
                    type="number"
                    min="999"
                    step="1"
                    placeholder="e.g. 1999"
                    value={compareAtPrice}
                    onChange={(event) => setCompareAtPrice(event.target.value)}
                    className={inputClass}
                  />
                </div>

                <div className="space-y-1">
                  <label className={labelClass}>Base SKU *</label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(event) => setSku(event.target.value)}
                    placeholder="RNL-DESIGN-09"
                    className={`${inputClass} font-mono uppercase`}
                  />
                </div>

                <div className="space-y-1">
                  <label className={labelClass}>Stock Quantity *</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={stock}
                    onChange={(event) => setStock(event.target.value)}
                    className={`${inputClass} font-mono`}
                  />
                </div>
              </div>

              {/* Sizes */}
              <div className="space-y-2 pt-2">
                <label className={`${labelClass} block`}>
                  Available Sizes *
                </label>
                <div className="flex flex-wrap gap-2">
                  {(["XS", "S", "M", "L", "XL", "XXL"] as TShirtSize[]).map(
                    (size) => (
                      <button
                        type="button"
                        key={size}
                        onClick={() => toggleSize(size)}
                        aria-pressed={selectedSizes.includes(size)}
                        className={`px-3 py-1.5 text-xs font-bold uppercase border transition-colors ${
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

              {/* Colors */}
              <div className="space-y-2 pt-2">
                <label className={`${labelClass} block`}>Gender Variants (optional)</label>
                <div className="flex flex-wrap gap-2">
                  {(["Men", "Women", "Unisex"] as const).map((gender) => <button key={gender} type="button" aria-pressed={selectedGenders.includes(gender)} onClick={() => setSelectedGenders((prev) => prev.includes(gender) ? prev.filter((item) => item !== gender) : [...prev, gender])} className={`px-3 py-2 text-xs font-bold border ${selectedGenders.includes(gender) ? "bg-black text-white border-black" : "border-neutral-300 hover:border-black"}`}>{gender}</button>)}
                </div>
                <p className="text-xs text-neutral-500">Leave empty for products without gender selection.</p>
              </div>

              {/* Colors */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className={labelClass}>Color Variants *</label>
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
                      className="h-9 w-full border border-neutral-300 cursor-pointer"
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
                      className="px-2.5 py-2 text-xs border border-neutral-300 disabled:opacity-30 hover:bg-neutral-100"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Image Upload Column */}
          <div className="lg:col-span-4 space-y-6">
            {/* Front View */}
            <section className="bg-white border border-neutral-200 p-6 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-black pb-2 border-b border-neutral-100">
                Front View Image *
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

              <div className="space-y-2">
                <input
                  ref={frontInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => void handleFileUpload(e, "front")}
                />
                <button
                  type="button"
                  onClick={() => frontInputRef.current?.click()}
                  disabled={isUploadingFront}
                  className="w-full py-2 px-3 border border-neutral-300 bg-neutral-50 hover:bg-neutral-100 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Upload className={`w-3.5 h-3.5 ${isUploadingFront ? "animate-spin" : ""}`} />
                  <span>{isUploadingFront ? "Uploading..." : "Upload Front Image"}</span>
                </button>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-neutral-500">Or Image URL / Path</label>
                  <input
                    type="text"
                    value={frontImage}
                    onChange={(event) => setFrontImage(event.target.value)}
                    className={`${inputClass} font-mono text-[11px]`}
                  />
                </div>
              </div>
            </section>

            {/* Back View */}
            <section className="bg-white border border-neutral-200 p-6 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-black pb-2 border-b border-neutral-100">
                Back / Lookbook View
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

              <div className="space-y-2">
                <input
                  ref={backInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => void handleFileUpload(e, "back")}
                />
                <button
                  type="button"
                  onClick={() => backInputRef.current?.click()}
                  disabled={isUploadingBack}
                  className="w-full py-2 px-3 border border-neutral-300 bg-neutral-50 hover:bg-neutral-100 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Upload className={`w-3.5 h-3.5 ${isUploadingBack ? "animate-spin" : ""}`} />
                  <span>{isUploadingBack ? "Uploading..." : "Upload Back Image"}</span>
                </button>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-neutral-500">Or Image URL / Path</label>
                  <input
                    type="text"
                    value={backImage}
                    onChange={(event) => setBackImage(event.target.value)}
                    className={`${inputClass} font-mono text-[11px]`}
                  />
                </div>
              </div>
            </section>
          </div>
        </div>
      </form>
    </div>
  );
}
