"use client";

import React from "react";
import { Mail } from "lucide-react";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { BRAND_INFO } from "@/data/mock-data";
import { STORE_POLICIES } from "@/lib/policies";

export default function ReturnsPage() {
  return (
    <StoreLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumbs items={[{ label: "Returns, Exchanges & Refunds" }]} />
        <div className="py-8 border-b border-neutral-200">
          <span className="text-[11px] uppercase tracking-widest font-mono text-neutral-500 font-bold block mb-1">CUSTOMER POLICY</span>
          <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight font-editorial">RETURNS & EXCHANGES</h1>
          <p className="text-xs sm:text-sm text-neutral-600 mt-2">This page is the single source for return, exchange, and refund requests.</p>
        </div>
        <div className="py-8 space-y-8 text-xs text-neutral-700 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-black">Size exchanges</h2>
            <p>Submit an exchange request within {STORE_POLICIES.returns.windowDays} days after delivery through Account → Orders, selecting the item and requested size, or email {BRAND_INFO.supportEmail}. Support will review the request, confirm eligibility and check that the requested size is in stock before arranging completion. A request is not confirmation that a replacement is reserved.</p>
            <p>Keep the item and its tags together while the request is reviewed. The team will provide return instructions and confirm the exchange outcome. The item-condition standard beyond inspection, pickup/return shipping charges, and the exchange shipping process still require owner approval; contact support before sending anything back.</p>
          </section>
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-black">Returns and refunds</h2>
            <p>Submit a return request within {STORE_POLICIES.returns.windowDays} days after delivery through Account → Orders or by emailing {BRAND_INFO.supportEmail}. Requests are reviewed by the team. Refunds are handled separately from size exchanges and are processed only after the return is approved and the applicable payment/refund flow is completed. The refund amount and timing depend on the order and payment provider.</p>
            <p>Do not ship a return until support provides instructions. No verified return address is available in the project, so an address is not published here.</p>
          </section>
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-black">Cancellation</h2>
            <p>Cancellation eligibility depends on the order status and configured cancellation window. Use the cancellation action in Account → Orders when it is available, or contact support for help.</p>
          </section>
          <section className="space-y-3 border border-amber-200 bg-amber-50 p-4 text-amber-950">
            <h2 className="text-sm font-bold uppercase tracking-wider">Policy details awaiting owner confirmation</h2>
            <p>Before publishing a final policy, confirm the return address, item-condition and tag requirements, return and exchange shipping charges, and exact exchange completion steps. The current application configuration uses a {STORE_POLICIES.returns.windowDays}-day request window after delivery.</p>
          </section>
          <div className="p-5 bg-neutral-100 border border-neutral-200">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-black"><Mail className="h-4 w-4" />Questions?</h3>
            <p>Email <a href={`mailto:${BRAND_INFO.supportEmail}`} className="font-bold text-black underline">{BRAND_INFO.supportEmail}</a> before sending an item.</p>
          </div>
        </div>
      </div>
    </StoreLayout>
  );
}
