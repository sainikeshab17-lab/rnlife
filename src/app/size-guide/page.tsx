"use client";

import React, { useState } from "react";
import { Ruler, CheckCircle, ArrowRight } from "lucide-react";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { SIZE_CHART_OVERSIZED, SIZE_CHART_RELAXED, SIZE_CHART_REGULAR, SIZE_CHART_INDUSTRY_REFERENCE } from "@/data/mock-data";
import { SUPPORT_EMAIL } from "@/lib/support-contact";
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
            SIZE GUIDE — FIND YOUR PERFECT FIT
          </span>
          <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight font-editorial">
            T-SHIRT SIZE GUIDE
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 mt-2 leading-relaxed">
            All measurements are provided in centimeters (cm). Use this guide to determine the best fit for your intended silhouette drape.
          </p>
        </div>

        <section aria-labelledby="choose-fit-title" className="mt-8 max-w-4xl">
          <h2 id="choose-fit-title" className="text-sm font-bold uppercase tracking-wider">Choose Your Fit</h2>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs leading-relaxed">
            <div className="border border-neutral-200 bg-white p-4">
              <h3 className="font-bold uppercase tracking-wide">Regular Fit</h3>
              <p className="mt-2 text-neutral-600">A classic, standard silhouette.</p>
            </div>
            <div className="border border-neutral-200 bg-white p-4">
              <h3 className="font-bold uppercase tracking-wide">Relaxed Fit</h3>
              <p className="mt-2 text-neutral-600">Extra room through the chest and body for everyday comfort.</p>
            </div>
            <div className="border border-neutral-200 bg-white p-4">
              <h3 className="font-bold uppercase tracking-wide">Oversized Fit</h3>
              <p className="mt-2 text-neutral-600">A wider, boxier silhouette with dropped shoulders. Choose your usual size for the intended oversized look, or size down for a closer fit.</p>
            </div>
          </div>
        </section>

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
                  The proposed chart describes a roomier silhouette. Physical production measurements have not yet been confirmed.
                </p>
                <p className="font-semibold text-neutral-900">
                  Compare the garment measurements with a T-shirt that fits you well before choosing.
                </p>
              </div>
            )}
            {selectedFit === "Relaxed" && (
              <div className="space-y-1.5">
                <p className="font-bold text-black uppercase">About The Relaxed Fit:</p>
                <p>
                  The proposed chart describes a more relaxed silhouette. Physical production measurements have not yet been confirmed.
                </p>
                <p className="font-semibold text-neutral-900">
                  Compare the garment measurements with a T-shirt that fits you well before choosing.
                </p>
              </div>
            )}
            {selectedFit === "Regular" && (
              <div className="space-y-1.5">
                <p className="font-bold text-black uppercase">About The Regular Fit:</p>
                <p>
                  The proposed chart describes a regular silhouette. Physical production measurements have not yet been confirmed.
                </p>
                <p className="font-semibold text-neutral-900">
                  Compare the garment measurements with a T-shirt that fits you well before choosing.
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
                    <td className="py-3 px-4">{row.sleeveCm}* cm</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 max-w-4xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-950">
            These are proposed chart values and have not been physically verified against production garments. Chest widths were estimated by halving circumference-equivalent figures. Sleeve measurements marked * are estimates from screenshots. Please confirm the figures against real garments before relying on them.
          </p>

          <section aria-labelledby="please-note-title" className="mt-6 max-w-4xl border border-neutral-200 bg-neutral-50 p-5 sm:p-6 text-xs leading-relaxed">
            <h2 id="please-note-title" className="font-bold uppercase tracking-wider">Please Note</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-neutral-700">
              <li>All garment measurements are provided in centimetres (cm).</li>
              <li>Chest width is measured flat from armpit to armpit, not around the body.</li>
              <li>Measurements may vary slightly between garments due to manufacturing.</li>
              <li>If you are between sizes, consider your preferred fit and compare the measurements with a T-shirt you already own.</li>
            </ul>
          </section>

          <section className="mt-12 max-w-4xl border border-neutral-200 bg-neutral-50 p-6 sm:p-8">
            <h2 className="text-sm font-bold uppercase tracking-wider">Separate industry reference</h2>
            <p className="mt-2 text-xs leading-relaxed text-neutral-600">This regular short-sleeve T-shirt table is an industry reference only. It is not a RIGHTNOWLIFE product chart, not a universal requirement, and not an oversized-fit specification. The reference does not include XS.</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[500px] text-xs text-left border-collapse">
                <thead><tr className="border-b border-neutral-300 text-neutral-700 uppercase"><th className="py-2 px-3">Size</th><th className="py-2 px-3">Chest width (cm)</th><th className="py-2 px-3">Body length (cm)</th><th className="py-2 px-3">Shoulder width (cm)</th><th className="py-2 px-3">Sleeve length (cm)</th></tr></thead>
                <tbody>{SIZE_CHART_INDUSTRY_REFERENCE.map((row) => <tr key={row.size} className="border-b border-neutral-200"><td className="py-2 px-3 font-bold">{row.size}</td><td className="py-2 px-3">{row.chestCm}</td><td className="py-2 px-3">{row.lengthCm}</td><td className="py-2 px-3">{row.shoulderCm}</td><td className="py-2 px-3">{row.sleeveCm}</td></tr>)}</tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-neutral-600">Source cited in the supplied brief: <a className="underline" href="https://www.mha.gov.in/sites/default/files/QRsTShirtWhiteHalfSleeves_29012021.pdf" target="_blank" rel="noreferrer">Government of India, Ministry of Home Affairs technical specification</a>.</p>
          </section>

          {/* Measurement Guide */}
          <div className="mt-12 max-w-4xl border border-neutral-200 bg-white p-6 sm:p-8 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-black">
              How to Measure Your Best-Fitting T-Shirt
            </h3>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Lay a T-shirt that fits you well on a flat surface. Measure straight across from one armpit to the other to check the chest width, and compare it with our size chart.
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
                  Measure from the high point of shoulder beside the neckline straight to the bottom hem.
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

            <div className="pt-4 flex flex-col gap-3 border-t border-neutral-100 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-neutral-500">Need help choosing your size?</span>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="inline-flex max-w-full items-start gap-1 break-words text-xs font-bold text-black hover:underline sm:items-center"
              >
                <span>Contact our team before placing your order, and we’ll be happy to help ({SUPPORT_EMAIL}).</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </StoreLayout>
  );
}
