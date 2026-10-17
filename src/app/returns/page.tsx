"use client";

import React from "react";
import Link from "next/link";
import { Repeat, ShieldCheck, HelpCircle } from "lucide-react";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";

export default function ReturnsPage() {
  return (
    <StoreLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumbs items={[{ label: "Returns & Exchanges" }]} />

        <div className="py-8 border-b border-neutral-200">
          <span className="text-[11px] uppercase tracking-widest font-mono text-neutral-500 font-bold block mb-1">
            CUSTOMER ASSURANCE
          </span>
          <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight font-editorial">
            RETURNS & SIZE EXCHANGES
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 mt-2">
            Hassle-free 7-day size replacement and return guidelines for RightNowLife garments.
          </p>
        </div>

        <div className="py-8 space-y-8 text-xs text-neutral-700 leading-relaxed">
          <div className="p-5 bg-[#F5F4F0] border border-neutral-200 space-y-3">
            <div className="flex items-center gap-2">
              <Repeat className="w-5 h-5 text-black" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-black">
                7-Day Free Size Exchange Guarantee
              </h2>
            </div>
            <p>
              We want your T-shirt to fit exactly how you envisioned. If the silhouette feels too oversized or too fitted, you may initiate a size exchange within <strong>7 days</strong> of delivery. Our courier partner will pick up the garment from your doorstep and deliver the requested replacement.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-black">
              Garment Condition Guidelines
            </h3>
            <ul className="space-y-1.5 list-disc list-inside text-neutral-600">
              <li>Garments must be unworn, unwashed, and odor-free.</li>
              <li>Original neck tags and brand woven labels must remain intact.</li>
              <li>T-shirts must be in their original polybag packaging.</li>
              <li>Items marked under final clearance / archive sales are eligible for size exchange only.</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-black">
              Refund Processing via Razorpay
            </h3>
            <p>
              For returned orders where size replacement is not opted for, the refund will be credited back to your original payment source (UPI, Credit/Debit card, or Net Banking) within 5 to 7 working days following quality inspection at our central warehouse.
            </p>
          </div>

          <div className="p-5 bg-black text-white space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#FFB900]">
              Ready to submit a Return or Size Exchange?
            </h3>
            <p className="text-xs text-neutral-300">
              You can easily initiate a return or exchange request directly from your verified order timeline within 7 days of delivery.
            </p>
            <div className="pt-2">
              <Link
                href="/account/orders"
                className="inline-block px-6 py-2.5 bg-[#FFB900] text-black text-xs uppercase tracking-widest font-black hover:bg-white transition-colors"
              >
                Go to My Orders &rarr;
              </Link>
            </div>
          </div>

          <div className="pt-4 border-t border-neutral-200 flex items-center justify-between">
            <span className="text-xs text-neutral-500">Need help with an exchange?</span>
            <Link
              href="/contact"
              className="px-6 py-2.5 bg-neutral-200 hover:bg-neutral-300 text-black text-xs uppercase tracking-widest font-bold"
            >
              Contact Support
            </Link>
          </div>
        </div>
      </div>
    </StoreLayout>
  );
}
