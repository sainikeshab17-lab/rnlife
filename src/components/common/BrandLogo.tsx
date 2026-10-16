"use client";

import React from "react";
import Link from "next/link";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
}

export function BrandLogo({
  size = "md",
  showWordmark = true,
  className = "",
}: BrandLogoProps) {
  const iconSizes = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-10 h-10",
  }[size];

  const textSizes = {
    sm: "text-base tracking-widest",
    md: "text-lg sm:text-xl tracking-widest",
    lg: "text-2xl tracking-widest",
  }[size];

  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2.5 group transition-transform duration-200 active:scale-95 ${className}`}
      aria-label="RIGHTNOWLIFE Home"
    >
      {/* 4-Color RN Monogram Emblem */}
      <div className={`relative ${iconSizes} shrink-0 transition-transform duration-300 group-hover:rotate-6`}>
        <svg
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Top-Left: Red #F5141C */}
          <rect x="2" y="2" width="16" height="16" rx="3" fill="#F5141C" />
          {/* Top-Right: Blue #0876A8 */}
          <rect x="22" y="2" width="16" height="16" rx="3" fill="#0876A8" />
          {/* Bottom-Left: Yellow #FFB900 */}
          <rect x="2" y="22" width="16" height="16" rx="3" fill="#FFB900" />
          {/* Bottom-Right: Green #079447 */}
          <rect x="22" y="22" width="16" height="16" rx="3" fill="#079447" />

          {/* Monogram Overlay Letters R & N */}
          <text
            x="10"
            y="14"
            fill="#FFFFFF"
            fontSize="10"
            fontWeight="900"
            fontFamily="monospace"
            textAnchor="middle"
          >
            R
          </text>
          <text
            x="30"
            y="14"
            fill="#FFFFFF"
            fontSize="10"
            fontWeight="900"
            fontFamily="monospace"
            textAnchor="middle"
          >
            N
          </text>
          {/* Dot in center */}
          <circle cx="20" cy="20" r="3" fill="#111111" />
        </svg>
      </div>

      {showWordmark && (
        <span
          className={`font-mono font-black text-[#111111] uppercase tracking-widest-custom ${textSizes}`}
          style={{ letterSpacing: "0.14em" }}
        >
          RIGHTNOWLIFE
        </span>
      )}
    </Link>
  );
}
