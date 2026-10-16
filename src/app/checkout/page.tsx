"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
} from "lucide-react";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { useCart } from "@/context/cart-context";
import { useAuth } from "@/context/auth-context";
import { formatINR } from "@/lib/utils";
import { Address } from "@/types";

export default function CheckoutPage() {
  const { items, itemCount, subtotal, discount, shipping, total, clearBag } = useCart();
  const { user, isAuthenticated, login } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1); // 1: Address, 2: Review, 3: Payment, 4: Confirmed
  const [selectedAddressId, setSelectedAddressId] = useState<string>(
    user?.addresses[0]?.id || "new"
  );

  // New Address Form State
  const [addressForm, setAddressForm] = useState<Omit<Address, "id">>({
    fullName: user?.name || "Arjun Verma",
    phone: user?.phone || "+91 98765 43210",
    addressLine1: "Flat 402, Skyline Residency",
    addressLine2: "12th Main, Indiranagar",
    landmark: "Near Defense Colony Park",
    city: "Bengaluru",
    state: "Karnataka",
    pinCode: "560038",
    isDefault: true,
  });

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<
    "upi" | "card" | "netbanking" | "cod"
  >("upi");
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmedOrderNumber, setConfirmedOrderNumber] = useState<string>("");

  const handleProceedToReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressForm.fullName || !addressForm.phone || !addressForm.addressLine1 || !addressForm.pinCode) {
      alert("Please complete the required delivery address fields.");
      return;
    }
    setStep(2);
  };

  const handleProceedToPayment = () => {
    setStep(3);
  };

  const handleSimulatePayment = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const orderNum = `RNL-${Math.floor(10000 + Math.random() * 90000)}`;
      setConfirmedOrderNumber(orderNum);
      setIsProcessing(false);
      setStep(4);
      clearBag();
    }, 1200);
  };

  // If bag is empty and not on confirmation step
  if (items.length === 0 && step !== 4) {
    return (
      <StoreLayout>
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <Package className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
          <h1 className="text-2xl font-black uppercase tracking-tight font-editorial mb-2">
            YOUR BAG IS EMPTY
          </h1>
          <p className="text-xs text-neutral-500 mb-6">
            Add items to your bag before proceeding to checkout.
          </p>
          <Link
            href="/shop"
            className="px-6 py-3 bg-black text-white text-xs uppercase tracking-widest font-black inline-flex items-center gap-2"
          >
            <span>Explore Drops</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumbs items={[{ label: "Bag", href: "/cart" }, { label: "Checkout" }]} />

        {/* Phase 1 Prototype Banner */}
        <div className="mt-2 mb-6 p-3 bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong>Phase 1 Checkout Prototype:</strong> Demonstrates the complete multi-step delivery address, review, and Razorpay payment authorization sequence. No real monetary transactions will occur.
          </div>
        </div>

        {/* Step Progress Tracker */}
        {step !== 4 && (
          <div className="py-4 border-b border-neutral-200 mb-8">
            <div className="flex items-center justify-between max-w-2xl mx-auto text-xs uppercase tracking-wider font-bold">
              <div
                className={`flex items-center gap-2 ${
                  step >= 1 ? "text-black" : "text-neutral-400"
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                    step >= 1 ? "bg-black text-white" : "bg-neutral-200 text-neutral-500"
                  }`}
                >
                  1
                </span>
                <span>Address</span>
              </div>
              <div className="h-0.5 w-12 sm:w-20 bg-neutral-200" />
              <div
                className={`flex items-center gap-2 ${
                  step >= 2 ? "text-black" : "text-neutral-400"
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                    step >= 2 ? "bg-black text-white" : "bg-neutral-200 text-neutral-500"
                  }`}
                >
                  2
                </span>
                <span>Review</span>
              </div>
              <div className="h-0.5 w-12 sm:w-20 bg-neutral-200" />
              <div
                className={`flex items-center gap-2 ${
                  step >= 3 ? "text-black" : "text-neutral-400"
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                    step >= 3 ? "bg-black text-white" : "bg-neutral-200 text-neutral-500"
                  }`}
                >
                  3
                </span>
                <span>Payment</span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: ORDER CONFIRMATION PREVIEW */}
        {step === 4 ? (
          <div className="py-12 max-w-2xl mx-auto text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-black text-[#B8FF3B] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <span className="text-[11px] uppercase tracking-widest font-mono text-neutral-500 font-bold">
                PROTOTYPE ORDER RECORDED
              </span>
              <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight font-editorial">
                ORDER CONFIRMED: {confirmedOrderNumber}
              </h1>
              <p className="text-xs sm:text-sm text-neutral-600 max-w-md mx-auto leading-relaxed">
                Thank you, <strong>{addressForm.fullName}</strong>. Your prototype streetwear order has been logged into our development fixture store.
              </p>
            </div>

            {/* Delivery Summary Box */}
            <div className="p-6 bg-[#F5F4F0] border border-neutral-200 text-left text-xs space-y-3">
              <div className="flex justify-between border-b border-neutral-200 pb-2">
                <span className="text-neutral-500 font-medium">Order Reference:</span>
                <span className="font-mono font-bold text-black">{confirmedOrderNumber}</span>
              </div>
              <div className="flex justify-between border-b border-neutral-200 pb-2">
                <span className="text-neutral-500 font-medium">Payment Protocol:</span>
                <span className="font-bold text-emerald-700">Razorpay Demo Authorized</span>
              </div>
              <div className="flex justify-between border-b border-neutral-200 pb-2">
                <span className="text-neutral-500 font-medium">Total Amount:</span>
                <span className="font-black text-black">{formatINR(total)}</span>
              </div>
              <div>
                <span className="text-neutral-500 font-medium block mb-1">Shipping To:</span>
                <p className="font-semibold text-neutral-900">
                  {addressForm.fullName} • {addressForm.phone}
                </p>
                <p className="text-neutral-600">
                  {addressForm.addressLine1}, {addressForm.addressLine2 && `${addressForm.addressLine2}, `}
                  {addressForm.city}, {addressForm.state} – {addressForm.pinCode}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Link
                href="/account/orders"
                className="px-8 py-3.5 bg-black text-white hover:bg-neutral-800 text-xs uppercase tracking-widest font-black transition-colors"
              >
                View in Account Orders
              </Link>
              <Link
                href="/shop"
                className="px-8 py-3.5 border border-neutral-300 hover:border-black text-neutral-800 text-xs uppercase tracking-widest font-black transition-colors"
              >
                Continue Shopping
              </Link>
            </div>
          </div>
        ) : (
          /* STEPS 1 TO 3 LAYOUT */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 pb-16">
            {/* Main Step Interaction (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* STEP 1: DELIVERY ADDRESS */}
              {step === 1 && (
                <div className="border border-neutral-200 p-6 bg-white space-y-6">
                  <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-black flex items-center gap-2">
                      <MapPin className="w-4 h-4" /> 1. Delivery Address
                    </h2>
                    <span className="text-xs text-neutral-400 font-mono">Pan-India Express</span>
                  </div>

                  {/* Saved Address selector if user exists */}
                  {user && user.addresses.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wider font-bold text-neutral-700">
                        Saved Addresses:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {user.addresses.map((addr) => (
                          <div
                            key={addr.id}
                            onClick={() => {
                              setSelectedAddressId(addr.id);
                              setAddressForm({
                                fullName: addr.fullName,
                                phone: addr.phone,
                                addressLine1: addr.addressLine1,
                                addressLine2: addr.addressLine2 || "",
                                landmark: addr.landmark || "",
                                city: addr.city,
                                state: addr.state,
                                pinCode: addr.pinCode,
                                isDefault: addr.isDefault,
                              });
                            }}
                            className={`p-3 border text-xs cursor-pointer transition-colors ${
                              selectedAddressId === addr.id
                                ? "border-black bg-[#F5F4F0]"
                                : "border-neutral-200 hover:border-neutral-400"
                            }`}
                          >
                            <p className="font-bold text-black">{addr.fullName}</p>
                            <p className="text-neutral-600 mt-1 line-clamp-2">
                              {addr.addressLine1}, {addr.city} - {addr.pinCode}
                            </p>
                            <span className="text-[10px] text-neutral-500 font-mono mt-1 block">
                              {addr.phone}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Address Input Form */}
                  <form onSubmit={handleProceedToReview} className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-700">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={addressForm.fullName}
                          onChange={(e) =>
                            setAddressForm({ ...addressForm, fullName: e.target.value })
                          }
                          className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-700">
                          Contact Phone *
                        </label>
                        <input
                          type="text"
                          required
                          value={addressForm.phone}
                          onChange={(e) =>
                            setAddressForm({ ...addressForm, phone: e.target.value })
                          }
                          className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-700">
                        Address Line 1 (Flat, House No, Building) *
                      </label>
                      <input
                        type="text"
                        required
                        value={addressForm.addressLine1}
                        onChange={(e) =>
                          setAddressForm({ ...addressForm, addressLine1: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-700">
                          Address Line 2 (Area, Street)
                        </label>
                        <input
                          type="text"
                          value={addressForm.addressLine2 || ""}
                          onChange={(e) =>
                            setAddressForm({ ...addressForm, addressLine2: e.target.value })
                          }
                          className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-700">
                          Landmark (Optional)
                        </label>
                        <input
                          type="text"
                          value={addressForm.landmark || ""}
                          onChange={(e) =>
                            setAddressForm({ ...addressForm, landmark: e.target.value })
                          }
                          className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-700">
                          City *
                        </label>
                        <input
                          type="text"
                          required
                          value={addressForm.city}
                          onChange={(e) =>
                            setAddressForm({ ...addressForm, city: e.target.value })
                          }
                          className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-700">
                          State *
                        </label>
                        <input
                          type="text"
                          required
                          value={addressForm.state}
                          onChange={(e) =>
                            setAddressForm({ ...addressForm, state: e.target.value })
                          }
                          className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-700">
                          PIN Code *
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={6}
                          value={addressForm.pinCode}
                          onChange={(e) =>
                            setAddressForm({ ...addressForm, pinCode: e.target.value })
                          }
                          className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-mono"
                        />
                      </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                      <button
                        type="submit"
                        className="px-8 py-3.5 bg-[#111111] hover:bg-black text-white text-xs uppercase tracking-widest font-black transition-colors flex items-center gap-2"
                      >
                        <span>Continue to Order Review</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* STEP 2: ORDER REVIEW */}
              {step === 2 && (
                <div className="border border-neutral-200 p-6 bg-white space-y-6">
                  <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-black flex items-center gap-2">
                      <Package className="w-4 h-4" /> 2. Review Your Streetwear Order
                    </h2>
                    <button
                      onClick={() => setStep(1)}
                      className="text-xs text-neutral-500 hover:text-black underline font-semibold"
                    >
                      Edit Address
                    </button>
                  </div>

                  {/* Confirmed Delivery Target */}
                  <div className="p-3 bg-neutral-50 border border-neutral-200 text-xs">
                    <p className="font-bold text-black">{addressForm.fullName} • {addressForm.phone}</p>
                    <p className="text-neutral-600 mt-0.5">
                      {addressForm.addressLine1}, {addressForm.city}, {addressForm.state} - {addressForm.pinCode}
                    </p>
                  </div>

                  {/* Items List */}
                  <div className="divide-y divide-neutral-100">
                    {items.map((item) => (
                      <div key={item.id} className="py-3 flex gap-3 items-center">
                        <div className="relative w-14 h-18 bg-neutral-100 shrink-0">
                          <Image src={item.image} alt={item.productName} fill className="object-cover object-top" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold uppercase truncate">{item.productName}</p>
                          <p className="text-[11px] text-neutral-500 mt-0.5">
                            Size: {item.size} • Color: {item.color} • Qty: {item.quantity}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-black">
                          {formatINR(item.price * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 flex items-center justify-between">
                    <button
                      onClick={() => setStep(1)}
                      className="text-xs uppercase tracking-wider font-bold text-neutral-600 hover:text-black flex items-center gap-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Back to Address
                    </button>

                    <button
                      onClick={handleProceedToPayment}
                      className="px-8 py-3.5 bg-[#111111] hover:bg-black text-white text-xs uppercase tracking-widest font-black transition-colors flex items-center gap-2"
                    >
                      <span>Proceed to Payment</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: PAYMENT PREVIEW (RAZORPAY) */}
              {step === 3 && (
                <div className="border border-neutral-200 p-6 bg-white space-y-6">
                  <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-black flex items-center gap-2">
                      <CreditCard className="w-4 h-4" /> 3. Select Payment Method (Razorpay Preview)
                    </h2>
                    <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> 256-bit Secure
                    </span>
                  </div>

                  <div className="p-3 bg-neutral-50 border border-neutral-200 text-xs text-neutral-600 leading-relaxed">
                    <strong>Razorpay Integration Sandbox:</strong> In Phase 2, this will connect directly to the NestJS Razorpay API gateway. Choose any simulated payment option to test the order lifecycle.
                  </div>

                  {/* Payment Options */}
                  <div className="space-y-3">
                    {[
                      {
                        id: "upi",
                        title: "UPI (Google Pay / PhonePe / Paytm / BHIM)",
                        subtitle: "Instant authorization via UPI intent or QR code preview.",
                      },
                      {
                        id: "card",
                        title: "Credit / Debit Cards (Visa, MasterCard, RuPay, Amex)",
                        subtitle: "Tokenized card gateway via Razorpay.",
                      },
                      {
                        id: "netbanking",
                        title: "Net Banking (50+ Indian Banks)",
                        subtitle: "HDFC, ICICI, SBI, Axis, Kotak and more.",
                      },
                      {
                        id: "cod",
                        title: "Cash on Delivery (COD)",
                        subtitle: "Pay cash or UPI upon delivery at your doorstep.",
                      },
                    ].map((method) => (
                      <label
                        key={method.id}
                        className={`flex items-start gap-3 p-3.5 border cursor-pointer transition-colors ${
                          selectedPaymentMethod === method.id
                            ? "border-black bg-[#F5F4F0]"
                            : "border-neutral-200 hover:border-neutral-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          checked={selectedPaymentMethod === method.id}
                          onChange={() => setSelectedPaymentMethod(method.id as any)}
                          className="mt-1 w-4 h-4 accent-black"
                        />
                        <div>
                          <p className="text-xs font-bold text-neutral-900 uppercase">
                            {method.title}
                          </p>
                          <p className="text-[11px] text-neutral-500 mt-0.5">{method.subtitle}</p>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="pt-4 flex items-center justify-between">
                    <button
                      onClick={() => setStep(2)}
                      className="text-xs uppercase tracking-wider font-bold text-neutral-600 hover:text-black flex items-center gap-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Back to Review
                    </button>

                    <button
                      onClick={handleSimulatePayment}
                      disabled={isProcessing}
                      className="px-8 py-4 bg-[#B8FF3B] hover:bg-[#a6ec29] text-black text-xs uppercase tracking-widest font-black transition-colors flex items-center gap-2 shadow-md disabled:opacity-50"
                    >
                      <Lock className="w-4 h-4" />
                      <span>
                        {isProcessing ? "Authorizing via Razorpay..." : `Authorize & Pay ${formatINR(total)}`}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar Order Summary (5 cols) */}
            <div className="lg:col-span-5">
              <div className="border border-neutral-200 bg-white p-6 space-y-4 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-black pb-2 border-b border-neutral-200">
                  Summary ({itemCount} {itemCount === 1 ? "Item" : "Items"})
                </h3>

                <div className="max-h-60 overflow-y-auto divide-y divide-neutral-100 pr-1">
                  {items.map((item) => (
                    <div key={item.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold uppercase truncate">{item.productName}</p>
                        <p className="text-[11px] text-neutral-500">
                          {item.size} • {item.color} (x{item.quantity})
                        </p>
                      </div>
                      <span className="font-semibold text-neutral-900 shrink-0">
                        {formatINR(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5 text-xs text-neutral-600 pt-3 border-t border-neutral-200">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-semibold text-black">{formatINR(subtotal)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-medium">
                      <span>Discount</span>
                      <span>-{formatINR(discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Express Air Shipping</span>
                    <span className="font-semibold text-black">
                      {shipping === 0 ? "FREE" : formatINR(shipping)}
                    </span>
                  </div>
                  <div className="flex justify-between text-base font-black text-black pt-3 border-t border-neutral-200">
                    <span>Total Amount</span>
                    <span>{formatINR(total)}</span>
                  </div>
                </div>

                <div className="pt-2 text-[10px] text-neutral-500 space-y-1">
                  <p>• All prices include Goods & Services Tax (GST).</p>
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
