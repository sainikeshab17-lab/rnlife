"use client";

import React, { useState } from "react";
import { MapPin, Check, AlertCircle } from "lucide-react";

export function DeliveryPinChecker() {
  const [pinCode, setPinCode] = useState("");
  const [result, setResult] = useState<{
    valid: boolean;
    message?: string;
  } | null>(null);

  const handleCheck = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = pinCode.trim();

    if (!/^\d{6}$/.test(clean)) {
      setResult({
        valid: false,
        message: "Please enter a valid 6-digit Indian postal code.",
      });
      return;
    }

    setResult({
      valid: true,
      message: "PIN format looks valid. Live delivery availability is not connected in this prototype.",
    });
  };

  return (
    <div className="pt-4 pb-2 border-t border-neutral-200">
      <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-neutral-800">
        <MapPin className="w-4 h-4 text-neutral-600" />
        <span>Check PIN format</span>
      </div>

      <form onSubmit={handleCheck} className="flex gap-2">
        <label className="sr-only" htmlFor="delivery-pin">6-digit PIN code</label>
        <input
          id="delivery-pin"
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={pinCode}
          onChange={(e) => {
            setPinCode(e.target.value.replace(/\D/g, ""));
            setResult(null);
          }}
          placeholder="6-digit PIN code"
          aria-invalid={result?.valid === false}
          aria-describedby={result ? "delivery-pin-result" : undefined}
          className="flex-1 px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-mono"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-black hover:bg-neutral-800 text-white text-xs uppercase tracking-wider font-bold transition-colors"
        >
          Check
        </button>
      </form>

      {result && (
        <div id="delivery-pin-result" className="mt-2.5" role="status" aria-live="polite">
          {result.valid ? (
            <div className="p-2.5 bg-[#FFFFFF] border border-neutral-200 text-xs">
              <p className="font-medium text-neutral-900 flex items-start gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>{result.message}</span>
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-red-600 mt-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{result.message}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
