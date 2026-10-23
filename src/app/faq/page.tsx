"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, HelpCircle, ArrowRight } from "lucide-react";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { STORE_POLICIES } from "@/lib/policies";

export default function FAQPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faqs = [
    {
      q: "How do I choose between an Oversized Fit and a Relaxed Fit?",
      a: "Compare the proposed garment chart with a T-shirt that fits you well. The published size charts are pending physical verification; use the size guide for measurement definitions and the current verification note.",
    },
    {
      q: "What does 260 GSM mean for a T-shirt?",
      a: "GSM means grams per square metre, a measure of fabric weight. Please check the product details for the specifications currently listed for that design.",
    },
    {
      q: "How should I wash my RightNowLife graphic tees?",
      a: "Follow the care instructions shown on the individual product page. They are also available on the garment label.",
    },
    {
      q: "How long does shipping take across India?",
      a: "Available shipping methods, charges, and delivery estimates are shown during checkout and may vary by destination. See our Shipping Policy for details.",
    },
    {
      q: "Can I exchange my T-shirt for a different size?",
      a: `The current policy configuration accepts exchange requests within ${STORE_POLICIES.returns.windowDays} days after delivery. Submit a size-exchange request from Account → Orders or contact support. The team reviews eligibility and confirms requested-size stock before completing an exchange. Return shipping charges and final item-condition rules require owner confirmation; see the Returns & Refunds Policy.`,
    },
    {
      q: "Is Cash on Delivery (COD) supported?",
      a: "Yes, COD is available across most serviceable Indian PIN codes. You can also pay seamlessly online using Razorpay with UPI (Google Pay, PhonePe, Paytm), Debit/Credit Cards, or Net Banking.",
    },
  ];

  return (
    <StoreLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumbs items={[{ label: "Frequently Asked Questions" }]} />

        <div className="py-8 border-b border-neutral-200">
          <span className="text-[11px] uppercase tracking-widest font-mono text-neutral-500 font-bold block mb-1">
            HELP CENTER
          </span>
          <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight font-editorial">
            FREQUENTLY ASKED QUESTIONS
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 mt-2">
            Answers to common questions regarding sizing, fabric weights, care, and dispatch.
          </p>
        </div>

        <div className="py-8 divide-y divide-neutral-200 border-b border-neutral-200">
          {faqs.map((item, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div key={idx} className="py-4">
                <button
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between text-left py-2 font-bold uppercase tracking-wider text-xs sm:text-sm text-neutral-900 hover:text-black transition-colors"
                >
                  <span>{item.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 shrink-0 text-black ml-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4 shrink-0 text-neutral-400 ml-4" />
                  )}
                </button>
                {isOpen && (
                  <p className="pt-2 pb-3 text-xs sm:text-sm text-neutral-600 leading-relaxed max-w-3xl">
                    {item.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs text-neutral-500">
            Still have a question not addressed here?
          </span>
          <Link
            href="/contact"
            className="px-6 py-3 bg-black text-white text-xs uppercase tracking-widest font-bold inline-flex items-center gap-1.5"
          >
            <span>Ask Support Team</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </StoreLayout>
  );
}
