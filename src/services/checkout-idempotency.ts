export interface CheckoutKeyDetails {
  userId: string | null;
  customerEmail: string;
  paymentMethod: "Cash on Delivery" | "Razorpay (UPI / Cards / NetBanking)";
  customerName: string;
  customerPhone: string;
  address: {
    fullName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    landmark?: string;
    city: string;
    state: string;
    pinCode: string;
    country: string;
  };
  items: Array<{ productId: string; size: string; quantity: number; color: string }>;
}

const STORAGE_KEY = "rnl.checkout.idempotency.current";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, canonicalize(entry)])
    );
  }
  return value;
}

function normalizeDetails(details: CheckoutKeyDetails): CheckoutKeyDetails {
  return {
    ...details,
    customerEmail: details.customerEmail.trim().toLowerCase(),
    customerName: details.customerName.trim(),
    customerPhone: details.customerPhone.trim(),
    address: {
      ...details.address,
      fullName: details.address.fullName.trim(),
      phone: details.address.phone.trim(),
      addressLine1: details.address.addressLine1.trim(),
      addressLine2: details.address.addressLine2?.trim(),
      landmark: details.address.landmark?.trim(),
      city: details.address.city.trim(),
      state: details.address.state.trim(),
      pinCode: details.address.pinCode.replace(/\s+/g, ""),
      country: details.address.country.trim(),
    },
    items: details.items.map((item) => ({
      ...item,
      color: item.color || "As pictured",
    })),
  };
}

async function fingerprint(details: CheckoutKeyDetails): Promise<string> {
  const serialized = JSON.stringify(canonicalize(normalizeDetails(details)));
  const bytes = new TextEncoder().encode(serialized);
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Reuse a key only for the same normalized checkout inputs; retain it across exact retries. */
export async function getCheckoutIdempotencyKey(details: CheckoutKeyDetails): Promise<string> {
  const requestFingerprint = await fingerprint(details);
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const saved = JSON.parse(raw) as { key?: unknown; fingerprint?: unknown };
      if (typeof saved.key === "string" && typeof saved.fingerprint === "string" && saved.fingerprint === requestFingerprint) {
        return saved.key;
      }
    } catch {
      // Discard the legacy bare-key format and malformed entries.
    }
  }

  const key = window.crypto.randomUUID();
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ key, fingerprint: requestFingerprint }));
  return key;
}

export function clearCheckoutIdempotencyKey(): void {
  window.sessionStorage.removeItem(STORAGE_KEY);
}
