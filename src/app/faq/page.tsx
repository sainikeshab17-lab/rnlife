"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, HelpCircle, ArrowRight } from "lucide-react";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";

export default function FAQPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faqs = [
    {
      q: "How do I choose between an Oversized Fit and a Relaxed Fit?",
      a: "Our Oversized Fit is intentionally designed with exaggerated dropped shoulders, lengthened half sleeves, and a boxy torso. We suggest picking your standard size for the intended streetwear drape. If you prefer a more tailored fit, choose our Relaxed Fit or size down.",
    },
    {
      q: "What does 260 GSM mean for a T-shirt?",
      a: "GSM stands for Grams per Square Meter — the metric weight of the cotton fabric. Standard mass-market tees are typically 140–180 GSM and tend to cling. Our 240–280 GSM custom combed cotton provides substantial structural drape, opaque non-see-through thickness, and long-lasting durability.",
    },
    {
      q: "How should I wash my RightNowLife graphic tees?",
      a: "To preserve deep cotton pigments and tactile puff/discharge prints, always wash your tees inside out in cold water (30°C or below). Avoid bleach and tumble drying; instead, hang dry naturally in the shade. Never iron directly over printed graphics.",
    },
    {
      q: "How long does shipping take across India?",
      a: "Metro destinations (Bengaluru, Mumbai, Delhi NCR, Hyderabad, Chennai) receive express air delivery in 2 to 3 business days. Non-metro locations take 3 to 5 business days. Real-time air tracking numbers (AWB) are emailed upon dispatch.",
    },
    {
      q: "Can I exchange my T-shirt for a different size?",
      a: "Yes! We offer a hassle-free 7-day size exchange guarantee. If your silhouette doesn't sit quite right, visit your Account Orders page or contact us to schedule a doorstep reverse pickup and replacement dispatch.",
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
