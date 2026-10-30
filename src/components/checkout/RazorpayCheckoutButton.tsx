"use client";

import { useState } from "react";
import Script from "next/script";

type CheckoutItem = {
  product_id: string;
  quantity: number;
};

type RazorpaySuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  image?: string;
  order_id: string;
  handler: (response: RazorpaySuccess) => void | Promise<void>;
  modal: {
    ondismiss: () => void;
  };
  theme: {
    color: string;
  };
};

type RazorpayFailure = {
  error?: {
    description?: string;
  };
};

declare global {
  interface Window {
    Razorpay?: new (
      options: RazorpayOptions
    ) => {
      open: () => void;
      on: (
        event: "payment.failed",
        callback: (response: RazorpayFailure) => void
      ) => void;
    };
  }
}

type Props = {
  items: CheckoutItem[];
  onVerified: (payment: {
    order_id: string;
    payment_id: string;
    amount: number;
    currency: string;
  }) => void | Promise<void>;
};

export default function RazorpayCheckoutButton({
  items,
  onVerified,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function startPayment() {
    if (loading || items.length === 0) return;

    setLoading(true);
    setMessage("");

    try {
      if (!window.Razorpay) {
        throw new Error(
          "Payment window is still loading. Please try again."
        );
      }

      // Canonical checkout order creation
      const orderResponse = await fetch("/api/checkout/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.product_id, quantity: i.quantity, size: "L" })),
          customerName: "Customer",
          customerEmail: "care@rightnowlife.in",
          customerPhone: "9876543210",
          address: {
            fullName: "Customer",
            phone: "9876543210",
            addressLine1: "Store Order",
            city: "Bengaluru",
            state: "Karnataka",
            pinCode: "560038",
            country: "India",
          },
        }),
      });

      const orderData = await orderResponse.json();

      if (!orderResponse.ok || !orderData.success) {
        throw new Error(
          orderData.error || "Could not create payment order."
        );
      }

      const checkout = new window.Razorpay({
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "RIGHTNOWLIFE",
        description: "Streetwear purchase",
        image: "/rightnowlife-logo.png",
        order_id: orderData.razorpayOrderId,
        theme: {
          color: "#111111",
        },
        modal: {
          ondismiss: () => {
            setMessage(
              "Payment window closed. Check payment status before retrying."
            );
            setLoading(false);
          },
        },
        handler: async (response: RazorpaySuccess) => {
          try {
            const verifyResponse = await fetch(
              "/api/checkout/verify-payment",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                credentials: "same-origin",
                body: JSON.stringify({
                  orderId: orderData.orderId,
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                }),
              }
            );

            const verification = await verifyResponse.json();

            if (
              !verifyResponse.ok ||
              !verification.success
            ) {
              throw new Error(
                verification.error ||
                  verification.message ||
                  "Payment could not be verified."
              );
            }

            await onVerified({
              order_id: verification.orderId || orderData.orderId,
              payment_id: response.razorpay_payment_id,
              amount: orderData.amount,
              currency: orderData.currency,
            });
          } catch (error) {
            setMessage(
              error instanceof Error
                ? error.message
                : "Verification failed. Contact support before retrying."
            );
          } finally {
            setLoading(false);
          }
        },
      });

      checkout.on("payment.failed", (event: RazorpayFailure) => {
        setMessage(
          event.error?.description ||
            "Payment failed. Please try again."
        );
        setLoading(false);
      });

      checkout.open();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to start payment."
      );
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
      />

      <button
        type="button"
        onClick={startPayment}
        disabled={loading || items.length === 0}
        className="w-full rounded-lg bg-black px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading
          ? "Processing..."
          : "Pay securely with Razorpay"}
      </button>

      {message && (
        <p role="alert" className="text-sm text-red-600">
          {message}
        </p>
      )}
    </div>
  );
}
