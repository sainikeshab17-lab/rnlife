"use client";

import { useRef, useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Search, XCircle } from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";

type CourierOption = {
  courierId: number;
  courierName: string;
  rate?: number;
  estimatedDeliveryDays?: number;
  estimatedDeliveryDate?: string;
  rating?: number;
};

type ServiceabilityResult = { serviceable: boolean; couriers: CourierOption[] };
type SubmissionResult = {
  status: number | null;
  kind: "serviceable" | "unavailable" | "error";
  message: string;
  result?: ServiceabilityResult;
};

function parseResult(value: unknown): ServiceabilityResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.serviceable !== "boolean" || !Array.isArray(row.couriers)) return null;

  const couriers: CourierOption[] = [];
  for (const item of row.couriers) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const courier = item as Record<string, unknown>;
    if (!Number.isSafeInteger(courier.courierId) || Number(courier.courierId) <= 0 ||
        typeof courier.courierName !== "string" || !courier.courierName.trim() || courier.courierName.length > 120) return null;

    const clean: CourierOption = { courierId: Number(courier.courierId), courierName: courier.courierName.trim() };
    for (const key of ["rate", "estimatedDeliveryDays", "rating"] as const) {
      const numeric = courier[key];
      if (numeric !== undefined) {
        if (typeof numeric !== "number" || !Number.isFinite(numeric) || numeric < 0) return null;
        clean[key] = numeric;
      }
    }
    if (courier.estimatedDeliveryDate !== undefined) {
      if (typeof courier.estimatedDeliveryDate !== "string" || courier.estimatedDeliveryDate.length > 80) return null;
      clean.estimatedDeliveryDate = courier.estimatedDeliveryDate;
    }
    couriers.push(clean);
  }

  if (row.serviceable !== (couriers.length > 0)) return null;
  return { serviceable: row.serviceable, couriers };
}

function displayError(status: number, message?: string): string {
  const safeMessage = message && message.length <= 300 ? message : "The serviceability check could not be completed.";
  if (status === 401 && message === "Unauthorized") return "Your administrator session is not authorized. Sign in again and retry.";
  if (status === 403 && message === "Forbidden") return "Your administrator role is not permitted to run this check.";
  if (status === 503 && (message === "Shiprocket serviceability is disabled." || message?.startsWith("SHIPROCKET_") || message?.includes("package dimensions"))) {
    return `Serviceability is disabled or server configuration is incomplete: ${safeMessage}`;
  }
  if (message?.startsWith("Shiprocket ")) return `Provider/API error: ${safeMessage}`;
  if (status === 401) return `Shiprocket authentication failed: ${safeMessage}`;
  if (status === 403) return `Authorization failed: ${safeMessage}`;
  if (status === 400) return `Check the form values: ${safeMessage}`;
  if (status === 503) return `Serviceability configuration is unavailable: ${safeMessage}`;
  if (status >= 500) return `The provider or service returned an error: ${safeMessage}`;
  return safeMessage;
}

function positiveValue(value: string): number | null {
  if (!value.trim()) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

export default function AdminShippingServiceabilityPage() {
  const [deliveryPostcode, setDeliveryPostcode] = useState("");
  const [cod, setCod] = useState(false);
  const [weightKg, setWeightKg] = useState("");
  const [lengthCm, setLengthCm] = useState("");
  const [breadthCm, setBreadthCm] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submission, setSubmission] = useState<SubmissionResult | null>(null);
  const inFlight = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;

    const postcode = deliveryPostcode.trim();
    const weight = positiveValue(weightKg);
    const length = positiveValue(lengthCm);
    const breadth = positiveValue(breadthCm);
    const height = positiveValue(heightCm);
    if (!/^\d{6}$/.test(postcode)) {
      setValidationError("Enter a valid six-digit destination postcode.");
      setSubmission(null);
      return;
    }
    if (weight === null || length === null || breadth === null || height === null) {
      setValidationError("Enter a positive package weight and positive length, breadth, and height measurements.");
      setSubmission(null);
      return;
    }

    setValidationError(null);
    setSubmission(null);
    inFlight.current = true;
    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/shipping/serviceability", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          confirmed: true,
          deliveryPostcode: postcode,
          cod,
          weightKg: weight,
          dimensionsCm: { length, breadth, height },
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const error = payload && typeof payload === "object" && !Array.isArray(payload)
          ? (payload as Record<string, unknown>).error
          : undefined;
        setSubmission({
          status: response.status,
          kind: "error",
          message: displayError(response.status, typeof error === "string" ? error : undefined),
        });
        return;
      }

      const result = parseResult(payload);
      if (!result) {
        setSubmission({ status: response.status, kind: "error", message: "The service returned an invalid response. No courier details were displayed." });
        return;
      }
      setSubmission({
        status: response.status,
        kind: result.serviceable ? "serviceable" : "unavailable",
        message: result.serviceable ? "Service is available for this parcel." : "No courier service is available for this parcel and postcode.",
        result,
      });
    } catch {
      setSubmission({ status: null, kind: "error", message: "Network error. The request was not retried; check connectivity before starting another check." });
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <AdminLayout
      title="Shipping Serviceability"
      subtitle="Read-only courier availability check for a destination postcode and measured parcel."
    >
      <div className="space-y-6">
        <section className="border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
          <p className="font-bold">Read-only check</p>
          <p className="mt-1 text-xs leading-relaxed">This check requests courier availability and estimates only. It does not create an order or shipment, assign an AWB, generate a label, schedule a pickup, or change order state. Server-side admin authorization and the independent serviceability feature flag remain required.</p>
        </section>

        <form onSubmit={handleSubmit} className="space-y-5 border border-neutral-200 bg-white p-5 shadow-sm" noValidate>
          <div>
            <h2 className="text-sm font-black uppercase tracking-wide">Destination and parcel</h2>
            <p className="mt-1 text-xs text-neutral-500">The pickup location and postcode are read from server configuration and are not shown here.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-xs font-bold text-neutral-700">
              <span>Destination postcode</span>
              <input required inputMode="numeric" autoComplete="postal-code" maxLength={6} value={deliveryPostcode} onChange={event => setDeliveryPostcode(event.target.value)} className="w-full border border-neutral-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-black" placeholder="6 digits" aria-describedby="serviceability-postcode-help" />
              <span id="serviceability-postcode-help" className="block font-normal text-neutral-500">Enter the delivery postcode only; no customer address is needed.</span>
            </label>

            <label className="space-y-1 text-xs font-bold text-neutral-700">
              <span>Payment mode</span>
              <select value={cod ? "cod" : "prepaid"} onChange={event => setCod(event.target.value === "cod")} className="w-full border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-black">
                <option value="prepaid">Prepaid</option>
                <option value="cod">Cash on delivery</option>
              </select>
              <span className="block font-normal text-neutral-500">Used to request the correct serviceability quote.</span>
            </label>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-xs font-bold uppercase tracking-wide text-neutral-700">Measured parcel</legend>
            <div className="grid gap-4 sm:grid-cols-4">
              {[
                ["weight", "Weight (kg)", weightKg, setWeightKg, "0.50"],
                ["length", "Length (cm)", lengthCm, setLengthCm, "20"],
                ["breadth", "Breadth (cm)", breadthCm, setBreadthCm, "15"],
                ["height", "Height (cm)", heightCm, setHeightCm, "5"],
              ].map(([key, label, value, setter, placeholder]) => (
                <label key={key as string} className="space-y-1 text-xs font-bold text-neutral-700">
                  <span>{label as string}</span>
                  <input required type="number" min="0.01" step="any" inputMode="decimal" value={value as string} onChange={event => (setter as (next: string) => void)(event.target.value)} className="w-full border border-neutral-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-black" placeholder={placeholder as string} />
                </label>
              ))}
            </div>
          </fieldset>

          {validationError && <p role="alert" className="border border-red-200 bg-red-50 p-3 text-xs text-red-800">{validationError}</p>}

          <button type="submit" disabled={submitting} className="inline-flex cursor-pointer items-center gap-2 bg-black px-5 py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-60">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {submitting ? "Checking…" : "Check Serviceability"}
          </button>
        </form>

        {submission && (
          <section aria-live="polite" className={`border p-5 shadow-sm ${submission.kind === "serviceable" ? "border-emerald-200 bg-emerald-50" : submission.kind === "unavailable" ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"}`}>
            <div className="flex items-start gap-3">
              {submission.kind === "serviceable" ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" /> : submission.kind === "unavailable" ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-bold">{submission.message}</h2>
                  <span className="font-mono text-xs">HTTP {submission.status ?? "Network error"}</span>
                </div>
                {submission.result && submission.result.couriers.length > 0 && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[520px] border-collapse text-left text-xs">
                      <thead><tr className="border-b border-neutral-300 text-neutral-600"><th className="py-2 pr-3">Courier</th><th className="py-2 pr-3">Quoted rate</th><th className="py-2 pr-3">Estimated delivery</th><th className="py-2">Rating</th></tr></thead>
                      <tbody>{[...submission.result.couriers].sort((a, b) => (a.rate ?? Number.POSITIVE_INFINITY) - (b.rate ?? Number.POSITIVE_INFINITY)).map(courier => (
                        <tr key={courier.courierId} className="border-b border-neutral-200 last:border-0">
                          <td className="py-3 pr-3"><span className="font-semibold">{courier.courierName}</span><span className="ml-2 text-neutral-500">ID {courier.courierId}</span></td>
                          <td className="py-3 pr-3">{courier.rate === undefined ? "Not provided" : `₹${courier.rate.toFixed(2)}`}</td>
                          <td className="py-3 pr-3">{courier.estimatedDeliveryDays !== undefined ? `${courier.estimatedDeliveryDays} days` : courier.estimatedDeliveryDate ?? "Not provided"}</td>
                          <td className="py-3">{courier.rating === undefined ? "Not provided" : courier.rating}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
                {submission.result && <details className="mt-4"><summary className="cursor-pointer text-xs font-bold">Sanitized response body</summary><pre className="mt-2 max-h-72 overflow-auto border border-black/10 bg-white/70 p-3 text-[11px]">{JSON.stringify(submission.result, null, 2)}</pre></details>}
              </div>
            </div>
          </section>
        )}
      </div>
    </AdminLayout>
  );
}
