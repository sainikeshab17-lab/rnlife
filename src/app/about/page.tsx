"use client";

import React from "react";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { BRAND_INFO } from "@/data/mock-data";

export default function AboutPage() {
  return (
    <StoreLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumbs items={[{ label: "About RightNowLife" }]} />

        <div className="py-12 sm:py-16 text-center max-w-3xl mx-auto space-y-4">
          <span className="text-[11px] uppercase tracking-widest-custom font-mono text-neutral-500 font-bold">
            ABOUT US
          </span>
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black uppercase tracking-tight font-editorial">
            ABOUT RIGHTNOWLIFE
          </h1>
          <p className="text-sm sm:text-base text-neutral-600 leading-relaxed max-w-2xl mx-auto">
            {BRAND_INFO.aboutStory}
          </p>
        </div>

        <div className="mx-auto max-w-4xl space-y-10 border-t border-neutral-200 py-12 text-sm leading-relaxed text-neutral-700">
          <section className="space-y-3">
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight font-editorial">
              Our Story
            </h2>
            <p>
              RightNowLife was founded with a simple mission: to offer customers
              the best products at competitive prices while maintaining the
              highest standards of service. What started as a small business has
              grown into a trusted name that customers rely on for their
              shopping needs.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-black uppercase tracking-tight font-editorial">
              What We Do
            </h2>
            <p>
              We specialize in carefully curating and offering a wide range of
              products that meet our customers&apos; diverse needs. Our team works
              to ensure that every product we offer meets our quality standards.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-black uppercase tracking-tight font-editorial">
              Our Commitment
            </h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Quality:</strong> We source products that meet our
                quality standards.
              </li>
              <li>
                <strong>Customer Service:</strong> Our team is ready to assist
                with questions or concerns.
              </li>
              <li>
                <strong>Value:</strong> We strive to offer competitive prices
                without compromising on quality.
              </li>
              <li>
                <strong>Trust:</strong> We aim to build customer relationships
                through transparency and reliability.
              </li>
              <li>
                <strong>Innovation:</strong> We continuously work to improve
                our services and shopping experience.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-black uppercase tracking-tight font-editorial">
              Why Choose Us?
            </h2>
            <p>
              Our commitment to quality, service, and value is at the heart of
              the experience we aim to provide.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-black uppercase tracking-tight font-editorial">
              Looking Forward
            </h2>
            <p>
              As we continue to grow, our focus remains on serving customers
              with dedication and integrity, expanding our product offerings,
              and improving our services to meet evolving needs.
            </p>
            <p>
              Thank you for choosing RightNowLife. We appreciate your business
              and look forward to serving you.
            </p>
          </section>
        </div>
      </div>
    </StoreLayout>
  );
}
