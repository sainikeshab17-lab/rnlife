"use client";

import React, { useState, useCallback } from "react";
import Image from "next/image";
import { ZoomIn, ChevronLeft, ChevronRight, X } from "lucide-react";

interface ProductGalleryProps {
  images: string[];
  productName: string;
}

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const activeImages = images.filter(Boolean);

  const currentImage = activeImages[selectedIdx] || activeImages[0];

  const switchTo = useCallback(
    (idx: number) => {
      if (idx === selectedIdx || isTransitioning || idx < 0 || idx >= activeImages.length) return;
      setIsTransitioning(true);
      setSelectedIdx(idx);
      window.setTimeout(() => setIsTransitioning(false), 240);
    },
    [selectedIdx, isTransitioning]
  );

  const handleNext = useCallback(() => {
    switchTo((selectedIdx + 1) % activeImages.length);
  }, [selectedIdx, activeImages.length, switchTo]);

  const handlePrev = useCallback(() => {
    switchTo((selectedIdx - 1 + activeImages.length) % activeImages.length);
  }, [selectedIdx, activeImages.length, switchTo]);

  // Keyboard handler for lightbox
  const handleLightboxKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") setIsLightboxOpen(false);
    if (e.key === "ArrowRight") handleNext();
    if (e.key === "ArrowLeft") handlePrev();
  };

  return (
    <div className="flex flex-col-reverse lg:flex-row gap-3">
      {/* Thumbnail column — left on desktop, bottom row on mobile */}
      {activeImages.length > 1 && <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto no-scrollbar shrink-0 lg:max-h-[680px]">
        {activeImages.map((img, idx) => (
          <button
            key={idx}
            onClick={() => switchTo(idx)}
            className={`relative w-[68px] h-[84px] shrink-0 overflow-hidden border-2 transition-all duration-200 ${
              selectedIdx === idx
                ? "border-[#111111] ring-1 ring-[#111111] ring-offset-1"
                : "border-transparent opacity-60 hover:opacity-90 hover:border-[#E5E5E5]"
            }`}
            aria-label={`View image ${idx + 1}`}
            aria-pressed={selectedIdx === idx}
          >
            <Image
              src={img}
              alt={`${productName} thumbnail ${idx + 1}`}
              fill
              className="object-cover object-top"
              sizes="68px"
            />
          </button>
        ))}
      </div>}

      {/* Main Image Stage */}
      <div className="relative flex-1 aspect-[4/5] bg-[#F5F4F0] overflow-hidden group">
        {currentImage ? (
          <Image
            key={currentImage}
            src={currentImage}
            alt={`${productName} — View ${selectedIdx + 1}`}
            fill
            priority
            className={`gallery-crossfade object-contain ${isTransitioning ? "opacity-90" : "opacity-100"}`}
            onClick={() => setIsLightboxOpen(true)}
            sizes="(max-width: 1024px) 100vw, 58vw"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center px-8 text-center text-sm text-neutral-500">
            Product photography is not available yet.
          </div>
        )}

        {/* Zoom button */}
        {currentImage && <button
          onClick={() => setIsLightboxOpen(true)}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center bg-white/90 hover:bg-white text-[#111111] shadow-sm transition-colors"
          aria-label="Enlarge image"
        >
          <ZoomIn className="w-4 h-4" />
        </button>}

        {/* Prev/Next arrows — visible on hover */}
        {activeImages.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-[#111111] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-[#111111] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
              aria-label="Next image"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Image counter */}
        {activeImages.length > 1 && (
          <div className="absolute bottom-3 right-3 px-2 py-0.5 bg-black/60 text-white text-[10px] uppercase font-mono tracking-wider backdrop-blur-sm">
            {selectedIdx + 1} / {activeImages.length}
          </div>
        )}
      </div>

      {/* Fullscreen Lightbox */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/96 flex items-center justify-center p-4"
          role="dialog"
          aria-label="Image lightbox"
          aria-modal="true"
          onKeyDown={handleLightboxKey}
          onClick={(event) => {
            if (event.target === event.currentTarget) setIsLightboxOpen(false);
          }}
          tabIndex={-1}
          ref={(el) => el?.focus()}
        >
          <button
            onClick={() => setIsLightboxOpen(false)}
            className="absolute top-5 right-5 p-2 text-white/60 hover:text-white transition-colors"
            aria-label="Close zoom"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="relative w-full max-w-3xl max-h-[88vh] aspect-[4/5]" onClick={(event) => event.stopPropagation()}>
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
                className="absolute left-5 top-1/2 -translate-y-1/2 p-3 text-white/60 hover:text-white transition-colors"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-7 h-7" />
              </button>
              <button
                onClick={handleNext}
                className="absolute right-5 top-1/2 -translate-y-1/2 p-3 text-white/60 hover:text-white transition-colors"
                aria-label="Next image"
              >
                <ChevronRight className="w-7 h-7" />
              </button>
            </>
          )}

          {/* Thumbnail strip in lightbox */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {activeImages.map((img, idx) => (
              <button
                key={idx}
                onClick={() => switchTo(idx)}
                className={`relative w-10 h-12 border-2 transition-all ${
                  selectedIdx === idx
                    ? "border-[#FFB900]"
                    : "border-white/20 hover:border-white/50"
                }`}
                aria-label={`Lightbox view ${idx + 1}`}
              >
                <Image
                  src={img}
                  alt=""
                  fill
                  className="object-cover object-top"
                  sizes="40px"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
