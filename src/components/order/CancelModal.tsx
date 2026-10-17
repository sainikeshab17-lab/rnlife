"use client";

import React, { useState } from "react";
import { X, AlertCircle, RefreshCw, CheckCircle2 } from "lucide-react";
import { CANCELLATION_REASONS } from "@/lib/policies";

interface CancelModalProps {
  orderId: string;
  orderNumber: string;
  guestToken?: string;
  customerEmail?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CancelModal({
  orderId,
  orderNumber,
  guestToken,
  customerEmail,
  isOpen,
  onClose,
  onSuccess,
}: CancelModalProps) {
  const [reason, setReason] = useState<string>(CANCELLATION_REASONS[0]);
  const [customNote, setCustomNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const fullReason = customNote.trim() ? `${reason} — ${customNote.trim()}` : reason;

    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: fullReason,
          token: guestToken,
          email: customerEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit cancellation request.");
      }

      setSuccessMsg("Cancellation request submitted. Our team will process this promptly.");
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
      <div className="bg-white max-w-md w-full border border-[#111111] shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-[#858585] hover:text-[#111111]"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-sm font-black uppercase tracking-wider text-[#111111] mb-1">
          Request Cancellation
        </h3>
        <p className="text-xs text-[#858585] mb-5">
          Order #{orderNumber} • Eligible prior to shipment
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

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#111111] mb-1">
                Reason for Cancellation
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full border border-[#E5E5E5] px-3 py-2 text-xs text-[#111111] focus:border-black outline-none"
              >
                {CANCELLATION_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#111111] mb-1">
                Additional Comments (Optional)
              </label>
              <textarea
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                placeholder="Let us know why you need to cancel..."
                rows={3}
                className="w-full border border-[#E5E5E5] px-3 py-2 text-xs text-[#111111] focus:border-black outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-[#E5E5E5]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-[#E5E5E5] text-xs uppercase font-bold text-[#858585] hover:text-[#111111]"
              >
                Keep Order
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-red-600 text-white text-xs uppercase font-bold tracking-wider hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Confirm Cancellation
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
