"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Script from "next/script";
import {
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  ArrowLeft,
  MapPin,
  CreditCard,
  Package,
  AlertCircle,
  Truck,
  RotateCcw,
  Printer,
  Sparkles,
} from "lucide-react";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { useCart } from "@/context/cart-context";
import { useAuth } from "@/context/auth-context";
import { formatINR } from "@/lib/utils";
import { Address } from "@/types";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface ConfirmedOrderDetails {
  id: string;
  orderNumber: string;
  guestToken: string;
  total: number;
  subtotal: number;
  shipping: number;
  discount: number;
  items: any[];
  address: any;
  paymentId: string;
}

export default function CheckoutPage() {
  const { items, itemCount, subtotal, discount, shipping, total, clearBag } = useCart();
  const { user, isAuthenticated } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1); // 1: Details & Address, 2: Review, 3: Payment, 4: Confirmed
  const [selectedAddressId, setSelectedAddressId] = useState<string>(
    user?.addresses[0]?.id || "new"
  );

  // Customer Contact State
  const [customerEmail, setCustomerEmail] = useState(user?.email || "arjun@streetwear.in");

  // Address Form State
  const [addressForm, setAddressForm] = useState<Omit<Address, "id">>({
    fullName: user?.name || "Arjun Verma",
    phone: user?.phone?.replace(/^\+91\s?/, "") || "9876543210",
    addressLine1: "Flat 402, Skyline Residency",
    addressLine2: "12th Main, Indiranagar",
    landmark: "Near Defense Colony Park",
    city: "Bengaluru",
    state: "Karnataka",
    pinCode: "560038",
    isDefault: true,
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);

  // Pending Razorpay Order Details
  const [pendingServerOrder, setPendingServerOrder] = useState<any>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<ConfirmedOrderDetails | null>(null);

  const validateAddressStep = (): boolean => {
    const errors: Record<string, string> = {};

    if (!customerEmail || !customerEmail.includes("@")) {
      errors.email = "Please provide a valid email address";
    }

    if (!addressForm.fullName || addressForm.fullName.trim().length < 2) {
      errors.fullName = "Please enter your full name (at least 2 characters)";
    }

    const cleanPhone = addressForm.phone.replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      errors.phone = "Enter a valid 10-digit Indian mobile number (e.g. 9876543210)";
    }

    if (!addressForm.addressLine1 || addressForm.addressLine1.trim().length < 5) {
      errors.addressLine1 = "Please enter your building / flat number and street";
    }

    if (!addressForm.city || addressForm.city.trim().length < 2) {
      errors.city = "Please enter your city";
    }

    if (!addressForm.state || addressForm.state.trim().length < 2) {
      errors.state = "Please enter your state";
    }

    if (!/^[1-9][0-9]{5}$/.test(addressForm.pinCode.trim())) {
      errors.pinCode = "Please enter a valid 6-digit Indian PIN code";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleProceedToReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateAddressStep()) {
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleProceedToPayment = () => {
    setPaymentError(null);
    setStep(3);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Live Razorpay Payment Trigger
  const handleInitiateRazorpay = async () => {
    setIsProcessing(true);
    setPaymentError(null);

    try {
      // 1. Create order on server using trusted product prices (₹999)
      const res = await fetch("/api/checkout/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: addressForm.fullName,
          customerEmail,
          customerPhone: addressForm.phone,
          address: {
            ...addressForm,
            country: "India",
          },
          items: items.map((i) => ({
            productId: i.productId,
            size: i.size,
            quantity: i.quantity,
            color: i.color,
          })),
          promoCode: appliedPromo || promoInput || undefined,
          userId: user?.id,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setIsProcessing(false);
        setPaymentError(data.error || "Failed to initialize order with server.");
        return;
      }

      setPendingServerOrder(data);

      // Check if Razorpay client SDK is loaded
      if (typeof window !== "undefined" && window.Razorpay && !data.isTestMode) {
        const options = {
          key: data.keyId,
          amount: data.amount,
          currency: data.currency,
          name: "RIGHTNOWLIFE",
          description: `Streetwear Order #${data.orderNumber}`,
          image: "/logo.svg",
          order_id: data.razorpayOrderId,
          prefill: {
            name: addressForm.fullName,
            email: customerEmail,
            contact: addressForm.phone,
          },
          theme: {
            color: "#FFB900",
          },
          modal: {
            ondismiss: () => {
              setIsProcessing(false);
              setPaymentError("Payment window was closed. Your bag items have been preserved.");
            },
          },
          handler: async (response: any) => {
            await handleVerifyPayment(
              data.orderId,
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature,
              data
            );
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", (response: any) => {
          setIsProcessing(false);
          setPaymentError(
            `Payment declined: ${response.error?.description || "Card or UPI transaction failed"}. Your bag is preserved.`
          );
        });
        rzp.open();
      } else {
        // Test mode fallback: Allows immediate sandbox verification
        console.info("[Checkout] Ready for test mode verification:", data);
        setIsProcessing(false);
      }
    } catch (err: any) {
      console.error("Checkout submission failed:", err);
      setIsProcessing(false);
      setPaymentError(err.message || "Network error connecting to payment gateway.");
    }
  };

  // Cryptographic Signature Verification Callback
  const handleVerifyPayment = async (
    orderId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
    serverOrder: any
  ) => {
    setIsVerifying(true);
    setPaymentError(null);

    try {
      const res = await fetch("/api/checkout/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          razorpayOrderId,
          razorpayPaymentId,
          razorpaySignature,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Confirmation confirmed on server: Clear bag and show success screen
        clearBag();
        setConfirmedOrder({
          id: orderId,
          orderNumber: serverOrder.orderNumber,
          guestToken: data.guestToken || serverOrder.guestToken,
          total: serverOrder.pricing.total,
          subtotal: serverOrder.pricing.subtotal,
          shipping: serverOrder.pricing.shipping,
          discount: serverOrder.pricing.discount,
          items: [...items],
          address: { ...addressForm },
          paymentId: razorpayPaymentId,
        });
        setStep(4);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setPaymentError(data.error || "Cryptographic payment verification failed.");
      }
    } catch (err: any) {
      console.error("Payment verification call failed:", err);
      setPaymentError("Network error occurred during payment verification.");
    } finally {
      setIsVerifying(false);
      setIsProcessing(false);
    }
  };

  // Empty Bag Guard (unless on step 4)
  if (items.length === 0 && step !== 4) {
    return (
      <StoreLayout>
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <Package className="w-12 h-12 text-[#858585] mx-auto mb-4" />
          <h1 className="text-2xl font-black uppercase tracking-tight font-editorial mb-2">
            YOUR BAG IS EMPTY
          </h1>
          <p className="text-xs text-[#858585] mb-6">
            Add garments to your bag before proceeding to checkout.
          </p>
          <Link
            href="/shop"
            className="btn-morph btn-yellow px-6 py-3 text-xs uppercase tracking-widest font-black inline-flex items-center gap-2"
          >
            <span>Explore All Tees</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout>
      {/* External Razorpay checkout script */}
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumbs items={[{ label: "Bag", href: "/cart" }, { label: "Secure Checkout" }]} />

        {/* Step Progress Tracker */}
        {step !== 4 && (
          <div className="py-4 border-b border-[#E5E5E5] mb-8">
            <div className="flex items-center justify-between max-w-2xl mx-auto text-xs uppercase tracking-wider font-bold">
              <div className={`flex items-center gap-2 ${step >= 1 ? "text-[#111111]" : "text-[#858585]"}`}>
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                    step >= 1 ? "bg-[#111111] text-white" : "bg-[#F5F4F0] text-[#858585]"
                  }`}
                >
                  1
                </span>
                <span>Address</span>
              </div>
              <div className="h-0.5 w-12 sm:w-20 bg-[#E5E5E5]" />
              <div className={`flex items-center gap-2 ${step >= 2 ? "text-[#111111]" : "text-[#858585]"}`}>
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                    step >= 2 ? "bg-[#111111] text-white" : "bg-[#F5F4F0] text-[#858585]"
                  }`}
                >
                  2
                </span>
                <span>Review</span>
              </div>
              <div className="h-0.5 w-12 sm:w-20 bg-[#E5E5E5]" />
              <div className={`flex items-center gap-2 ${step >= 3 ? "text-[#111111]" : "text-[#858585]"}`}>
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                    step >= 3 ? "bg-[#111111] text-white" : "bg-[#F5F4F0] text-[#858585]"
                  }`}
                >
                  3
                </span>
                <span>Payment</span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: ORDER CONFIRMED VIEW */}
        {step === 4 && confirmedOrder && (
          <div className="max-w-3xl mx-auto py-8 space-y-8 animate-in fade-in duration-300">
            <div className="border border-[#E5E5E5] bg-white p-8 text-center space-y-4 shadow-sm">
              <div className="w-16 h-16 rounded-full bg-[#079447]/10 flex items-center justify-center text-[#079447] mx-auto mb-2">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#079447] font-bold">
                PAYMENT VERIFIED & RECORDED
              </span>
              <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight font-editorial">
                ORDER #{confirmedOrder.orderNumber}
              </h1>
              <p className="text-xs sm:text-sm text-[#858585] max-w-md mx-auto leading-relaxed">
                Thank you for your order. Your garments are being prepared for express air dispatch. A confirmation notification has been dispatched to{" "}
                <strong className="text-[#111111]">{customerEmail}</strong>.
              </p>

              <div className="p-3 bg-[#F5F4F0] border border-[#E5E5E5] text-xs font-mono text-[#111111] inline-block">
                Razorpay Payment ID: <strong>{confirmedOrder.paymentId}</strong>
              </div>

              {/* Item Summary Table */}
              <div className="text-left pt-6 border-t border-[#E5E5E5] space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111]">
                  Garments in This Order
                </h3>
                <div className="divide-y divide-[#E5E5E5]">
                  {confirmedOrder.items.map((item, idx) => (
                    <div key={idx} className="py-3 flex items-center justify-between gap-4 text-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative w-12 h-14 bg-[#F5F4F0] shrink-0 overflow-hidden">
                          <Image src={item.image} alt={item.productName} fill className="object-cover object-top" />
                        </div>
                        <div className="truncate">
                          <p className="font-bold uppercase text-[#111111] truncate">{item.productName}</p>
                          <p className="text-[11px] text-[#858585]">
                            Size: {item.size} • Qty: {item.quantity} • ₹999 each
                          </p>
                        </div>
                      </div>
                      <span className="font-bold text-[#111111] shrink-0">
                        {formatINR(999 * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-[#E5E5E5] space-y-1 text-xs text-[#858585]">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-semibold text-[#111111]">{formatINR(confirmedOrder.subtotal)}</span>
                  </div>
                  {confirmedOrder.discount > 0 && (
                    <div className="flex justify-between text-[#079447]">
                      <span>Discount</span>
                      <span>-{formatINR(confirmedOrder.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Express Air Shipping</span>
                    <span className="font-semibold text-[#111111]">
                      {confirmedOrder.shipping === 0 ? "FREE" : formatINR(confirmedOrder.shipping)}
                    </span>
                  </div>
                  <div className="flex justify-between text-base font-black text-[#111111] pt-2 border-t border-[#E5E5E5]">
                    <span>Total Paid</span>
                    <span>{formatINR(confirmedOrder.total)}</span>
                  </div>
                </div>

                <div className="pt-4 text-xs text-[#858585] space-y-1">
                  <p>
                    <strong>Delivery Address:</strong> {confirmedOrder.address.fullName}, {confirmedOrder.address.addressLine1}, {confirmedOrder.address.city}, {confirmedOrder.address.state} - {confirmedOrder.address.pinCode}
                  </p>
                  <p>
                    <strong>Mobile:</strong> +91 {confirmedOrder.address.phone}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-6 flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href={`/account/orders?email=${encodeURIComponent(customerEmail)}`}
                  className="btn-morph btn-dark px-6 py-3.5 text-xs uppercase tracking-widest font-black inline-flex items-center justify-center gap-2"
                >
                  <Truck className="w-4 h-4" /> View in Account Orders
                </Link>
                <Link
                  href="/shop"
                  className="btn-morph btn-yellow px-6 py-3.5 text-xs uppercase tracking-widest font-black inline-flex items-center justify-center gap-2"
                >
                  <span>Continue Shopping</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* STEPS 1 to 3: CHECKOUT WORKFLOW */}
        {step !== 4 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Main Stage (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Error Alert */}
              {paymentError && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold">Checkout Issue</p>
                    <p className="mt-0.5">{paymentError}</p>
                  </div>
                  <button
                    onClick={() => setPaymentError(null)}
                    className="text-red-600 hover:text-black font-bold uppercase text-[10px]"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* ── STEP 1: CONTACT & DELIVERY ADDRESS ── */}
              {step === 1 && (
                <form onSubmit={handleProceedToReview} className="space-y-6">
                  {/* Contact Information */}
                  <div className="border border-[#E5E5E5] bg-white p-6 space-y-4 shadow-sm">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[#111111] pb-2 border-b border-[#E5E5E5] flex items-center justify-between">
                      <span>1. Customer Contact</span>
                      <span className="text-[10px] text-[#858585] font-mono lowercase">required</span>
                    </h2>

                    <div className="space-y-1">
                      <label className="text-[11px] uppercase font-bold text-[#111111]">
                        Email Address for Order Updates *
                      </label>
                      <input
                        type="email"
                        required
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="you@domain.com"
                        className={`w-full px-3 py-2 text-xs border ${
                          formErrors.email ? "border-red-500" : "border-[#E5E5E5]"
                        } focus:border-[#111111] outline-none font-medium`}
                      />
                      {formErrors.email && (
                        <p className="text-[11px] text-red-600 font-medium">{formErrors.email}</p>
                      )}
                      <p className="text-[10px] text-[#858585]">
                        Invoice and real-time shipment updates will be sent to this email address.
                      </p>
                    </div>
                  </div>

                  {/* Delivery Address */}
                  <div className="border border-[#E5E5E5] bg-white p-6 space-y-4 shadow-sm">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[#111111] pb-2 border-b border-[#E5E5E5] flex items-center justify-between">
                      <span>2. Delivery Address</span>
                      <span className="text-[10px] text-[#079447] font-mono">Pan-India Express</span>
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[11px] uppercase font-bold text-[#111111]">
                          Recipient Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={addressForm.fullName}
                          onChange={(e) => setAddressForm({ ...addressForm, fullName: e.target.value })}
                          placeholder="Arjun Verma"
                          className={`w-full px-3 py-2 text-xs border ${
                            formErrors.fullName ? "border-red-500" : "border-[#E5E5E5]"
                          } focus:border-[#111111] outline-none font-medium`}
                        />
                        {formErrors.fullName && (
                          <p className="text-[11px] text-red-600">{formErrors.fullName}</p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] uppercase font-bold text-[#111111]">
                          Indian Mobile Number *
                        </label>
                        <div className="flex">
                          <span className="px-3 py-2 text-xs border border-r-0 border-[#E5E5E5] bg-[#F5F4F0] text-[#858585] font-mono">
                            +91
                          </span>
                          <input
                            type="tel"
                            required
                            maxLength={10}
                            value={addressForm.phone}
                            onChange={(e) =>
                              setAddressForm({
                                ...addressForm,
                                phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                              })
                            }
                            placeholder="9876543210"
                            className={`w-full px-3 py-2 text-xs border ${
                              formErrors.phone ? "border-red-500" : "border-[#E5E5E5]"
                            } focus:border-[#111111] outline-none font-medium font-mono`}
                          />
                        </div>
                        {formErrors.phone && (
                          <p className="text-[11px] text-red-600">{formErrors.phone}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] uppercase font-bold text-[#111111]">
                        Flat / House No., Apartment & Street *
                      </label>
                      <input
                        type="text"
                        required
                        value={addressForm.addressLine1}
                        onChange={(e) => setAddressForm({ ...addressForm, addressLine1: e.target.value })}
                        placeholder="Flat 402, Skyline Residency, 12th Main"
                        className={`w-full px-3 py-2 text-xs border ${
                          formErrors.addressLine1 ? "border-red-500" : "border-[#E5E5E5]"
                        } focus:border-[#111111] outline-none font-medium`}
                      />
                      {formErrors.addressLine1 && (
                        <p className="text-[11px] text-red-600">{formErrors.addressLine1}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[11px] uppercase font-bold text-[#111111]">
                          Area / Colony (Optional)
                        </label>
                        <input
                          type="text"
                          value={addressForm.addressLine2 || ""}
                          onChange={(e) => setAddressForm({ ...addressForm, addressLine2: e.target.value })}
                          placeholder="Indiranagar Stage 2"
                          className="w-full px-3 py-2 text-xs border border-[#E5E5E5] focus:border-[#111111] outline-none font-medium"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] uppercase font-bold text-[#111111]">
                          Landmark (Optional)
                        </label>
                        <input
                          type="text"
                          value={addressForm.landmark || ""}
                          onChange={(e) => setAddressForm({ ...addressForm, landmark: e.target.value })}
                          placeholder="Near Defense Colony Park"
                          className="w-full px-3 py-2 text-xs border border-[#E5E5E5] focus:border-[#111111] outline-none font-medium"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="text-[11px] uppercase font-bold text-[#111111]">
                          Postal PIN Code *
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={6}
                          value={addressForm.pinCode}
                          onChange={(e) =>
                            setAddressForm({
                              ...addressForm,
                              pinCode: e.target.value.replace(/\D/g, "").slice(0, 6),
                            })
                          }
                          placeholder="560038"
                          className={`w-full px-3 py-2 text-xs border ${
                            formErrors.pinCode ? "border-red-500" : "border-[#E5E5E5]"
                          } focus:border-[#111111] outline-none font-mono font-medium`}
                        />
                        {formErrors.pinCode && (
                          <p className="text-[11px] text-red-600">{formErrors.pinCode}</p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] uppercase font-bold text-[#111111]">
                          City *
                        </label>
                        <input
                          type="text"
                          required
                          value={addressForm.city}
                          onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                          placeholder="Bengaluru"
                          className={`w-full px-3 py-2 text-xs border ${
                            formErrors.city ? "border-red-500" : "border-[#E5E5E5]"
                          } focus:border-[#111111] outline-none font-medium`}
                        />
                        {formErrors.city && (
                          <p className="text-[11px] text-red-600">{formErrors.city}</p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] uppercase font-bold text-[#111111]">
                          State *
                        </label>
                        <input
                          type="text"
                          required
                          value={addressForm.state}
                          onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                          placeholder="Karnataka"
                          className={`w-full px-3 py-2 text-xs border ${
                            formErrors.state ? "border-red-500" : "border-[#E5E5E5]"
                          } focus:border-[#111111] outline-none font-medium`}
                        />
                        {formErrors.state && (
                          <p className="text-[11px] text-red-600">{formErrors.state}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="btn-morph btn-yellow px-8 py-4 text-xs uppercase tracking-widest font-black flex items-center gap-2 shadow-sm"
                    >
                      <span>Continue to Order Review</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              )}

              {/* ── STEP 2: REVIEW ORDER & CONFIRM ADDRESS ── */}
              {step === 2 && (
                <div className="space-y-6">
                  {/* Delivery Address Review */}
                  <div className="border border-[#E5E5E5] bg-white p-6 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between pb-2 border-b border-[#E5E5E5]">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-[#111111] flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-[#0876A8]" />
                        <span>Deliver To</span>
                      </h2>
                      <button
                        onClick={() => setStep(1)}
                        className="text-xs font-bold uppercase tracking-wider text-[#0876A8] hover:underline"
                      >
                        Edit
                      </button>
                    </div>
                    <p className="text-xs font-bold text-[#111111]">{addressForm.fullName}</p>
                    <p className="text-xs text-[#858585] leading-relaxed">
                      {addressForm.addressLine1}
                      {addressForm.addressLine2 ? `, ${addressForm.addressLine2}` : ""}
                      {addressForm.landmark ? ` (Landmark: ${addressForm.landmark})` : ""}
                      <br />
                      {addressForm.city}, {addressForm.state} — {addressForm.pinCode}, India
                    </p>
                    <p className="text-xs text-[#858585] font-mono">
                      Phone: +91 {addressForm.phone} • Email: {customerEmail}
                    </p>
                  </div>

                  {/* Garments Breakdown */}
                  <div className="border border-[#E5E5E5] bg-white p-6 space-y-4 shadow-sm">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[#111111] pb-2 border-b border-[#E5E5E5]">
                      Selected Garments ({itemCount})
                    </h2>
                    <div className="divide-y divide-[#E5E5E5]">
                      {items.map((item) => (
                        <div key={item.id} className="py-3 flex gap-4 items-center">
                          <div className="relative w-16 h-20 bg-[#F5F4F0] shrink-0 overflow-hidden">
                            <Image src={item.image} alt={item.productName} fill className="object-cover object-top" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-xs font-bold uppercase text-[#111111] truncate">{item.productName}</h3>
                            <p className="text-[11px] text-[#858585] mt-0.5">
                              Size: <strong>{item.size}</strong> • Color: {item.color} • Qty: {item.quantity}
                            </p>
                            <span className="text-[10px] font-mono text-[#0876A8]">Fixed Price: ₹999 per unit</span>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-black text-[#111111]">{formatINR(999 * item.quantity)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setStep(1)}
                      className="text-xs uppercase tracking-wider font-bold text-[#858585] hover:text-[#111111] flex items-center gap-1.5"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Back to Address
                    </button>
                    <button
                      onClick={handleProceedToPayment}
                      className="btn-morph btn-yellow px-8 py-4 text-xs uppercase tracking-widest font-black flex items-center gap-2 shadow-sm"
                    >
                      <span>Proceed to Payment</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 3: RAZORPAY PAYMENT GATEWAY ── */}
              {step === 3 && (
                <div className="space-y-6">
                  <div className="border border-[#E5E5E5] bg-white p-6 space-y-4 shadow-sm">
                    <div className="flex items-center justify-between pb-2 border-b border-[#E5E5E5]">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-[#111111] flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-[#FFB900]" />
                        <span>Select Payment Gateway</span>
                      </h2>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-[#079447] font-bold flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> 256-Bit Encrypted
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div className="p-4 border-2 border-[#111111] bg-[#F5F4F0] flex items-start gap-3">
                        <input
                          type="radio"
                          name="paymentProvider"
                          checked
                          readOnly
                          className="mt-1 w-4 h-4 accent-[#111111]"
                        />
                        <div className="space-y-1">
                          <p className="text-xs font-black text-[#111111] uppercase tracking-wide">
                            Razorpay Payment Gateway (Official Integration)
                          </p>
                          <p className="text-[11px] text-[#858585] leading-relaxed">
                            Pay securely via <strong>UPI (GPay, PhonePe, Paytm), Debit/Credit Cards, or Net Banking</strong>. Verified server-side signature protocol.
                          </p>
                          <div className="pt-2 flex flex-wrap gap-2 text-[10px] font-mono text-[#111111]">
                            <span className="px-2 py-0.5 bg-white border border-[#E5E5E5]">UPI / QR</span>
                            <span className="px-2 py-0.5 bg-white border border-[#E5E5E5]">Cards (Visa, RuPay, MC)</span>
                            <span className="px-2 py-0.5 bg-white border border-[#E5E5E5]">NetBanking (50+ Banks)</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Test Mode Interactive Sandbox Option */}
                    {pendingServerOrder?.isTestMode && (
                      <div className="mt-4 p-4 bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-2">
                        <div className="flex items-center gap-1.5 font-bold">
                          <Sparkles className="w-4 h-4 text-amber-700" />
                          <span>Local Test Sandbox Active</span>
                        </div>
                        <p className="text-[11px] leading-relaxed">
                          Server generated order ID: <code className="font-bold">{pendingServerOrder.razorpayOrderId}</code>. Click below to verify and complete the mock transaction with server-side inventory commitment.
                        </p>
                        <button
                          onClick={() =>
                            handleVerifyPayment(
                              pendingServerOrder.orderId,
                              pendingServerOrder.razorpayOrderId,
                              `pay_test_${Date.now()}`,
                              "test_signature_mock",
                              pendingServerOrder
                            )
                          }
                          disabled={isVerifying}
                          className="btn-morph btn-dark px-4 py-2 text-[11px] uppercase tracking-wider font-bold inline-flex items-center gap-2"
                        >
                          {isVerifying ? "Verifying..." : "Complete Simulated Test Payment"}
                        </button>
                      </div>
                    )}

                    <div className="pt-4 flex items-center justify-between border-t border-[#E5E5E5]">
                      <button
                        onClick={() => setStep(2)}
                        className="text-xs uppercase tracking-wider font-bold text-[#858585] hover:text-[#111111] flex items-center gap-1"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" /> Back to Review
                      </button>

                      <button
                        onClick={handleInitiateRazorpay}
                        disabled={isProcessing || isVerifying}
                        className="btn-morph btn-yellow px-8 py-4 text-xs uppercase tracking-widest font-black flex items-center gap-2 shadow-md disabled:opacity-50"
                      >
                        <Lock className="w-4 h-4" />
                        <span>
                          {isVerifying
                            ? "Verifying Signature..."
                            : isProcessing
                            ? "Opening Razorpay..."
                            : `Authorize & Pay ${formatINR(total)}`}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar Order Summary (5 cols) */}
            <div className="lg:col-span-5">
              <div className="border border-[#E5E5E5] bg-white p-6 space-y-4 shadow-sm sticky top-24">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111] pb-2 border-b border-[#E5E5E5]">
                  Order Summary ({itemCount} {itemCount === 1 ? "Item" : "Items"})
                </h3>

                {/* Items preview list */}
                <div className="max-h-60 overflow-y-auto divide-y divide-[#E5E5E5] pr-1">
                  {items.map((item) => (
                    <div key={item.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold uppercase text-[#111111] truncate">{item.productName}</p>
                        <p className="text-[11px] text-[#858585]">
                          Size: {item.size} • Qty: {item.quantity} (₹999 each)
                        </p>
                      </div>
                      <span className="font-semibold text-[#111111] shrink-0">
                        {formatINR(999 * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Promo Code Input */}
                <div className="pt-2 border-t border-[#E5E5E5]">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value)}
                      placeholder="Promo (DROP20, RNLFIRST)"
                      className="flex-1 px-3 py-1.5 text-xs border border-[#E5E5E5] focus:border-[#111111] outline-none uppercase font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (promoInput.trim()) {
                          setAppliedPromo(promoInput.trim().toUpperCase());
                        }
                      }}
                      className="btn-morph btn-dark px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold"
                    >
                      Apply
                    </button>
                  </div>
                  {appliedPromo && (
                    <p className="text-[10px] text-[#079447] font-bold mt-1">
                      Promo code applied: {appliedPromo}
                    </p>
                  )}
                </div>

                {/* Price Calculation Breakdown */}
                <div className="space-y-1.5 text-xs text-[#858585] pt-2 border-t border-[#E5E5E5]">
                  <div className="flex justify-between">
                    <span>Item Subtotal</span>
                    <span className="font-semibold text-[#111111]">{formatINR(subtotal)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-[#079447] font-medium">
                      <span>Promotional Discount</span>
                      <span>-{formatINR(discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Express Air Shipping</span>
                    <span className="font-semibold text-[#111111]">
                      {shipping === 0 ? "FREE" : formatINR(shipping)}
                    </span>
                  </div>
                  <div className="flex justify-between text-base font-black text-[#111111] pt-3 border-t border-[#E5E5E5]">
                    <span>Total Amount</span>
                    <span>{formatINR(total)}</span>
                  </div>
                </div>

                <div className="pt-2 text-[10px] text-[#858585] space-y-1">
                  <p>• Fixed pricing: Strictly ₹999 per T-shirt (GST included).</p>
                  <p>• Free shipping automatically applies on orders above ₹1,499.</p>
                  <p>• Covered by RightNowLife 7-day size exchange guarantee.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </StoreLayout>
  );
}
