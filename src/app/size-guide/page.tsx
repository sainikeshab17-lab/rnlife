"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Ruler, CheckCircle, ArrowRight } from "lucide-react";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { SIZE_CHART_OVERSIZED, SIZE_CHART_RELAXED, SIZE_CHART_REGULAR } from "@/data/mock-data";
import { TShirtFit } from "@/types";

export default function SizeGuidePage() {
  const [selectedFit, setSelectedFit] = useState<TShirtFit>("Oversized");

  const currentChart =
    selectedFit === "Oversized"
      ? SIZE_CHART_OVERSIZED
      : selectedFit === "Relaxed"
      ? SIZE_CHART_RELAXED
      : SIZE_CHART_REGULAR;

  return (
    <StoreLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumbs items={[{ label: "Size Guide & Fit Manual" }]} />

        <div className="py-8 border-b border-neutral-200 max-w-3xl">
          <span className="text-[11px] uppercase tracking-widest font-mono text-neutral-500 font-bold block mb-1">
            FIT MANUAL & MEASUREMENTS
          </span>
          <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight font-editorial">
            T-SHIRT SIZE GUIDE
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 mt-2 leading-relaxed">
            All measurements are provided in centimeters (cm). Use this guide to determine the best fit for your intended silhouette drape.
          </p>
        </div>

        {/* Fit Tabs */}
        <div className="pt-8">
          <div className="flex gap-2 border-b border-neutral-200 pb-4">
            {(["Oversized", "Relaxed", "Regular"] as TShirtFit[]).map((fit) => (
              <button
                key={fit}
                onClick={() => setSelectedFit(fit)}
                className={`px-5 py-2.5 text-xs uppercase font-bold tracking-wider transition-colors ${
                  selectedFit === fit
                    ? "bg-black text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                {fit} Fit Silhouette
              </button>
            ))}
          </div>

          {/* Fit Silhouette Overview */}
          <div className="my-6 p-4 sm:p-6 bg-[#F5F4F0] border-l-4 border-black text-xs text-neutral-700 leading-relaxed max-w-3xl">
            {selectedFit === "Oversized" && (
              <div className="space-y-1.5">
                <p className="font-bold text-black uppercase">About The Oversized Fit:</p>
                <p>
                  Cut with dropped shoulder seams, elongated sleeves that hit near the elbow, and a relaxed, boxy torso. Engineered with substantial 260 GSM combed cotton so the garment holds an architectural drape without clinging.
                </p>
                <p className="font-semibold text-neutral-900">
                  Recommendation: Choose your normal size for the intended streetwear oversized look. If you prefer a closer fit, size down by one size.
                </p>
              </div>
            )}
            {selectedFit === "Relaxed" && (
              <div className="space-y-1.5">
                <p className="font-bold text-black uppercase">About The Relaxed Fit:</p>
                <p>
                  Subtly relaxed through the chest and armholes with standard shoulder placement. Perfect for casual everyday layering under work jackets or flannel overshirts.
                </p>
                <p className="font-semibold text-neutral-900">
                  Recommendation: Fits true to standard Indian sizing.
                </p>
              </div>
            )}
            {selectedFit === "Regular" && (
              <div className="space-y-1.5">
                <p className="font-bold text-black uppercase">About The Regular Fit:</p>
                <p>
                  Traditional straight-cut silhouette with tailored shoulder seams and a clean hemline. Designed for timeless minimalist wear.
                </p>
                <p className="font-semibold text-neutral-900">
                  Recommendation: Fits true to standard size.
                </p>
              </div>
            )}
          </div>

          {/* Measurements Table in CM */}
          <div className="border border-neutral-200 bg-white p-6 shadow-sm max-w-4xl overflow-x-auto">
            <h3 className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-4">
              {selectedFit.toUpperCase()} FIT GARMENT SPECIFICATIONS (CENTIMETERS)
            </h3>

            <table className="w-full text-xs text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="border-b border-neutral-300 bg-neutral-100 text-neutral-800 uppercase tracking-wider font-bold">
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Chest Width (Pit to Pit)</th>
                  <th className="py-3 px-4">Body Length</th>
                  <th className="py-3 px-4">Shoulder Width</th>
                  <th className="py-3 px-4">Sleeve Length</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 font-medium">
                {currentChart.map((row) => (
                  <tr key={row.size} className="hover:bg-neutral-50">
                    <td className="py-3 px-4 font-bold text-black font-mono">{row.size}</td>
                    <td className="py-3 px-4">{row.chestCm} cm</td>
                    <td className="py-3 px-4">{row.lengthCm} cm</td>
                    <td className="py-3 px-4">{row.shoulderCm} cm</td>
                    <td className="py-3 px-4">{row.sleeveCm} cm</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Measurement Guide */}
          <div className="mt-12 max-w-4xl border border-neutral-200 bg-white p-6 sm:p-8 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-black">
              How to Measure Your Best-Fitting T-Shirt
            </h3>
            <p className="text-xs text-neutral-600 leading-relaxed">
              We recommend laying your favorite T-shirt flat on a table and measuring with a soft tape measure:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-neutral-700 pt-2">
              <div className="p-4 bg-[#F5F4F0] border border-neutral-200 space-y-1">
                <p className="font-bold text-black uppercase">1. Chest Width</p>
                <p className="text-neutral-600">
                  Measure straight across the chest from armpit seam to armpit seam.
                </p>
              </div>
              <div className="p-4 bg-[#F5F4F0] border border-neutral-200 space-y-1">
                <p className="font-bold text-black uppercase">2. Body Length</p>
                <p className="text-neutral-600">
                  Measure straight down from the highest point of the shoulder seam to the bottom hem.
                </p>
              </div>
              <div className="p-4 bg-[#F5F4F0] border border-neutral-200 space-y-1">
                <p className="font-bold text-black uppercase">3. Shoulder Width</p>
                <p className="text-neutral-600">
                  Measure across the back from left shoulder seam to right shoulder seam.
                </p>
              </div>
              <div className="p-4 bg-[#F5F4F0] border border-neutral-200 space-y-1">
                <p className="font-bold text-black uppercase">4. Sleeve Length</p>
                <p className="text-neutral-600">
                  Measure from the top shoulder seam down to the edge of the sleeve opening.
                </p>
              </div>
            </div>

            <div className="pt-4 flex justify-between items-center border-t border-neutral-100">
              <span className="text-xs text-neutral-500">Need personal sizing advice?</span>
              <Link
                href="/contact"
                className="text-xs uppercase font-bold text-black hover:underline flex items-center gap-1"
              >
                <span>Ask Support Team</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </StoreLayout>
  );
}
