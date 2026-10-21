export type RazorpayOrderCreationState = "pending" | "creating" | "ready" | "unknown" | "retryable" | null;

export type RazorpayOrderRecoveryAction = "ready" | "claim_creation" | "wait" | "reconcile";

export function getRazorpayOrderRecoveryAction(params: {
  state: RazorpayOrderCreationState;
  razorpayOrderId: string | null;
  attemptedAt: string | null;
  now?: number;
  staleAfterMs?: number;
}): RazorpayOrderRecoveryAction {
  if (params.razorpayOrderId) return "ready";
  if (params.state === "pending" || params.state === "retryable") return "claim_creation";
  if (params.state === "creating") {
    const attemptedAt = params.attemptedAt ? Date.parse(params.attemptedAt) : Number.NaN;
    const age = (params.now ?? Date.now()) - attemptedAt;
    return Number.isFinite(attemptedAt) && age < (params.staleAfterMs ?? 120_000) ? "wait" : "reconcile";
  }
  return "reconcile";
}

export function classifyRazorpayOrderCreateFailure(error: unknown): "retryable" | "unknown" {
  if (!error || typeof error !== "object") return "unknown";
  const normalized = error as {
    statusCode?: unknown;
    error?: { code?: unknown; description?: unknown; field?: unknown; reason?: unknown };
  };
  const statusCode = Number(normalized.statusCode);
  const details = normalized.error;
  if ((typeof details?.description === "string" &&
      /duplicate request|duplicate receipt|same receipt|receipt.{0,40}(already|used|exist)|already.{0,40}receipt|already been created|already been processed/i.test(details.description)) ||
      (typeof details?.reason === "string" && /duplicate|already_processed|idempotency/i.test(details.reason))) {
    return "unknown";
  }

  // The installed SDK normalizes HTTP failures as { statusCode, error: { code,
  // description, field, source, step, reason, metadata } }. Only explicit
  // validation failures known to be rejected before order creation are safe.
  if (statusCode === 400 && details?.code === "BAD_REQUEST_ERROR" &&
      details.reason === "input_validation_failed" &&
      ["amount", "currency", "partial_payment", "first_payment_min_amount"].includes(String(details.field))) {
    return "retryable";
  }
  return "unknown";
}

export type RazorpayOrderPaymentOutcome = "none" | "failed" | "authorized" | "captured" | "ambiguous";

export function classifyRazorpayOrderPayments(
  response: unknown,
  expected: { orderId: string; amount: number }
): RazorpayOrderPaymentOutcome {
  if (!response || typeof response !== "object") return "ambiguous";
  const collection = response as Record<string, unknown>;
  if (collection.entity !== "collection" || !Array.isArray(collection.items) ||
      !Number.isInteger(collection.count) || collection.count !== collection.items.length ||
      collection.items.length >= 100) return "ambiguous";
  if (collection.items.length === 0) return "none";

  let sawAuthorized = false;
  for (const value of collection.items) {
    if (!value || typeof value !== "object") return "ambiguous";
    const payment = value as Record<string, unknown>;
    if (payment.order_id !== expected.orderId || payment.amount !== expected.amount || payment.currency !== "INR") return "ambiguous";
    if (payment.status === "captured" || payment.captured === true) return "captured";
    if (payment.status === "authorized") sawAuthorized = true;
    else if (payment.status !== "failed") return "ambiguous";
  }
  if (sawAuthorized) return "authorized";
  return "failed";
}

export interface ExpectedRazorpayOrder {
  receipt: string;
  amount: number;
  orderId: string;
}

export type RazorpayOrderLookupResult =
  | { status: "found"; razorpayOrderId: string }
  | { status: "not_found" }
  | { status: "ambiguous"; reason: string };

function isMatchingOrder(candidate: unknown, expected: ExpectedRazorpayOrder): candidate is {
  id: string;
  receipt: string;
  amount: number;
  currency: string;
  notes: Record<string, unknown>;
} {
  if (!candidate || typeof candidate !== "object") return false;
  const order = candidate as Record<string, unknown>;
  const notes = order.notes;
  return typeof order.id === "string" && order.id.length > 0 &&
    order.receipt === expected.receipt &&
    order.amount === expected.amount &&
    order.currency === "INR" &&
    Boolean(notes && typeof notes === "object" && !Array.isArray(notes) &&
      (notes as Record<string, unknown>).orderId === expected.orderId);
}

export function validateRazorpayOrderResponse(
  candidate: unknown,
  expected: ExpectedRazorpayOrder
): { valid: true; razorpayOrderId: string } | { valid: false; reason: string } {
  if (isMatchingOrder(candidate, expected)) return { valid: true, razorpayOrderId: candidate.id };
  return { valid: false, reason: "Provider order did not match the local receipt, amount, currency, and order reference." };
}

export function validateRazorpayOrderLookup(
  response: unknown,
  expected: ExpectedRazorpayOrder
): RazorpayOrderLookupResult {
  if (!response || typeof response !== "object") {
    return { status: "ambiguous", reason: "Provider receipt lookup returned an invalid response." };
  }
  const collection = response as Record<string, unknown>;
  if (collection.entity !== "collection" || !Array.isArray(collection.items) ||
      !Number.isInteger(collection.count) || collection.count !== collection.items.length ||
      collection.items.length >= 100) {
    return { status: "ambiguous", reason: "Provider receipt lookup was incomplete or malformed." };
  }
  if (collection.items.length === 0) return { status: "not_found" };
  if (collection.items.length !== 1) {
    return { status: "ambiguous", reason: "Multiple provider orders matched the local receipt." };
  }
  const validated = validateRazorpayOrderResponse(collection.items[0], expected);
  if (!validated.valid) return { status: "ambiguous", reason: validated.reason };
  return { status: "found", razorpayOrderId: validated.razorpayOrderId };
}
