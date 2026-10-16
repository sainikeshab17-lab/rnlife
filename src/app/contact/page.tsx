"use client";

import React, { useState } from "react";
import { Mail, Clock, MapPin, Send, CheckCircle2 } from "lucide-react";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { BRAND_INFO } from "@/data/mock-data";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name && form.email && form.message) {
      setIsSubmitted(true);
    }
  };

  return (
    <StoreLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumbs items={[{ label: "Contact RightNowLife" }]} />

        <div className="py-8 border-b border-neutral-200">
          <span className="text-[11px] uppercase tracking-widest font-mono text-neutral-500 font-bold block mb-1">
            SUPPORT & STUDIO INQUIRIES
          </span>
          <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight font-editorial">
            CONTACT RIGHTNOWLIFE
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 mt-2">
            Have questions about fit, fabric GSM, order status, or drop releases? Reach out to our team.
          </p>
        </div>

        <div className="py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Support Information (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="p-6 bg-[#F5F4F0] border border-neutral-200 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-black">
                Customer Care Desk
              </h3>
              <div className="space-y-3 text-xs text-neutral-700">
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-black shrink-0 mt-0.5" />
                  <div>
                    <span className="text-neutral-500 block">Direct Email:</span>
                    <a href={`mailto:${BRAND_INFO.supportEmail}`} className="font-bold text-black underline">
                      {BRAND_INFO.supportEmail}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-black shrink-0 mt-0.5" />
                  <div>
                    <span className="text-neutral-500 block">Support Hours:</span>
                    <span className="font-semibold text-black">{BRAND_INFO.supportHours}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-black shrink-0 mt-0.5" />
                  <div>
                    <span className="text-neutral-500 block">Design Studio:</span>
                    <span className="text-neutral-800">
                      RightNowLife Collective, Indiranagar, Bengaluru, Karnataka, India
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-neutral-100 border border-neutral-200 text-[11px] text-neutral-500 font-mono">
              [Phase 1 Prototype: Messages submitted via this form are recorded in demo fixtures]
            </div>
          </div>

          {/* Contact Form (7 cols) */}
          <div className="lg:col-span-7">
            <div className="border border-neutral-200 bg-white p-6 sm:p-8 shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-wider text-black mb-4">
                Send Us a Message
              </h3>

              {isSubmitted ? (
                <div className="p-6 bg-emerald-50 border border-emerald-200 text-center text-xs text-emerald-900 space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <p className="font-bold text-sm">Message Sent to RightNowLife Team</p>
                  <p className="text-neutral-600">
                    Thank you, {form.name}. We will get back to your email ({form.email}) within 24 business hours.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[11px] uppercase font-bold text-neutral-800">
                        Your Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
                        placeholder="Rohan Sharma"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] uppercase font-bold text-neutral-800">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
                        placeholder="rohan@example.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] uppercase font-bold text-neutral-800">
                      Subject
                    </label>
                    <input
                      type="text"
                      value={form.subject}
                      onChange={(e) => setForm({ ...form, subject: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
                      placeholder="Size recommendation / Order query"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] uppercase font-bold text-neutral-800">
                      Message *
                    </label>
                    <textarea
                      required
                      rows={5}
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
                      placeholder="How can we assist you with our T-shirt collections?"
                    />
                  </div>

                  <button
                    type="submit"
                    className="px-8 py-3.5 bg-black hover:bg-neutral-800 text-white text-xs uppercase tracking-widest font-black transition-colors inline-flex items-center gap-2"
                  >
                    <span>Send Inquiry</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </StoreLayout>
  );
}
