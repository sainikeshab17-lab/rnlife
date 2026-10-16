"use client";

import React, { useState } from "react";
import { Info, X } from "lucide-react";

export function PrototypeNotice() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-[#111111] text-neutral-300 border-b border-neutral-800 text-[11px] py-1.5 px-4 font-mono">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 truncate">
          <Info className="w-3.5 h-3.5 text-[#B8FF3B] shrink-0" />
          <span className="truncate">
            <strong className="text-white">PHASE 1 UI/UX PROTOTYPE:</strong> Fully custom Next.js frontend with active shopping bag, wishlist, and simulated Razorpay payment fixtures.
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-neutral-500 hover:text-white p-0.5"
          aria-label="Dismiss banner"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
