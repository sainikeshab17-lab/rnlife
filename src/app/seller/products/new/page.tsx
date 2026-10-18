"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Upload,
  CheckCircle2,
  AlertCircle,
  Eye,
  Save,
  Send,
  Plus,
  Trash2,
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
  const [fabricComposition, setFabricComposition] = useState("100% Super Combed Organic Cotton");
  const [printTechnique, setPrintTechnique] = useState("Screenprint with 3D Puff Print");
  const [stock, setStock] = useState("50");
  const [sku, setSku] = useState("RNL-TEE-013");

  // Selected sizes
  const [selectedSizes, setSelectedSizes] = useState<TShirtSize[]>(["S", "M", "L", "XL"]);

  // Color variants
  const [colors, setColors] = useState([
    { name: "Pitch Black", hex: "#111111" },
    { name: "Bone Cream", hex: "#F3EFE6" },
  ]);

  // Image previews
  const [frontImage, setFrontImage] = useState(
    "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=1200&q=80"
  );
  const [backImage, setBackImage] = useState(
    "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1200&q=80"
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleNameChange = (val: string) => {
    setName(val);
    setSlug(slugify(val));
  };

  const toggleSize = (size: TShirtSize) => {
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  };

  const handlePublish = (asDraft = false) => {
    if (!name || !price || !sku) {
      alert("Please fill in the product name, price, and SKU.");
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setStatusMessage(
        asDraft
          ? "Garment saved as Draft in development store."
          : "Garment published! In production, the NestJS catalog service will update live storefront index."
      );
      toast({
        type: "success",
        title: asDraft ? "Draft Saved" : "Product Published (Demo)",
        message: `${name} has been processed.`,
      });
    }, 800);
  };

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
            onClick={() => handlePublish(true)}
            disabled={isSubmitting}
            className="px-4 py-2 border border-black text-xs uppercase font-bold text-black hover:bg-neutral-100 flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Draft</span>
          </button>
          <button
            onClick={() => handlePublish(false)}
            disabled={isSubmitting}
            className="px-5 py-2 bg-black hover:bg-neutral-800 text-white text-xs uppercase tracking-widest font-black transition-colors flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSubmitting ? "Publishing..." : "Publish T-Shirt"}</span>
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

        {/* Prototype Form Notice */}
        <div className="p-3 bg-neutral-100 border border-neutral-200 text-xs text-neutral-600">
          <strong>Staff Prototype Workflow:</strong> Authorized sellers will publish directly to the catalog once the NestJS backend and database are connected in Phase 2.
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Form Fields (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* General Info Box */}
            <div className="bg-white border border-neutral-200 p-6 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-black pb-2 border-b border-neutral-100">
                1. Garment Identity
              </h3>

              <div className="space-y-1">
                <label className="text-[11px] uppercase font-bold text-neutral-800">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. DESIGN 09 — GRAPHIC RAGLAN TEE"
                  className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-bold uppercase"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] uppercase font-bold text-neutral-800">
                    URL Slug
                  </label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="rightnowlife-design-09"
                    className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] uppercase font-bold text-neutral-800">
                    Curated Collection *
                  </label>
                  <select
                    value={collection}
                    onChange={(e) => setCollection(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-bold uppercase bg-white cursor-pointer"
                  >
                    <option value="new-drops">New Drops (Seasonal)</option>
                    <option value="graphic-tees">Graphic Tees</option>
                    <option value="essentials">Essential Tees</option>
                    <option value="statement-prints">Statement Prints</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] uppercase font-bold text-neutral-800">
                  Tagline / Short Summary *
                </label>
                <input
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="260 GSM custom drop-shoulder silhouette with tactile puff-print typography."
                  className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] uppercase font-bold text-neutral-800">
                  Full Garment Description *
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the silhouette drape, print technique, inspiration, and fabric weight..."
                  className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
                />
              </div>
            </div>

            {/* Fabric & Silhouette Specifications */}
            <div className="bg-white border border-neutral-200 p-6 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-black pb-2 border-b border-neutral-100">
                2. Craftsmanship & Fit Specifications
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] uppercase font-bold text-neutral-800">
                    Fit Type *
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
                    Fabric GSM *
                  </label>
                  <input
                    type="number"
                    value={gsm}
                    onChange={(e) => setGsm(e.target.value)}
                    placeholder="260"
                    className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] uppercase font-bold text-neutral-800">
                    Sleeve Silhouette
                  </label>
                  <select
                    value={sleeve}
                    onChange={(e) => setSleeve(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-bold uppercase bg-white cursor-pointer"
                  >
                    <option value="Drop Shoulder">Drop Shoulder</option>
                    <option value="Half Sleeve">Half Sleeve</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] uppercase font-bold text-neutral-800">
                    Fabric Composition
                  </label>
                  <input
                    type="text"
                    value={fabricComposition}
                    onChange={(e) => setFabricComposition(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] uppercase font-bold text-neutral-800">
                    Print Technique
                  </label>
                  <input
                    type="text"
                    value={printTechnique}
                    onChange={(e) => setPrintTechnique(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Pricing & Stock */}
            <div className="bg-white border border-neutral-200 p-6 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-black pb-2 border-b border-neutral-100">
                3. Pricing & Inventory
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] uppercase font-bold text-neutral-800">
                    Price (₹ INR) *
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
                    Compare-at Price (₹)
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
                    Base SKU *
                  </label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-mono uppercase"
                  />
                </div>
              </div>

              {/* Sizes Checkboxes */}
              <div className="space-y-2 pt-2">
                <label className="text-[11px] uppercase font-bold text-neutral-800 block">
                  Available Sizes in Matrix
                </label>
                <div className="flex gap-2">
                  {(["XS", "S", "M", "L", "XL", "XXL"] as TShirtSize[]).map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => toggleSize(s)}
                      className={`px-3 py-1.5 text-xs font-bold uppercase border ${
                        selectedSizes.includes(s)
                          ? "bg-black text-white border-black"
                          : "border-neutral-300 text-neutral-700 hover:border-black"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Image Previews & Publishing Preview (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white border border-neutral-200 p-6 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-black pb-2 border-b border-neutral-100">
                Front View Image
              </h3>
              <div className="relative aspect-[3/4] bg-neutral-100 border border-neutral-200 overflow-hidden">
                <Image src={frontImage} alt="Front View Preview" fill className="object-cover object-top" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-neutral-500">
                  Front Image URL
                </label>
                <input
                  type="text"
                  value={frontImage}
                  onChange={(e) => setFrontImage(e.target.value)}
                  className="w-full px-2 py-1.5 text-[11px] border border-neutral-300 outline-none font-mono"
                />
              </div>
            </div>

            <div className="bg-white border border-neutral-200 p-6 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-black pb-2 border-b border-neutral-100">
                Back View / Model Image
              </h3>
              <div className="relative aspect-[3/4] bg-neutral-100 border border-neutral-200 overflow-hidden">
                <Image src={backImage} alt="Back View Preview" fill className="object-cover object-top" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-neutral-500">
                  Back Image URL
                </label>
                <input
                  type="text"
                  value={backImage}
                  onChange={(e) => setBackImage(e.target.value)}
                  className="w-full px-2 py-1.5 text-[11px] border border-neutral-300 outline-none font-mono"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </SellerLayout>
  );
}
