"use client";

import React, { useState } from "react";
import Link from "next/link";
import { BRAND_INFO } from "@/data/mock-data";
import { ArrowRight, X } from "lucide-react";

export function AnnouncementBar() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="bg-[#F5F4F0] text-[#111111] border-b border-[#E5E5E5] text-[10px] uppercase tracking-wider font-semibold py-1 px-4">
      <div className="max-w-7xl mx-auto flex items-center justify-center relative min-h-6">
        <div className="flex items-center justify-center gap-2 overflow-hidden text-center">
          <Link
            href="/collections/new-drops"
            className="hover:text-[#0876A8] flex items-center gap-1.5 transition-colors"
          >
            <span>{BRAND_INFO.announcements[0]}</span>
            <ArrowRight className="w-3 h-3 text-[#0876A8] shrink-0" />
          </Link>
        </div>

        <button
          onClick={() => setIsVisible(false)}
          className="absolute right-0 text-neutral-500 hover:text-[#111111] transition-colors p-1"
          aria-label="Dismiss announcement"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
