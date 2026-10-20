
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Package,
  PlusCircle,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import { SellerLayout } from "@/components/layout/SellerLayout";
import { formatINR } from "@/lib/utils";

type SellerProduct = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  price: number | string;
  stock: number | null;
  is_active: boolean;
  images: string[] | null;
  collection_slug: string | null;
  created_at: string;
};

export default function SellerDashboardPage() {
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadProducts() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/seller/products", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setError("Your seller session is invalid or does not have seller access. Please sign in again.");
        } else {
          setError(result.error || "Unable to load your products.");
        }
        setProducts([]);
        return;
      }

      setProducts(Array.isArray(result.products) ? result.products : []);
    } catch {
      setError("Could not connect to the server. Check your connection and try again.");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  const publishedCount = products.filter((p) => p.is_active).length;
  const draftCount = products.filter((p) => !p.is_active).length;
  const lowStockProducts = products.filter(
    (p) => typeof p.stock === "number" && p.stock < 25
  );

  const recentProducts = useMemo(
    () =>
      [...products]
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        )
        .slice(0, 5),
    [products]
  );

  return (
    <SellerLayout
      title="Seller Dashboard"
      subtitle="Your real product catalog, publishing status, and stock alerts."
      actions={
        <Link
          href="/seller/products/new"
          className="inline-flex items-center gap-2 bg-black px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-neutral-800"
        >
          <PlusCircle className="h-4 w-4" />
          Add Product
        </Link>
      }
    >
      <div className="space-y-6">
        {error && (
          <div
            role="alert"
            className="flex flex-col gap-3 border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between"
          >
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void loadProducts()}
              className="inline-flex shrink-0 items-center gap-2 font-bold underline"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total Products"
            value={loading ? "—" : products.length}
            icon={<Package className="h-5 w-5" />}
          />
          <MetricCard
            label="Published"
            value={loading ? "—" : publishedCount}
            icon={<CheckCircle className="h-5 w-5 text-emerald-600" />}
          />
          <MetricCard
            label="Draft / Inactive"
            value={loading ? "—" : draftCount}
            icon={<Clock className="h-5 w-5" />}
          />
          <MetricCard
            label="Low Stock"
            value={loading ? "—" : lowStockProducts.length}
            icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}
            note="Fewer than 25 units"
          />
        </div>

        <section className="border border-neutral-200 bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-neutral-200 p-5">
            <div>
              <h2 className="text-sm font-black uppercase tracking-wide">
                Low Stock Alerts
              </h2>
              <p className="mt-1 text-xs text-neutral-500">
                Based on stock values returned by your database.
              </p>
            </div>
            <Link
              href="/seller/inventory"
              className="shrink-0 text-xs font-bold underline"
            >
              Inventory <ArrowRight className="inline h-3 w-3" />
            </Link>
          </div>

          {loading ? (
            <div className="p-6 text-sm text-neutral-500">Loading inventory…</div>
          ) : error ? (
            <div className="p-6 text-sm text-neutral-500">
              Stock alerts are unavailable until products load successfully.
            </div>
          ) : lowStockProducts.length === 0 ? (
            <div className="p-6 text-sm text-neutral-500">
              No low-stock products found.
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {lowStockProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{product.name}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      SKU: {product.sku || "Not assigned"}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="whitespace-nowrap border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">
                      {product.stock ?? "Unknown"} in stock
                    </span>
                    <Link
                      href="/seller/inventory"
                      className="text-xs font-bold underline"
                    >
                      Review
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="border border-neutral-200 bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-neutral-200 p-5">
            <div>
              <h2 className="text-sm font-black uppercase tracking-wide">
                Recent Products
              </h2>
              <p className="mt-1 text-xs text-neutral-500">
                The latest products saved to your seller account.
              </p>
            </div>
            <Link
              href="/seller/products"
              className="shrink-0 text-xs font-bold underline"
            >
              All Products <ArrowRight className="inline h-3 w-3" />
            </Link>
          </div>

          {loading ? (
            <div className="p-6 text-sm text-neutral-500">Loading products…</div>
          ) : error ? (
            <div className="p-6 text-sm text-neutral-500">
              Products could not be loaded. Use “Try again” above.
            </div>
          ) : recentProducts.length === 0 ? (
            <div className="p-8 text-center">
              <Package className="mx-auto h-8 w-8 text-neutral-400" />
              <p className="mt-3 text-sm font-bold">No products yet</p>
              <p className="mt-1 text-xs text-neutral-500">
                Add your first product to see it here.
              </p>
              <Link
                href="/seller/products/new"
                className="mt-4 inline-flex items-center gap-2 bg-black px-4 py-2 text-xs font-bold uppercase text-white"
              >
                <PlusCircle className="h-4 w-4" />
                Add Product
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 uppercase text-neutral-600">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Stock</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {recentProducts.map((product) => (
                    <tr key={product.id}>
                      <td className="px-4 py-3 font-bold">{product.name}</td>
                      <td className="px-4 py-3">{product.sku || "—"}</td>
                      <td className="px-4 py-3">
                        {formatINR(Number(product.price) || 0)}
                      </td>
                      <td className="px-4 py-3">{product.stock ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            product.is_active
                              ? "border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-800"
                              : "border border-neutral-200 bg-neutral-100 px-2 py-1 text-neutral-700"
                          }
                        >
                          {product.is_active ? "Published" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/seller/products/${product.id}/edit`}
                          className="font-bold underline"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </SellerLayout>
  );
}

function MetricCard({
  label,
  value,
  icon,
  note,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="space-y-3 border border-neutral-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-wide text-neutral-500">
          {label}
        </span>
        {icon}
      </div>
      <p className="font-mono text-3xl font-black">{value}</p>
      {note && <p className="text-xs text-neutral-500">{note}</p>}
    </div>
  );
}
