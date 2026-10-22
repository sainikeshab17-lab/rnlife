"use client";

import React from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { BRAND_INFO } from "@/data/mock-data";

export default function ReturnsPage() {
  return (
    <StoreLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumbs items={[{ label: "Return & Refund Policy" }]} />

        <div className="py-8 border-b border-neutral-200">
          <span className="text-[11px] uppercase tracking-widest font-mono text-neutral-500 font-bold block mb-1">
            CUSTOMER POLICY
          </span>
          <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight font-editorial">
            RETURN & REFUND POLICY
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 mt-2">
            Last updated: 16 October 2026. Please review the published return
            and refund terms before requesting a cancellation or return.
          </p>
        </div>

        <div className="py-8 space-y-8 text-xs text-neutral-700 leading-relaxed">
          <div className="p-5 bg-[#F5F4F0] border border-neutral-200 space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-black">
              Order Cancellation
            </h2>
            <p>
              You may cancel your order within 14 days without giving a reason.
              The 14-day period starts when you or a third party you appointed
              (other than the carrier) receives the Goods. To exercise this
              right, send a clear statement of your decision to{" "}
              <a
                href={`mailto:${BRAND_INFO.supportEmail}`}
                className="font-bold text-black underline"
              >
                {BRAND_INFO.supportEmail}
              </a>
              .
            </p>
            <p>
              Reimbursement will be made no later than 14 days after the
              returned Goods are received, using the same means of payment
              used for the order, with no reimbursement fee.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-black">
              Conditions for Returns
            </h3>
            <ul className="space-y-1.5 list-disc list-inside text-neutral-600">
              <li>The Goods were purchased within the last 14 days.</li>
              <li>The Goods are in their original packaging.</li>
            </ul>
            <p>The following Goods cannot be returned:</p>
            <ul className="space-y-1.5 list-disc list-inside text-neutral-600">
              <li>Goods made to your specifications or clearly personalised.</li>
              <li>
                Goods that, by their nature, are unsuitable for return,
                deteriorate rapidly, or have passed their expiry date.
              </li>
              <li>
                Goods unsuitable for return for health protection or hygiene
                reasons that were unsealed after delivery.
              </li>
              <li>
                Goods that, after delivery, are inseparably mixed with other
                items due to their nature.
              </li>
            </ul>
            <p>
              Returns that do not meet the conditions may be refused, subject
              to applicable law.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-black">
              Returning Goods
            </h3>
            <p>
              You are responsible for the cost and risk of returning the Goods,
              except where applicable law requires otherwise. RightNowLife
              recommends using an insured and trackable mail service. A refund
              cannot be issued without receiving the Goods or proof of return
              delivery.
            </p>
            <p>
              The return address in the official published policy is an
              unfilled placeholder, so no unverified return address is listed
              here.
            </p>
          </div>

          <div className="p-5 bg-neutral-100 border border-neutral-200">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-black">
              <Mail className="h-4 w-4" />
              Questions?
            </h3>
            <p>
              For questions about this Return and Refund Policy, email{" "}
              <a
                href={`mailto:${BRAND_INFO.supportEmail}`}
                className="font-bold text-black underline"
              >
                {BRAND_INFO.supportEmail}
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </StoreLayout>
  );
}
