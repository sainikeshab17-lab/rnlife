"use client";

import React from "react";
import Link from "next/link";
import { Truck, Clock, ShieldCheck, MapPin } from "lucide-react";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";

export default function ShippingPage() {
  return (
    <StoreLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumbs items={[{ label: "Shipping & Delivery Information" }]} />

        <div className="py-8 border-b border-neutral-200">
          <span className="text-[11px] uppercase tracking-widest font-mono text-neutral-500 font-bold block mb-1">
            LOGISTICS & DISPATCH
          </span>
          <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight font-editorial">
            SHIPPING POLICY
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 mt-2">
            Pan-India express air courier shipping for all RightNowLife streetwear drops.
          </p>
        </div>

        <div className="py-8 space-y-8 text-xs text-neutral-700 leading-relaxed">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 bg-[#F5F4F0] border border-neutral-200 space-y-2">
              <Truck className="w-5 h-5 text-black" />
              <p className="font-bold text-sm text-black uppercase">Free Shipping Threshold</p>
              <p className="text-neutral-600">
                Orders above ₹1,499 qualify for 100% FREE express air shipping across India. For orders below ₹1,499, a flat delivery fee of ₹99 applies.
              </p>
            </div>

            <div className="p-5 bg-[#F5F4F0] border border-neutral-200 space-y-2">
              <Clock className="w-5 h-5 text-black" />
              <p className="font-bold text-sm text-black uppercase">Dispatch Timeline</p>
              <p className="text-neutral-600">
                All confirmed drop orders are dispatched from our central fulfillment facility within 24 to 48 business hours.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-black">
              Estimated Delivery Timeframes
            </h2>
            <div className="border border-neutral-200 divide-y divide-neutral-200 bg-white">
              <div className="p-3 flex justify-between">
                <span className="font-semibold text-black">Metro Cities (Bengaluru, Mumbai, Delhi NCR, Hyderabad, Chennai)</span>
                <span className="font-mono text-neutral-700 font-bold">2 - 3 Business Days</span>
              </div>
              <div className="p-3 flex justify-between">
                <span className="font-semibold text-black">Tier-2 Cities & State Capitals</span>
                <span className="font-mono text-neutral-700 font-bold">3 - 4 Business Days</span>
              </div>
              <div className="p-3 flex justify-between">
                <span className="font-semibold text-black">Rest of India & Remote Postal Zones</span>
                <span className="font-mono text-neutral-700 font-bold">4 - 6 Business Days</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-black">
              Shipment Tracking & Courier Partners
            </h2>
            <p>
              We partner with India&apos;s leading air logistics networks including Delhivery, BlueDart, and Shadowfax. Once your parcel is scanned at the hub, an automated tracking SMS and email containing the live Air Waybill (AWB) number will be sent to your registered contact.
            </p>
            <p>
              You can also track your shipment live at any time through your{" "}
              <Link href="/account/orders" className="font-bold text-black underline">
                Account Orders Dashboard
              </Link>.
            </p>
          </div>

          <div className="p-4 bg-neutral-100 border border-neutral-200 text-[11px] text-neutral-500 font-mono">
            [Phase 1 Prototype Content: Policy placeholders reflect development sample terms]
          </div>
        </div>
      </div>
    </StoreLayout>
  );
}
