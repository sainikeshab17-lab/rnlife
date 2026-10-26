"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Search,
  ExternalLink,
  ShieldAlert,
  RefreshCcw,
  Loader2,
  Check,
  X,
  Eye,
  EyeOff,
  Edit,
  Save,
  Lock,
} from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { formatINR } from "@/lib/utils";
import { PRODUCTS } from "@/data/mock-data";
import type { Product } from "@/types";

interface AdminProduct {
  id: string;
  slug: string;
  storefront_slug: string | null;
  name: string;
  sku: string;
  price: number;
  fit: string;
  image: string;
  description: string;
  is_active: boolean;
  genders?: Array<"Men" | "Women" | "Unisex">;
  updated_by: string | null;
  updated_at: string | null;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [productsLoadError, setProductsLoadError] = useState(false);
  const [search, setSearch] = useState("");
  const [fitFilter, setFitFilter] = useState("all");

  // Editing description state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [savingDesc, setSavingDesc] = useState(false);
  const [savingGenderId, setSavingGenderId] = useState<string | null>(null);
  const [savingMappingId, setSavingMappingId] = useState<string | null>(null);
  const [creatingRecordId, setCreatingRecordId] = useState<string | null>(null);
  const [pendingStorefrontSlug, setPendingStorefrontSlug] = useState<Record<string, string>>({});
  const [candidateSelection, setCandidateSelection] = useState<Record<string, string>>({});

  const fetchProducts = async () => {
    setLoading(true);
    setProductsLoadError(false);
    try {
      const res = await fetch("/api/admin/products");
      if (!res.ok) throw new Error("Failed to load products");
      const data = await res.json();
      setProducts(data.products);
    } catch (err) {
      console.error(err);
      setProductsLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const toggleVisibility = async (productId: string, currentActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/products?id=${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !currentActive }),
      });
      if (!res.ok) throw new Error("Failed to update visibility");
      await fetchProducts();
    } catch (err: any) {
      alert(err?.message || "Failed to toggle product visibility");
    }
  };

  const handleSaveDescription = async (productId: string) => {
    setSavingDesc(true);
    try {
      const res = await fetch(`/api/admin/products?id=${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ custom_description: editDesc }),
      });
      if (!res.ok) throw new Error("Failed to update description");
      setEditingId(null);
      await fetchProducts();
    } catch (err: any) {
      alert(err?.message || "Failed to update description");
    } finally {
      setSavingDesc(false);
    }
  };

  const toggleGender = async (product: AdminProduct, gender: "Men" | "Women" | "Unisex") => {
    setSavingGenderId(product.id);
    const current = product.genders ?? [];
    const genders = current.includes(gender) ? current.filter((value) => value !== gender) : [...current, gender];
    try {
      const response = await fetch(`/api/admin/products?id=${encodeURIComponent(product.id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ genders }),
      });
      if (!response.ok) throw new Error("Failed to update gender options. Apply the gender migration first.");
      await fetchProducts();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to update gender options.");
    } finally {
      setSavingGenderId(null);
    }
  };

  const saveStorefrontMapping = async (product: AdminProduct) => {
    const storefrontSlug = pendingStorefrontSlug[product.id] ?? product.storefront_slug ?? "";
    if (storefrontSlug && !window.confirm(`Link database product ${product.name} (${product.slug}) to storefront slug ${storefrontSlug}? This changes only its storefront mapping.`)) return;
    setSavingMappingId(product.id);
    try {
      const response = await fetch(`/api/admin/products?id=${encodeURIComponent(product.id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storefront_slug: storefrontSlug || null }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Unable to save storefront mapping.");
      }
      await fetchProducts();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to save storefront mapping.");
    } finally {
      setSavingMappingId(null);
    }
  };

  const linkCandidate = async (storefrontProduct: Product, databaseProduct: AdminProduct) => {
    if (!window.confirm(`Link ${databaseProduct.name} (${databaseProduct.slug}, SKU ${databaseProduct.sku}) to ${storefrontProduct.slug}? Only the storefront mapping will change.`)) return;
    setSavingMappingId(databaseProduct.id);
    try {
      const response = await fetch(`/api/admin/products?id=${encodeURIComponent(databaseProduct.id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storefront_slug: storefrontProduct.slug }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to link this product.");
      await fetchProducts();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to link this product.");
    } finally {
      setSavingMappingId(null);
    }
  };

  const createStorefrontRecord = async (storefrontProduct: Product) => {
    const candidates = products.filter((row) => row.slug === storefrontProduct.slug || row.storefront_slug === storefrontProduct.slug || row.sku?.toUpperCase() === storefrontProduct.sku.toUpperCase() || row.name.trim().toLowerCase() === storefrontProduct.name.trim().toLowerCase());
    if (candidates.length) {
      alert(`Possible existing database match found: ${candidates.map((row) => `${row.name} (${row.slug}, SKU ${row.sku})`).join("; ")}. Link that record instead of creating a duplicate.`);
      return;
    }
    const confirmed = window.confirm(`Create an inactive database product record from the existing storefront details for ${storefrontProduct.name}?\n\nSlug: ${storefrontProduct.slug}\nSKU: ${storefrontProduct.sku}\nPrice: ${formatINR(storefrontProduct.price)}\n\nThis does not activate the record or change inventory or existing orders. Gender options remain empty until you configure them below.`);
    if (!confirmed) return;
    setCreatingRecordId(storefrontProduct.id);
    try {
      const response = await fetch("/api/admin/products", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: storefrontProduct.name, slug: storefrontProduct.slug, description: storefrontProduct.description,
          category: storefrontProduct.category, sku: storefrontProduct.sku, price: storefrontProduct.price,
          collection_slug: storefrontProduct.collectionSlug, tagline: storefrontProduct.tagline,
          fit: storefrontProduct.fit, gsm: storefrontProduct.gsm, sleeve: storefrontProduct.sleeve,
          neck: storefrontProduct.neck, fabric_composition: storefrontProduct.fabricComposition,
          print_technique: storefrontProduct.printTechnique ?? null,
          compare_at_price: storefrontProduct.compareAtPrice ?? null,
          images: storefrontProduct.colors.flatMap((color) => color.images),
          sizes: storefrontProduct.sizes, colors: storefrontProduct.colors.map((color) => color.name),
          color_variants: storefrontProduct.colors.map((color) => ({ name: color.name, hex: color.hex })),
          genders: [], stock: 0, is_active: false,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to create storefront record.");
      setPendingStorefrontSlug((previous) => ({ ...previous, [result.product.id]: storefrontProduct.slug }));
      await fetchProducts();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to create storefront record.");
    } finally {
      setCreatingRecordId(null);
    }
  };

  const filtered = products.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase());
    const matchFit = fitFilter === "all" || p.fit === fitFilter;
    return matchSearch && matchFit;
  });

  return (
    <AdminLayout
      title="Global Product Catalog"
      subtitle="Complete oversight of the eight authentic RIGHTNOWLIFE streetwear silhouettes. Selling price is strictly locked at ₹999 on the server."
      actions={
        <button
          onClick={fetchProducts}
          disabled={loading}
          className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-xs font-bold uppercase tracking-wider text-neutral-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      }
    >
      <div className="bg-white border border-neutral-200 shadow-sm space-y-4">
        {/* Notice of Locked Pricing */}
        <div className="p-4 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-neutral-700">
            <Lock className="w-4 h-4 text-emerald-700 flex-shrink-0" />
            <span>
              <strong>Brand Pricing Integrity:</strong> All 8 designs sell for strictly{" "}
              <strong>₹999</strong>. Price tampering is prevented at the database and API level.
            </span>
          </div>
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
            Enforced
          </span>
        </div>

        {/* Search & Filters */}
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-neutral-200">
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name or SKU..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
            />
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold text-neutral-500">Fit Silhouette:</span>
            <select
              value={fitFilter}
              onChange={(e) => setFitFilter(e.target.value)}
              className="px-3 py-2 border border-neutral-300 text-xs font-bold uppercase bg-white outline-none cursor-pointer"
            >
              <option value="all">All Fits</option>
              <option value="Regular">Regular</option>
              <option value="Oversized">Oversized</option>
              <option value="Relaxed">Relaxed</option>
            </select>
          </div>
        </div>

        {loading ? <p role="status" className="border-b border-neutral-200 p-4 text-xs text-neutral-500">Checking database records before allowing product reconciliation…</p> : productsLoadError ? <p role="alert" className="border-b border-red-200 bg-red-50 p-4 text-xs text-red-800">Database products could not be loaded. Reconciliation and record creation are disabled until the list can be verified.</p> : <section aria-labelledby="storefront-reconciliation-title" className="border-b border-neutral-200 bg-amber-50/60 p-4 sm:p-5">
          <h3 id="storefront-reconciliation-title" className="text-xs font-black uppercase tracking-widest text-neutral-900">Storefront product reconciliation</h3>
          <p className="mt-1 max-w-4xl text-[11px] leading-relaxed text-neutral-600">Link an existing database row without changing its slug, price, images, inventory, or order history. If no matching row exists, an admin can create an inactive record from the canonical storefront details; this does not populate the inventory table.</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {PRODUCTS.map((storefrontProduct) => {
              const linked = products.find((row) => row.slug === storefrontProduct.slug || row.storefront_slug === storefrontProduct.slug);
              const candidates = products.filter((row) => row.slug !== storefrontProduct.slug && row.storefront_slug !== storefrontProduct.slug && (row.sku?.toUpperCase() === storefrontProduct.sku.toUpperCase() || row.name.trim().toLowerCase() === storefrontProduct.name.trim().toLowerCase()));
              return <div key={storefrontProduct.id} className="flex flex-col gap-2 border border-neutral-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-bold text-neutral-900">{storefrontProduct.name}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-neutral-500">{storefrontProduct.slug} · {storefrontProduct.sku}</p>
                  {linked ? <p className="mt-1 text-[10px] text-emerald-800">Linked to database slug: {linked.slug}</p> : candidates.length ? <p className="mt-1 text-[10px] text-amber-800">Possible match: {candidates.map((row) => `${row.name} (${row.slug})`).join(", ")}. Link the existing row below.</p> : <p className="mt-1 text-[10px] text-neutral-500">No exact slug, name, or SKU match found.</p>}
                </div>
                {!linked && candidates.length > 0 && <div className="flex shrink-0 items-center gap-1.5">
                  <select aria-label={`Existing database match for ${storefrontProduct.name}`} value={candidateSelection[storefrontProduct.id] ?? ""} onChange={(event) => setCandidateSelection((previous) => ({ ...previous, [storefrontProduct.id]: event.target.value }))} className="max-w-56 border border-neutral-300 bg-white px-2 py-2 text-[10px]">
                    <option value="">Choose existing record</option>
                    {candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.slug} · {candidate.sku}</option>)}
                  </select>
                  <button type="button" disabled={!candidateSelection[storefrontProduct.id] || savingMappingId === candidateSelection[storefrontProduct.id]} onClick={() => { const candidate = candidates.find((row) => row.id === candidateSelection[storefrontProduct.id]); if (candidate) void linkCandidate(storefrontProduct, candidate); }} className="border border-neutral-900 px-2 py-2 text-[10px] font-bold uppercase disabled:opacity-50">Link</button>
                </div>}
                {!linked && candidates.length === 0 && <button type="button" disabled={creatingRecordId === storefrontProduct.id} onClick={() => void createStorefrontRecord(storefrontProduct)} className="shrink-0 border border-neutral-900 px-3 py-2 text-[10px] font-bold uppercase tracking-wide disabled:opacity-50">{creatingRecordId === storefrontProduct.id ? "Creating…" : "Review & Create Draft Record"}</button>}
              </div>;
            })}
          </div>
        </section>}

        {/* Product Cards List */}
        {loading ? (
          <div className="py-16 text-center text-neutral-400">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-neutral-400" />
            <p className="text-xs font-bold uppercase tracking-wider">Loading product catalog...</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-200">
            {filtered.map((product) => (
              <div key={product.id} className="p-5 hover:bg-neutral-50/50 transition-colors">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-neutral-100 border border-neutral-200 relative flex-shrink-0">
                      {product.image && (
                        <Image
                          src={product.image}
                          alt={product.name}
                          fill
                          className="object-cover"
                        />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold uppercase text-black">{product.name}</h4>
                        <span
                          className={`text-[9px] uppercase font-bold px-1.5 py-0.5 border ${
                            product.is_active
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                              : "bg-neutral-100 text-neutral-500 border-neutral-300"
                          }`}
                        >
                          {product.is_active ? "Active on Storefront" : "Deactivated / Hidden"}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-neutral-500 uppercase mt-0.5">
                        SKU: {product.sku} • Silhouette: {product.fit}
                      </p>
                      <span className="text-xs font-mono font-bold text-black block mt-1">
                        Locked Retail Price: {formatINR(product.price)}
                      </span>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-label={`Gender options for ${product.name}`}>
                        <span className="text-[10px] font-bold uppercase tracking-wider mr-1">Gender</span>
                        {(["Men", "Women", "Unisex"] as const).map((gender) => {
                          const selected = (product.genders ?? []).includes(gender);
                          return <button key={gender} type="button" disabled={savingGenderId === product.id} aria-pressed={selected} onClick={() => void toggleGender(product, gender)} className={`px-2 py-1 text-[10px] uppercase font-bold border ${selected ? "bg-black text-white border-black" : "bg-white text-neutral-700 border-neutral-300 hover:border-black"}`}>{gender}</button>;
                        })}
                        {(product.genders ?? []).length === 0 && <span className="text-[10px] text-neutral-500">No selector</span>}
                      </div>
                      <div className="mt-2 flex flex-wrap items-end gap-2">
                        <label className="flex flex-col gap-1 text-[9px] font-bold uppercase tracking-wide text-neutral-500">
                          Storefront product mapping
                          <select aria-label={`Storefront mapping for ${product.name}`} value={pendingStorefrontSlug[product.id] ?? product.storefront_slug ?? (PRODUCTS.some((item) => item.slug === product.slug) ? product.slug : "")} onChange={(event) => setPendingStorefrontSlug((previous) => ({ ...previous, [product.id]: event.target.value }))} className="min-w-56 border border-neutral-300 bg-white px-2 py-1.5 text-[10px] font-medium text-neutral-900">
                            <option value="">Not linked</option>
                            {PRODUCTS.map((storefrontProduct) => <option key={storefrontProduct.id} value={storefrontProduct.slug} disabled={products.some((row) => row.id !== product.id && (row.slug === storefrontProduct.slug || row.storefront_slug === storefrontProduct.slug))}>{storefrontProduct.name} · {storefrontProduct.slug}</option>)}
                          </select>
                        </label>
                        <button type="button" disabled={savingMappingId === product.id} onClick={() => void saveStorefrontMapping(product)} className="border border-neutral-300 px-2 py-1.5 text-[10px] font-bold uppercase disabled:opacity-50">{savingMappingId === product.id ? "Saving…" : "Save Mapping"}</button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Link
                      href={`/products/${product.slug}`}
                      target="_blank"
                      className="px-2.5 py-1.5 border border-neutral-300 hover:border-black text-xs font-bold uppercase tracking-wider text-neutral-700 flex items-center gap-1"
                    >
                      <span>Storefront View</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>

                    <button
                      onClick={() => toggleVisibility(product.id, product.is_active)}
                      className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors ${
                        product.is_active
                          ? "bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300"
                          : "bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300"
                      }`}
                    >
                      {product.is_active ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Deactivate</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>Activate</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => {
                        if (editingId === product.id) {
                          setEditingId(null);
                        } else {
                          setEditingId(product.id);
                          setEditDesc(product.description);
                        }
                      }}
                      className="px-3 py-1.5 bg-black hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>{editingId === product.id ? "Close Edit" : "Edit Copy"}</span>
                    </button>
                  </div>
                </div>

                {/* Inline Description Editor */}
                {editingId === product.id ? (
                  <div className="mt-4 pt-3 border-t border-neutral-200 space-y-3 bg-neutral-50 p-4 border">
                    <label className="block text-[11px] uppercase font-bold text-neutral-700 tracking-wider">
                      Product Description / Marketing Copy:
                    </label>
                    <textarea
                      rows={3}
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      className="w-full p-2.5 text-xs border border-neutral-300 focus:border-black outline-none font-medium bg-white"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSaveDescription(product.id)}
                        disabled={savingDesc}
                        className="px-4 py-2 bg-black hover:bg-neutral-800 text-white text-xs uppercase font-bold tracking-wider cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{savingDesc ? "Saving..." : "Save Copy"}</span>
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-2 border border-neutral-300 text-xs uppercase font-bold text-neutral-700 hover:bg-neutral-100 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-neutral-600 line-clamp-2">{product.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
