"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { BRAND_INFO } from "@/data/mock-data";
import { BrandLogo } from "@/components/common/BrandLogo";

export function Footer() {
  const [email, setEmail] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState("");

  const handleNewsletterSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    setIsSubscribed(true);
    setEmail("");
  };

  return (
    <footer className="bg-[#111111] text-white">
      <div className="border-b border-white/15">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div>
            <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-[#FFB900]">Drop notes</p>
            <p className="mt-1 text-sm font-semibold">First to the next drop.</p>
          </div>
          {isSubscribed ? (
            <p className="flex items-center gap-2 text-xs text-white" role="status">
              <CheckCircle2 className="h-4 w-4 text-[#079447]" /> You&apos;re on the list.
            </p>
          ) : (
            <form onSubmit={handleNewsletterSubmit} className="w-full md:max-w-md">
              <div className="flex border-b border-white/50">
                <label className="sr-only" htmlFor="footer-email">Email address</label>
                <input
                  id="footer-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Email address"
                  className="min-w-0 flex-1 bg-transparent py-2 text-xs text-white placeholder:text-neutral-400 focus:outline-none"
                />
                <button type="submit" className="text-[#FFB900]" aria-label="Subscribe to drop updates">
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
              {error && <p className="mt-1 text-xs text-[#F5141C]" role="alert">{error}</p>}
            </form>
          )}
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr] lg:px-8">
        <div>
          <BrandLogo size="sm" tone="light" />
          <p className="mt-3 max-w-sm text-xs leading-5 text-neutral-400">{BRAND_INFO.manifesto}</p>
          <a href={`mailto:${BRAND_INFO.supportEmail}`} className="mt-3 inline-block text-xs text-white underline underline-offset-4 hover:text-[#FFB900]">
            {BRAND_INFO.supportEmail}
          </a>
        </div>
        <div>
          <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-neutral-400">Shop</h2>
          <ul className="space-y-2 text-xs text-neutral-200">
            <li><Link href="/shop" className="hover:text-[#FFB900]">Shop all</Link></li>
            <li><Link href="/collections/graphic-tees" className="hover:text-[#FFB900]">Graphic tees</Link></li>
            <li><Link href="/collections/oversized-tees" className="hover:text-[#FFB900]">Oversized</Link></li>
            <li><Link href="/collections/essentials" className="hover:text-[#FFB900]">Essentials</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-neutral-400">Help</h2>
          <ul className="space-y-2 text-xs text-neutral-200">
            <li><Link href="/size-guide" className="hover:text-[#FFB900]">Size guide</Link></li>
            <li><Link href="/shipping" className="hover:text-[#FFB900]">Shipping</Link></li>
            <li><Link href="/returns" className="hover:text-[#FFB900]">Returns & exchanges</Link></li>
            <li><Link href="/contact" className="hover:text-[#FFB900]">Contact</Link></li>
          </ul>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl flex-col gap-2 border-t border-white/15 px-4 py-4 text-[10px] text-neutral-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>© {new Date().getFullYear()} RIGHTNOWLIFE</p>
        <div className="flex gap-4">
          <Link href="/account" className="hover:text-white">Account</Link>
          <Link href="/seller" className="hover:text-white">Staff portal</Link>
          <Link href="/admin" className="hover:text-white">Admin demo</Link>
        </div>
      </div>
    </footer>
  );
}