"use client";

import React, { useState } from "react";
import { Truck, Check, AlertCircle } from "lucide-react";

export function DeliveryPinChecker() {
  const [pinCode, setPinCode] = useState("");
  const [result, setResult] = useState<{
    valid: boolean;
    city?: string;
    estimate?: string;
    codAvailable?: boolean;
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

    // Realistic delivery matrix preview
    const firstDigit = clean[0];
    let city = "Metro Transit Zone";
    let estimate = "Delivering in 2 - 4 business days";

    if (firstDigit === "5" || firstDigit === "6") {
      city = "South India Direct Hub (Bengaluru / Chennai / Hyderabad)";
      estimate = "Fast Track Delivery: 2 business days";
    } else if (firstDigit === "1" || firstDigit === "2") {
      city = "North India Hub (Delhi NCR / Chandigarh / Jaipur)";
      estimate = "Standard Express: 3 - 4 business days";
    } else if (firstDigit === "4") {
      city = "West India Hub (Mumbai / Pune / Ahmedabad)";
      estimate = "Air Express: 2 - 3 business days";
    } else {
      city = "Pan-India Air Network";
      estimate = "Standard Delivery: 4 - 5 business days";
    }

    setResult({
      valid: true,
      city,
      estimate,
      codAvailable: true,
    });
  };

  return (
    <div className="pt-4 pb-2 border-t border-neutral-200">
      <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-neutral-800">
        <Truck className="w-4 h-4 text-neutral-600" />
        <span>Check Delivery & COD Availability</span>
      </div>

      <form onSubmit={handleCheck} className="flex gap-2">
        <input
          type="text"
          maxLength={6}
          value={pinCode}
          onChange={(e) => {
            setPinCode(e.target.value.replace(/\D/g, ""));
            setResult(null);
          }}
          placeholder="Enter 6-digit PIN code (e.g. 560038)"
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
        <div className="mt-2.5">
          {result.valid ? (
            <div className="p-2.5 bg-[#F5F4F0] border border-neutral-200 text-xs space-y-1">
              <p className="font-bold text-neutral-900 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                {result.estimate}
              </p>
              <p className="text-[11px] text-neutral-600">
                Hub: {result.city} • Cash on Delivery Eligible
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
