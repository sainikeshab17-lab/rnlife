"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { BRAND_INFO } from "@/data/mock-data";
import { ChevronRight, X } from "lucide-react";

export function AnnouncementBar() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % BRAND_INFO.announcements.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="bg-[#111111] text-white border-b border-neutral-800 text-[11px] uppercase tracking-widest font-medium py-1.5 px-4 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="hidden md:block w-8" />

        <div className="flex-1 text-center flex items-center justify-center gap-2 overflow-hidden">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#FFB900]" />
          <Link
            href="/collections/new-drops"
            className="hover:underline flex items-center gap-1 transition-opacity duration-300 text-neutral-200 hover:text-white"
          >
            <span>{BRAND_INFO.announcements[currentIndex]}</span>
            <ChevronRight className="w-3 h-3 text-[#FFB900]" />
          </Link>
        </div>

        <button
          onClick={() => setIsVisible(false)}
          className="text-neutral-400 hover:text-white transition-colors p-1"
          aria-label="Dismiss announcement"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
