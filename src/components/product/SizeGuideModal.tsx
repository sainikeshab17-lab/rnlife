"use client";

import React, { useState } from "react";
import { X, Ruler, CheckCircle } from "lucide-react";
import { TShirtFit } from "@/types";
import { SIZE_CHART_OVERSIZED, SIZE_CHART_RELAXED, SIZE_CHART_REGULAR } from "@/data/mock-data";

interface SizeGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFit?: TShirtFit;
}

export function SizeGuideModal({
  isOpen,
  onClose,
  initialFit = "Oversized",
}: SizeGuideModalProps) {
  const [selectedFit, setSelectedFit] = useState<TShirtFit>(initialFit);

  if (!isOpen) return null;

  const currentChart =
    selectedFit === "Oversized"
      ? SIZE_CHART_OVERSIZED
      : selectedFit === "Relaxed"
      ? SIZE_CHART_RELAXED
      : SIZE_CHART_REGULAR;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-2xl bg-white border border-neutral-200 shadow-2xl p-6 sm:p-8 animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-200">
          <div className="flex items-center gap-2">
            <Ruler className="w-5 h-5 text-neutral-900" />
            <h3 className="text-base font-black uppercase tracking-wider font-editorial">
              T-Shirt Size & Measurement Guide
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-black transition-colors rounded-full"
            aria-label="Close size guide"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Fit Tabs */}
        <div className="mt-4 flex gap-2 border-b border-neutral-200 pb-3">
          {(["Oversized", "Relaxed", "Regular"] as TShirtFit[]).map((fit) => (
            <button
              key={fit}
              onClick={() => setSelectedFit(fit)}
              className={`px-3 py-1.5 text-xs uppercase font-bold tracking-wider transition-colors ${
                selectedFit === fit
                  ? "bg-black text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {fit} Fit
            </button>
          ))}
        </div>

        {/* Fit Explanation Notice */}
        <div className="mt-4 p-3 bg-[#F5F4F0] border-l-2 border-black text-xs text-neutral-700 leading-relaxed">
          {selectedFit === "Oversized" && (
            <p>
              <strong>Oversized Fit:</strong> Intentionally cut with exaggerated dropped shoulders, wider sleeves, and a boxy torso drape. We recommend choosing your normal size for the intended streetwear silhouette.
            </p>
          )}
          {selectedFit === "Relaxed" && (
            <p>
              <strong>Relaxed Fit:</strong> Cut with subtle ease through the chest and shoulders for everyday comfort without appearing excessively bag-like. Fits true to size.
            </p>
          )}
          {selectedFit === "Regular" && (
            <p>
              <strong>Regular Fit:</strong> Classic architectural cut with standard shoulder seams and a clean straight hem. Ideal for minimalist layering.
            </p>
          )}
        </div>

        {/* Measurement Table in CM */}
        <div className="mt-6 overflow-x-auto">
          <p className="text-[11px] uppercase tracking-widest font-bold text-neutral-400 mb-2">
            Garment Dimensions (in Centimeters)
          </p>
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-300 bg-neutral-100 text-neutral-800 uppercase tracking-wider font-bold">
                <th className="py-2.5 px-3">Size</th>
                <th className="py-2.5 px-3">Chest Width (cm)</th>
                <th className="py-2.5 px-3">Body Length (cm)</th>
                <th className="py-2.5 px-3">Shoulder (cm)</th>
                <th className="py-2.5 px-3">Sleeve (cm)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 font-medium">
              {currentChart.map((row) => (
                <tr key={row.size} className="hover:bg-neutral-50">
                  <td className="py-2.5 px-3 font-bold text-black">{row.size}</td>
                  <td className="py-2.5 px-3">{row.chestCm}</td>
                  <td className="py-2.5 px-3">{row.lengthCm}</td>
                  <td className="py-2.5 px-3">{row.shoulderCm}</td>
                  <td className="py-2.5 px-3">{row.sleeveCm}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* How to Measure Guide */}
        <div className="mt-6 pt-6 border-t border-neutral-200">
          <p className="text-xs font-bold uppercase tracking-wider mb-2">How to Measure Your Best-Fitting T-Shirt</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-neutral-600">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-neutral-900 shrink-0 mt-0.5" />
              <span><strong>Chest:</strong> Lay tee flat and measure pit to pit, then double the measurement.</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-neutral-900 shrink-0 mt-0.5" />
              <span><strong>Length:</strong> Measure straight down from highest shoulder point to bottom hem.</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-neutral-900 shrink-0 mt-0.5" />
              <span><strong>Shoulder:</strong> Measure across the back from shoulder seam to shoulder seam.</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-neutral-900 shrink-0 mt-0.5" />
              <span><strong>Sleeve:</strong> Measure from the shoulder seam straight to the sleeve hem.</span>
            </div>
          </div>
        </div>

        {/* Close Button */}
        <div className="mt-6 pt-4 border-t border-neutral-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-black text-white text-xs uppercase tracking-widest font-bold hover:bg-neutral-800"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
}
