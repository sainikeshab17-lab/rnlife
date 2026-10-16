"use client";

import React, { useState } from "react";
import Image from "next/image";
import { ZoomIn, ChevronLeft, ChevronRight, X } from "lucide-react";

interface ProductGalleryProps {
  images: string[];
  productName: string;
}

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Safe fallback if images array is empty
  const activeImages = images.length > 0 ? images : [
    "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=1200&q=80"
  ];

  const currentImage = activeImages[selectedIdx] || activeImages[0];

  const handleNext = () => {
    setSelectedIdx((prev) => (prev + 1) % activeImages.length);
  };

  const handlePrev = () => {
    setSelectedIdx((prev) => (prev - 1 + activeImages.length) % activeImages.length);
  };

  return (
    <div className="flex flex-col-reverse lg:flex-row gap-4">
      {/* Thumbnail column (Desktop left / Mobile bottom) */}
      <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto no-scrollbar shrink-0 max-h-[650px] py-1">
        {activeImages.map((img, idx) => (
          <button
            key={idx}
            onClick={() => setSelectedIdx(idx)}
            className={`relative w-16 h-20 sm:w-20 sm:h-24 bg-[#F5F4F0] shrink-0 overflow-hidden border-2 transition-all ${
              selectedIdx === idx ? "border-black scale-95" : "border-transparent opacity-70 hover:opacity-100"
            }`}
            aria-label={`View image ${idx + 1}`}
          >
            <Image
              src={img}
              alt={`${productName} thumbnail ${idx + 1}`}
              fill
              className="object-cover object-top"
              sizes="80px"
            />
          </button>
        ))}
      </div>

      {/* Main Image Stage */}
      <div className="relative flex-1 aspect-[3/4] bg-[#F5F4F0] overflow-hidden group">
        <Image
          src={currentImage}
          alt={`${productName} - View ${selectedIdx + 1}`}
          fill
          priority
          className="object-cover object-top cursor-zoom-in transition-transform duration-500 hover:scale-105"
          onClick={() => setIsLightboxOpen(true)}
          sizes="(max-width: 1024px) 100vw, 60vw"
        />

        {/* Zoom Action Pill */}
        <button
          onClick={() => setIsLightboxOpen(true)}
          className="absolute top-4 right-4 p-2 bg-white/90 hover:bg-black hover:text-white rounded-full shadow-md text-neutral-800 transition-colors"
          aria-label="Enlarge image"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        {/* Mobile Navigation Arrows */}
        {activeImages.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Next image"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Counter indicator */}
        <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/70 text-white text-[10px] uppercase font-mono tracking-wider backdrop-blur-sm">
          {selectedIdx + 1} / {activeImages.length}
        </div>
      </div>

      {/* Fullscreen Lightbox Modal */}
      {isLightboxOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
          <button
            onClick={() => setIsLightboxOpen(false)}
            className="absolute top-6 right-6 p-2 text-white/70 hover:text-white"
            aria-label="Close zoom"
          >
            <X className="w-7 h-7" />
          </button>

          <div className="relative w-full max-w-4xl h-[85vh]">
            <Image
              src={currentImage}
              alt={productName}
              fill
              className="object-contain"
              sizes="100vw"
            />
          </div>

          {activeImages.length > 1 && (
            <>
              <button
                onClick={handlePrev}
                className="absolute left-6 top-1/2 -translate-y-1/2 p-3 text-white hover:text-[#B8FF3B]"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              <button
                onClick={handleNext}
                className="absolute right-6 top-1/2 -translate-y-1/2 p-3 text-white hover:text-[#B8FF3B]"
                aria-label="Next image"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
