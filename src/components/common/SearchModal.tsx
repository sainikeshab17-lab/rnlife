"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, X, ArrowRight, Sparkles } from "lucide-react";
import { PRODUCTS, COLLECTIONS } from "@/data/mock-data";
import { formatINR } from "@/lib/utils";
import { Product } from "@/types";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
      setQuery("");
      setResults([]);
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const q = query.toLowerCase();
    const matches = PRODUCTS.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.tagline.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)) ||
        p.fit.toLowerCase().includes(q) ||
        p.colors.some((c) => c.name.toLowerCase().includes(q))
    );
    setResults(matches);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full bg-white border-b border-neutral-200 shadow-2xl">
        <div className="max-w-4xl mx-auto px-4 py-4 md:py-6">
          <div className="flex items-center gap-3 border-b-2 border-[#111111] pb-3">
            <Search className="w-6 h-6 text-neutral-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by graphic, fit, color, GSM, or drop name..."
              className="w-full text-base md:text-xl font-medium outline-none placeholder:text-neutral-400 bg-transparent"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="text-neutral-400 hover:text-black p-1"
                aria-label="Clear query"
              >
                <X className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="text-xs uppercase tracking-wider font-semibold px-2 py-1 bg-neutral-100 hover:bg-neutral-200 rounded transition-colors text-neutral-700 shrink-0"
            >
              ESC
            </button>
          </div>

          {/* Quick suggestions when query is empty */}
          {!query && (
            <div className="py-6 space-y-6">
              <div>
                <p className="text-[11px] uppercase tracking-widest text-neutral-400 font-semibold mb-3">
                  Trending Searches
                </p>
                <div className="flex flex-wrap gap-2">
                  {["Oversized Tees", "260 GSM", "Acid Wash", "Puff Print", "Drop Shoulder", "White Tee", "Midnight District"].map(
                    (tag) => (
                      <button
                        key={tag}
                        onClick={() => setQuery(tag)}
                        className="text-xs px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 transition-colors uppercase tracking-wider"
                      >
                        {tag}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-widest text-neutral-400 font-semibold mb-3">
                  Featured Collections
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {COLLECTIONS.slice(0, 3).map((col) => (
                    <Link
                      key={col.id}
                      href={`/collections/${col.slug}`}
                      onClick={onClose}
                      className="group p-3 border border-neutral-200 hover:border-black transition-colors block"
                    >
                      <p className="text-xs font-bold uppercase tracking-wide group-hover:text-black">
                        {col.name}
                      </p>
                      <p className="text-[11px] text-neutral-500 mt-0.5 line-clamp-1">{col.tagline}</p>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Search results list */}
          {query && (
            <div className="py-6 max-h-[60vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs uppercase tracking-widest font-semibold text-neutral-500">
                  {results.length} {results.length === 1 ? "Result" : "Results"} Found
                </p>
                {results.length > 0 && (
                  <Link
                    href={`/shop?q=${encodeURIComponent(query)}`}
                    onClick={onClose}
                    className="text-xs uppercase tracking-wider font-bold text-black hover:underline flex items-center gap-1"
                  >
                    View All in Shop <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>

              {results.length === 0 ? (
                <div className="py-12 text-center text-neutral-500">
                  <Sparkles className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
                  <p className="text-sm font-medium">No T-shirts match “{query}”</p>
                  <p className="text-xs text-neutral-400 mt-1">
                    Try searching for “Oversized”, “Graphic”, “260 GSM”, or “Black”.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {results.map((product) => (
                    <Link
                      key={product.id}
                      href={`/products/${product.slug}`}
                      onClick={onClose}
                      className="flex items-center gap-3 p-2 hover:bg-neutral-50 border border-transparent hover:border-neutral-200 transition-colors group"
                    >
                      <div className="relative w-16 h-20 bg-neutral-100 shrink-0 overflow-hidden">
                        <Image
                          src={product.colors[0]?.images[0] || ""}
                          alt={product.name}
                          fill
                          className="object-cover object-top group-hover:scale-105 transition-transform duration-300"
                          sizes="64px"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 bg-neutral-100 text-neutral-700">
                            {product.fit}
                          </span>
                          <span className="text-[10px] text-neutral-400">{product.gsm} GSM</span>
                        </div>
                        <p className="text-xs font-bold uppercase tracking-tight text-neutral-900 group-hover:underline truncate mt-1">
                          {product.name}
                        </p>
                        <p className="text-xs font-semibold text-neutral-800 mt-1">
                          {formatINR(product.price)}
                          {product.compareAtPrice && (
                            <span className="ml-1.5 text-[11px] text-neutral-400 line-through">
                              {formatINR(product.compareAtPrice)}
                            </span>
                          )}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Backdrop closer */}
      <div className="flex-1" onClick={onClose} />
    </div>
  );
}
