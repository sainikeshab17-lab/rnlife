"use client";

import { useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";

type PaymentResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RetryPaymentOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  image?: string;
  order_id: string;
  handler: (response: PaymentResponse) => void | Promise<void>;
  modal: { ondismiss: () => void };
  theme: { color: string };
};

declare global {
  interface Window {
    Razorpay?: new (options: RetryPaymentOptions) => {
      open: () => void;
      on: (event: "payment.failed", callback: (response: { error?: { description?: string } }) => void) => void;
    };
  }
}

export function RetryPendingPayment({ orderId, isAdvance, guestToken }: { orderId: string; isAdvance: boolean; guestToken?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const verify = async (payment: PaymentResponse, retry: { orderId: string; paymentAttemptId?: string; paymentPurpose: string }) => {
    const endpoint = retry.paymentPurpose === "cod_advance"
      ? "/api/checkout/verify-cod-advance"
      : "/api/checkout/verify-payment";
    const payload = retry.paymentPurpose === "cod_advance"
      ? { orderId: retry.orderId, paymentAttemptId: retry.paymentAttemptId, razorpayOrderId: payment.razorpay_order_id, razorpayPaymentId: payment.razorpay_payment_id, razorpaySignature: payment.razorpay_signature }
      : { orderId: retry.orderId, guestToken, razorpayOrderId: payment.razorpay_order_id, razorpayPaymentId: payment.razorpay_payment_id, razorpaySignature: payment.razorpay_signature };
    const response = await fetch(endpoint, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || "Payment is still being verified.");
    setMessage("Payment verified. This order is confirmed.");
    router.refresh();
  };

  const startRetry = async () => {
    if (busy) return;
    setBusy(true);
    setMessage("Checking payment status…");
    try {
      const response = await fetch("/api/checkout/retry-payment", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, guestToken }),
      });
      const data = await response.json();
      if (data.state === "confirmed") {
        setMessage("Payment verified. This order is confirmed.");
        router.refresh();
        return;
      }
      if (!response.ok || !data.success || data.state !== "retryable") {
        setMessage(data.error || "Payment status is still being checked. Do not pay again yet.");
        router.refresh();
        return;
      }
      if (!window.Razorpay) throw new Error("Razorpay checkout is unavailable. Refresh and try again.");

      const checkout = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "RIGHTNOWLIFE",
        description: isAdvance ? "COD advance payment" : "RIGHTNOWLIFE order payment",
        image: "/rightnowlife-logo.png",
        order_id: data.razorpayOrderId,
        theme: { color: "#FFB900" },
        modal: { ondismiss: () => {
          setBusy(false);
          setMessage("Payment window closed. The order remains pending; check payment status before retrying.");
          router.refresh();
        } },
        handler: async (payment) => {
          setMessage("Verifying payment with Razorpay…");
          try {
            await verify(payment, { orderId: data.orderId, paymentAttemptId: data.paymentAttemptId, paymentPurpose: data.paymentPurpose });
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Payment status could not be confirmed. Do not pay again yet.");
            router.refresh();
          } finally {
            setBusy(false);
          }
        },
      });
      checkout.on("payment.failed", (event) => {
        setBusy(false);
        setMessage(event.error?.description || "Payment failed. The order remains pending; you can retry the same payment.");
      });
      checkout.open();
      setMessage("Awaiting payment confirmation…");
    } catch (error) {
      setBusy(false);
      setMessage(error instanceof Error ? error.message : "Could not start payment retry.");
    }
  };

  return (
    <div className="space-y-2">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <button type="button" onClick={startRetry} disabled={busy}
        className="inline-flex min-h-10 items-center gap-2 border border-[#111111] px-3 text-[10px] font-bold uppercase tracking-wider text-[#111111] hover:bg-[#111111] hover:text-white disabled:cursor-wait disabled:opacity-60">
        <RotateCcw className="h-3.5 w-3.5" />{busy ? "Checking payment" : "Check status / retry payment"}
      </button>
      {message && <p role="status" aria-live="polite" className="max-w-sm text-xs text-neutral-600">{message}</p>}
    </div>
  );
}
