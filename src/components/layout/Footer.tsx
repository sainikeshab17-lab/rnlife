"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { BRAND_INFO } from "@/data/mock-data";

export function Footer() {
  const [email, setEmail] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState("");

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    setIsSubscribed(true);
    setEmail("");
  };

  return (
    <footer className="bg-[#111111] text-white border-t border-neutral-800">
      {/* Newsletter Section */}
      <div className="border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-6 space-y-2">
              <span className="text-[11px] uppercase tracking-widest-custom font-mono text-[#B8FF3B]">
                Exclusive Drop Access
              </span>
              <h3 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-tight font-editorial">
                FIRST TO THE NEXT DROP.
              </h3>
              <p className="text-xs sm:text-sm text-neutral-400 max-w-md leading-relaxed">
                Get updates on new collections, upcoming drops, and brand news. Never mass spammed.
              </p>
            </div>

            <div className="lg:col-span-6">
              {isSubscribed ? (
                <div className="flex items-center gap-2 p-4 bg-neutral-900 border border-[#B8FF3B]/30 text-white text-xs uppercase tracking-wider font-semibold">
                  <CheckCircle2 className="w-5 h-5 text-[#B8FF3B]" />
                  <span>You are on the VIP drop list. Watch your inbox.</span>
                </div>
              ) : (
                <form onSubmit={handleNewsletterSubmit} className="space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ENTER YOUR EMAIL FOR DROP ACCESS"
                      className="flex-1 px-4 py-3.5 bg-neutral-900 border border-neutral-700 text-white placeholder:text-neutral-500 text-xs uppercase tracking-wider focus:border-white outline-none"
                    />
                    <button
                      type="submit"
                      className="px-6 py-3.5 bg-white text-black hover:bg-[#B8FF3B] text-xs uppercase tracking-widest font-black transition-colors flex items-center justify-center gap-2 shrink-0"
                    >
                      Subscribe <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                  {error && <p className="text-xs text-red-400">{error}</p>}
                  <p className="text-[10px] text-neutral-500 leading-normal">
                    By submitting your email, you consent to receive drop notifications. You may unsubscribe anytime.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand Info */}
          <div className="col-span-2 space-y-4">
            <span className="text-xl font-black tracking-widest font-mono text-white block">
              RIGHTNOWLIFE
            </span>
            <p className="text-xs text-neutral-400 leading-relaxed max-w-sm">
              {BRAND_INFO.aboutStory}
            </p>
            <div className="flex items-center space-x-4 pt-2">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-full border border-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white hover:border-white transition-colors"
                aria-label="Instagram"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
              <a
                href="https://x.com"
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-full border border-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white hover:border-white transition-colors"
                aria-label="Twitter / X"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-full border border-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white hover:border-white transition-colors"
                aria-label="YouTube"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Shop */}
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-widest font-bold text-white">Collections</p>
            <ul className="space-y-2 text-xs text-neutral-400">
              <li>
                <Link href="/shop" className="hover:text-white transition-colors">
                  Shop All Tees
                </Link>
              </li>
              <li>
                <Link href="/collections/new-drops" className="hover:text-white transition-colors">
                  New Drops
                </Link>
              </li>
              <li>
                <Link href="/collections/graphic-tees" className="hover:text-white transition-colors">
                  Graphic Tees
                </Link>
              </li>
              <li>
                <Link href="/collections/oversized-tees" className="hover:text-white transition-colors">
                  Oversized Tees
                </Link>
              </li>
              <li>
                <Link href="/collections/essentials" className="hover:text-white transition-colors">
                  Essential Tees
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Care */}
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-widest font-bold text-white">Customer Care</p>
            <ul className="space-y-2 text-xs text-neutral-400">
              <li>
                <Link href="/size-guide" className="hover:text-white transition-colors">
                  Size Guide & Measurements
                </Link>
              </li>
              <li>
                <Link href="/shipping" className="hover:text-white transition-colors">
                  Shipping Information
                </Link>
              </li>
              <li>
                <Link href="/returns" className="hover:text-white transition-colors">
                  Returns & Exchanges
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-white transition-colors">
                  Frequently Asked Questions
                </Link>
              </li>
            </ul>
          </div>

          {/* Brand & Portal */}
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-widest font-bold text-white">About & Portals</p>
            <ul className="space-y-2 text-xs text-neutral-400">
              <li>
                <Link href="/about" className="hover:text-white transition-colors">
                  About RightNowLife
                </Link>
              </li>
              <li>
                <Link href="/account" className="hover:text-white transition-colors">
                  Customer Dashboard
                </Link>
              </li>
              <li>
                <Link href="/seller" className="hover:text-[#B8FF3B] transition-colors">
                  Seller Portal (Staff)
                </Link>
              </li>
              <li>
                <Link href="/admin" className="hover:text-[#B8FF3B] transition-colors">
                  Admin Dashboard
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Prototype Disclaimer Bar */}
        <div className="mt-12 pt-6 border-t border-neutral-800 text-[11px] text-neutral-500 flex flex-col md:flex-row items-center justify-between gap-4">
          <p>
            © {new Date().getFullYear()} RIGHTNOWLIFE. All Rights Reserved. Independent Indian Streetwear Label.
          </p>
          <div className="flex items-center space-x-6 text-[11px]">
            <span className="text-neutral-500 font-mono">
              [Phase 1 Frontend Prototype • Next.js App Router]
            </span>
            <Link href="/shipping" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <Link href="/shipping" className="hover:text-white transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
