"use client";

import React from "react";
import Link from "next/link";
import { Truck, Clock, ShieldCheck, MapPin } from "lucide-react";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { BRAND_INFO } from "@/data/mock-data";

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
            Last updated: 16 October 2026. Thank you for shopping at RightNowLife. This Shipping Policy explains how orders placed through our website are processed and delivered.
          </p>
        </div>

        <div className="py-8 space-y-8 text-xs text-neutral-700 leading-relaxed">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 bg-[#F5F4F0] border border-neutral-200 space-y-2">
              <Truck className="w-5 h-5 text-black" />
              <p className="font-bold text-sm text-black uppercase">Order Processing</p>
              <p className="text-neutral-600">
                We aim to process and dispatch orders as quickly as reasonably possible. Orders are generally processed within 1–2 business days after payment confirmation.
              </p>
            </div>

            <div className="p-5 bg-[#F5F4F0] border border-neutral-200 space-y-2">
              <Clock className="w-5 h-5 text-black" />
              <p className="font-bold text-sm text-black uppercase">Delivery Timeline</p>
              <p className="text-neutral-600">
                We aim to deliver orders within an estimated 3–7 business days after dispatch, depending on the delivery destination and courier service.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-black">Shipping Information</h2>
            <p>
              Available shipping options and applicable charges will be displayed during checkout, where supported. Shipping charges depend on the delivery destination, order details, and available shipping service. If free shipping is offered for a particular order or promotion, the applicable conditions will be displayed on our website.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-black">Tracking & Courier Support</h2>
            <p>
              Once your order has been dispatched, tracking information will be shared through the communication channel available for your order, where supported by our shipping partner. You may use the tracking details provided to check the progress of your shipment.
            </p>
            <p>
              Please refer to the delivery estimate displayed at checkout or communicated with your order, where available. Remote locations, courier delays, weather conditions, public holidays, and other circumstances may affect delivery.
            </p>
          </div>

          <div className="p-5 bg-neutral-100 border border-neutral-200 text-neutral-600">
            <p>
              For live order updates, visit your <Link href="/account/orders" className="font-bold text-black underline">Account Orders Dashboard</Link> or contact the team via <a href={`mailto:${BRAND_INFO.supportEmail}`} className="font-bold text-black underline">{BRAND_INFO.supportEmail}</a>.
            </p>
          </div>
        </div>
      </div>
    </StoreLayout>
  );
}
