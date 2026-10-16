"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Package,
  PlusCircle,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  Boxes,
} from "lucide-react";
import { SellerLayout } from "@/components/layout/SellerLayout";
import { PRODUCTS } from "@/data/mock-data";
import { formatINR } from "@/lib/utils";

export default function SellerDashboardPage() {
  const totalProducts = PRODUCTS.length;
  const publishedProducts = PRODUCTS.length; // all 12 are published in demo
  const draftProducts = 2; // sample draft count
  const lowStockProducts = PRODUCTS.filter((p) => p.stock < 25);

  return (
    <SellerLayout
      title="Seller Dashboard"
      subtitle="Brand catalog health, inventory alerts, and publishing activity."
      actions={
        <Link
          href="/seller/products/new"
          className="px-4 py-2 bg-black hover:bg-neutral-800 text-white text-xs uppercase tracking-widest font-black transition-colors flex items-center gap-1.5"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Add New T-Shirt</span>
        </Link>
      }
    >
      <div className="space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-neutral-200 p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-neutral-400">
              <span className="text-xs uppercase font-bold tracking-wider text-neutral-500">
                Total T-Shirts
              </span>
              <Package className="w-4 h-4" />
            </div>
            <p className="text-3xl font-black text-black font-mono">{totalProducts}</p>
            <p className="text-[11px] text-neutral-500">Across 5 Curated Series</p>
          </div>

          <div className="bg-white border border-neutral-200 p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-neutral-400">
              <span className="text-xs uppercase font-bold tracking-wider text-neutral-500">
                Published Live
              </span>
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-3xl font-black text-emerald-700 font-mono">
              {publishedProducts}
            </p>
            <p className="text-[11px] text-neutral-500">Active in Storefront</p>
          </div>

          <div className="bg-white border border-neutral-200 p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-neutral-400">
              <span className="text-xs uppercase font-bold tracking-wider text-neutral-500">
                Drafts
              </span>
              <Clock className="w-4 h-4 text-neutral-500" />
            </div>
            <p className="text-3xl font-black text-neutral-800 font-mono">{draftProducts}</p>
            <p className="text-[11px] text-neutral-500">Awaiting Drop Launch</p>
          </div>

          <div className="bg-white border border-neutral-200 p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-neutral-400">
              <span className="text-xs uppercase font-bold tracking-wider text-neutral-500">
                Low Stock
              </span>
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-3xl font-black text-amber-600 font-mono">
              {lowStockProducts.length}
            </p>
            <p className="text-[11px] text-neutral-500">&lt; 25 units in warehouse</p>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white border border-neutral-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
            <h3 className="text-xs font-bold uppercase tracking-wider text-black flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Low Stock Variant Warnings
            </h3>
            <Link
              href="/seller/inventory"
              className="text-xs text-neutral-600 hover:text-black underline font-semibold"
            >
              Open Inventory Matrix &rarr;
            </Link>
          </div>

          <div className="divide-y divide-neutral-100">
            {lowStockProducts.map((p) => (
              <div key={p.id} className="py-3 flex items-center justify-between text-xs gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative w-10 h-12 bg-neutral-100 shrink-0">
                    <Image src={p.colors[0].images[0]} alt={p.name} fill className="object-cover object-top" />
                  </div>
                  <div className="truncate">
                    <p className="font-bold text-black uppercase truncate">{p.name}</p>
                    <p className="text-[11px] text-neutral-500">
                      SKU: {p.sku} • {p.fit} Fit
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold uppercase">
                    {p.stock} units left
                  </span>
                  <Link
                    href={`/seller/products/${p.id}/edit`}
                    className="text-xs font-bold text-black hover:underline"
                  >
                    Restock
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Product Activity Table */}
        <div className="bg-white border border-neutral-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
            <h3 className="text-xs font-bold uppercase tracking-wider text-black">
              Recent Product Catalog Additions
            </h3>
            <Link
              href="/seller/products"
              className="text-xs text-neutral-600 hover:text-black underline font-semibold"
            >
              View All Products
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-700 uppercase font-bold">
                  <th className="py-2.5 px-3">Garment</th>
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3">Series</th>
                  <th className="py-2.5 px-3">Price</th>
                  <th className="py-2.5 px-3">Stock</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 font-medium">
                {PRODUCTS.slice(0, 5).map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-50">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="relative w-8 h-10 bg-neutral-100 shrink-0">
                          <Image src={p.colors[0].images[0]} alt={p.name} fill className="object-cover object-top" />
                        </div>
                        <span className="font-bold text-black uppercase truncate max-w-xs">{p.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-neutral-500">{p.sku}</td>
                    <td className="py-2.5 px-3 uppercase text-neutral-600">{p.collectionSlug}</td>
                    <td className="py-2.5 px-3 font-bold text-black">{formatINR(p.price)}</td>
                    <td className="py-2.5 px-3 font-mono">{p.stock}</td>
                    <td className="py-2.5 px-3 text-right">
                      <Link
                        href={`/seller/products/${p.id}/edit`}
                        className="text-xs font-bold text-black hover:underline mr-3"
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/products/${p.slug}`}
                        target="_blank"
                        className="text-xs text-neutral-500 hover:text-black underline"
                      >
                        Preview
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SellerLayout>
  );
}
