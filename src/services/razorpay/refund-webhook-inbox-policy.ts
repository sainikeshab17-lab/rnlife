import { createHash } from "node:crypto";

export type RefundInboxState = "received" | "deferred" | "processed" | "quarantined";

export function classifyRefundWebhook(eventType: string, providerStatus: unknown): string | null {
  if (eventType === "refund.processed" && providerStatus !== "processed") {
    return "refund_processed_status_mismatch";
  }
  if (eventType === "refund.speed_changed") return "refund_speed_changed_not_a_terminal_refund_outcome";
  if (eventType === "refund.failed" && providerStatus !== "failed") return "refund_failed_status_mismatch";
  return null;
}

export function refundWebhookEventKey(sourceEventId: string | null | undefined, fallbackFingerprint: string) {
  const identity = sourceEventId ? `razorpay-source-event\0${sourceEventId}` : `payload-fallback\0${fallbackFingerprint}`;
  return createHash("sha256").update(identity).digest("hex");
}

export function stablePayloadFingerprint(value: unknown): string {
  const normalize = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(normalize);
    if (input && typeof input === "object") {
      return Object.fromEntries(Object.entries(input as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, normalize(entry)]));
    }
    return input;
  };
  return createHash("sha256").update(JSON.stringify(normalize(value))).digest("hex");
}

const LEGAL_TRANSITIONS: Record<RefundInboxState, readonly RefundInboxState[]> = {
  received: ["received", "deferred", "processed", "quarantined"],
  deferred: ["deferred", "processed", "quarantined"],
  processed: ["processed"],
  quarantined: ["quarantined"],
};

export function isLegalRefundInboxTransition(from: RefundInboxState, to: RefundInboxState) {
  return LEGAL_TRANSITIONS[from].includes(to);
}
