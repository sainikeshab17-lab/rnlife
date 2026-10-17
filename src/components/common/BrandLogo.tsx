"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
  tone?: "dark" | "light";
}

export function BrandLogo({
  size = "md",
  showWordmark = true,
  className = "",
  tone = "dark",
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
      <div className={`relative ${iconSizes} shrink-0`}>
        <Image src="/logo.svg" alt="" fill sizes="40px" aria-hidden="true" />
      </div>

      {showWordmark && (
        <span
          className={`font-mono font-black uppercase tracking-widest-custom ${tone === "light" ? "text-white" : "text-[#111111]"} ${textSizes}`}
          style={{ letterSpacing: "0.14em" }}
        >
          RIGHTNOWLIFE
        </span>
      )}
    </Link>
  );
}
