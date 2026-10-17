"use client";

import React, { useState } from "react";
import { X, AlertCircle, RefreshCw, CheckCircle2 } from "lucide-react";
import { RETURN_REASONS } from "@/lib/policies";

interface ReturnModalProps {
  orderId: string;
  orderNumber: string;
  items: Array<{
    id: string;
    product_name: string;
    size: string;
    color: string;
    price: number;
    quantity: number;
  }>;
  guestToken?: string;
  customerEmail?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReturnModal({
  orderId,
  orderNumber,
  items,
  guestToken,
  customerEmail,
  isOpen,
  onClose,
  onSuccess,
}: ReturnModalProps) {
  const [type, setType] = useState<"return" | "exchange">("return");
  const [reason, setReason] = useState<string>(RETURN_REASONS[0]);
  const [customerNote, setCustomerNote] = useState("");
  const [selectedItems, setSelectedItems] = useState<
    Record<string, { selected: boolean; quantity: number; exchangeSize?: string }>
  >(() => {
    const init: Record<string, { selected: boolean; quantity: number; exchangeSize?: string }> = {};
    items.forEach((item) => {
      init[item.id] = { selected: false, quantity: 1, exchangeSize: "L" };
    });
    return init;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const itemsToSubmit = Object.entries(selectedItems)
      .filter(([_, val]) => val.selected)
      .map(([orderItemId, val]) => ({
        orderItemId,
        quantity: val.quantity,
        requestedExchangeSize: type === "exchange" ? val.exchangeSize : undefined,
      }));

    if (itemsToSubmit.length === 0) {
      setError("Please select at least one garment for this request.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/orders/${orderId}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          reason,
          customerNote,
          items: itemsToSubmit,
          token: guestToken,
          email: customerEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit request.");
      }

      setSuccessMsg(`Your ${type} request has been submitted successfully (Reference: ${data.returnId}).`);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white max-w-lg w-full border border-[#111111] shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-[#858585] hover:text-[#111111]"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-sm font-black uppercase tracking-wider text-[#111111] mb-1">
          Return or Exchange Request
        </h3>
        <p className="text-xs text-[#858585] mb-5">
          Order #{orderNumber} • 7-day standard policy window
        </p>

        {successMsg ? (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Type selector */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#111111] mb-2">
                Request Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setType("return")}
                  className={`py-2 text-xs font-bold uppercase border transition-colors ${
                    type === "return"
                      ? "bg-[#111111] text-white border-[#111111]"
                      : "bg-white text-[#111111] border-[#E5E5E5] hover:border-black"
                  }`}
                >
                  Return for Refund
                </button>
                <button
                  type="button"
                  onClick={() => setType("exchange")}
                  className={`py-2 text-xs font-bold uppercase border transition-colors ${
                    type === "exchange"
                      ? "bg-[#111111] text-white border-[#111111]"
                      : "bg-white text-[#111111] border-[#E5E5E5] hover:border-black"
                  }`}
                >
                  Size Exchange
                </button>
              </div>
            </div>

            {/* Items selection */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#111111] mb-2">
                Select Items to {type === "exchange" ? "Exchange" : "Return"}
              </label>
              <div className="divide-y divide-[#E5E5E5] border border-[#E5E5E5] p-2 space-y-2">
                {items.map((item) => {
                  const state = selectedItems[item.id] || { selected: false, quantity: 1 };
                  return (
                    <div key={item.id} className="pt-2 first:pt-0 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <label className="flex items-center gap-2 cursor-pointer font-medium text-[#111111]">
                          <input
                            type="checkbox"
                            checked={state.selected}
                            onChange={(e) =>
                              setSelectedItems((prev) => ({
                                ...prev,
                                [item.id]: { ...state, selected: e.target.checked },
                              }))
                            }
                            className="rounded border-[#E5E5E5] text-[#111111] focus:ring-0"
                          />
                          <span>
                            {item.product_name} ({item.size})
                          </span>
                        </label>
                        <span className="font-mono text-[#858585]">
                          Purchased: {item.quantity}
                        </span>
                      </div>

                      {state.selected && (
                        <div className="pl-6 flex items-center gap-4 text-xs">
                          <div>
                            <label className="text-[10px] uppercase font-bold text-[#858585] block">
                              Qty
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={item.quantity}
                              value={state.quantity}
                              onChange={(e) =>
                                setSelectedItems((prev) => ({
                                  ...prev,
                                  [item.id]: {
                                    ...state,
                                    quantity: Math.max(1, Math.min(item.quantity, Number(e.target.value) || 1)),
                                  },
                                }))
                              }
                              className="w-16 border border-[#E5E5E5] px-2 py-1 text-xs"
                            />
                          </div>

                          {type === "exchange" && (
                            <div>
                              <label className="text-[10px] uppercase font-bold text-[#858585] block">
                                Desired Size
                              </label>
                              <select
                                value={state.exchangeSize || "L"}
                                onChange={(e) =>
                                  setSelectedItems((prev) => ({
                                    ...prev,
                                    [item.id]: { ...state, exchangeSize: e.target.value },
                                  }))
                                }
                                className="border border-[#E5E5E5] px-2 py-1 text-xs"
                              >
                                {["XS", "S", "M", "L", "XL", "XXL"].map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#111111] mb-1">
                Reason
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full border border-[#E5E5E5] px-3 py-2 text-xs text-[#111111] focus:border-black outline-none"
              >
                {RETURN_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* Note */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#111111] mb-1">
                Customer Comments (Optional)
              </label>
              <textarea
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                placeholder="Provide any helpful details for inspection team..."
                rows={2}
                className="w-full border border-[#E5E5E5] px-3 py-2 text-xs text-[#111111] focus:border-black outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-[#E5E5E5]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-[#E5E5E5] text-xs uppercase font-bold text-[#858585] hover:text-[#111111]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-[#111111] text-white text-xs uppercase font-bold tracking-wider hover:bg-[#222222] disabled:opacity-50 flex items-center gap-2"
              >
                {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Submit {type === "exchange" ? "Exchange" : "Return"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
