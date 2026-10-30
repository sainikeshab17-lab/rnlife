"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  iconClassName?: string;
}

export function BrandLogo({
  size = "md",
  className = "",
  iconClassName = "",
}: BrandLogoProps) {
  const iconSizes = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
  }[size];

  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2.5 group transition-transform duration-200 active:scale-95 ${className}`}
      aria-label="RIGHTNOWLIFE Home"
    >
      <div className={`relative ${iconSizes} shrink-0 ${iconClassName}`}>
        <Image
          src="/rightnowlife-logo.png"
          alt="RIGHTNOWLIFE logo"
          width={500}
          height={500}
          sizes={
            size === "lg"
              ? "(max-width: 640px) 64px, 80px"
              : size === "md"
                ? "40px"
                : "32px"
          }
          className="h-full w-full object-contain"
        />
      </div>
    </Link>
  );
}
