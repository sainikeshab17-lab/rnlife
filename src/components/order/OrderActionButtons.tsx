"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ReturnModal } from "./ReturnModal";
import { CancelModal } from "./CancelModal";

interface OrderActionButtonsProps {
  order: {
    id: string;
    order_number: string;
    order_status: string;
    cancellation_requested?: number | null;
    items: Array<{
      id: string;
      product_name: string;
      size: string;
      color: string;
      price: number;
      quantity: number;
    }>;
  };
  guestToken?: string;
  customerEmail?: string;
}

export function OrderActionButtons({
  order,
  guestToken,
  customerEmail,
}: OrderActionButtonsProps) {
  const router = useRouter();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);

  const canCancel =
    !order.cancellation_requested &&
    ["pending_payment", "paid", "processing"].includes(order.order_status);

  const canReturn = order.order_status === "delivered";

  const handleSuccess = () => {
    router.refresh();
  };

  return (
    <>
      <div className="flex items-center gap-3">
        {order.cancellation_requested === 1 && (
          <span className="px-2.5 py-1 text-[11px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-300">
            Cancellation Under Review
          </span>
        )}

        {canCancel && (
          <button
            onClick={() => setShowCancelModal(true)}
            className="px-3 py-1.5 border border-red-300 text-red-700 hover:bg-red-50 text-xs font-bold uppercase tracking-wider transition-colors"
          >
            Request Cancellation
          </button>
        )}

        {canReturn && (
          <button
            onClick={() => setShowReturnModal(true)}
            className="px-3 py-1.5 border border-[#111111] bg-[#111111] text-white hover:bg-[#222222] text-xs font-bold uppercase tracking-wider transition-colors"
          >
            Return / Exchange
          </button>
        )}
      </div>

      <CancelModal
        orderId={order.id}
        orderNumber={order.order_number}
        guestToken={guestToken}
        customerEmail={customerEmail}
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onSuccess={handleSuccess}
      />

      <ReturnModal
        orderId={order.id}
        orderNumber={order.order_number}
        items={order.items}
        guestToken={guestToken}
        customerEmail={customerEmail}
        isOpen={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        onSuccess={handleSuccess}
      />
    </>
  );
}
