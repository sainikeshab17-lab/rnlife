/**
 * Order Status State Machine
 *
 * Valid fulfilment transitions:
 *   pending_payment → (paid via Razorpay webhook only)
 *   paid            → processing
 *   processing      → shipped
 *   shipped         → delivered
 *
 * Cancellation:
 *   pending_payment → cancelled  (before payment)
 *   paid            → cancelled  (prepaid orders trigger refund process)
 *   advance_paid    → cancelled  (COD Advance remains non-refundable)
 *   processing      → cancelled  (prepaid orders trigger refund process)
 *
 * Terminal states (no further transitions allowed):
 *   delivered, payment_failed, refunded
 *
 * FORBIDDEN via admin API:
 *   * Any transition to "paid" — payment status can only change via
 *     /api/checkout/verify-payment or /api/webhooks/razorpay.
 */

export type OrderStatusValue =
  | "pending_payment"
  | "paid"
  | "advance_paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "payment_failed"
  | "refund_pending"
  | "refunded";

/** Admin-initiatable transitions only (payment transitions are handled separately) */
const ADMIN_TRANSITIONS: Record<OrderStatusValue, OrderStatusValue[]> = {
  pending_payment: ["cancelled"],
  paid: ["processing", "cancelled"],
  advance_paid: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
  payment_failed: [],
  refund_pending: ["refunded"],
  refunded: [],
};

export function isValidAdminTransition(from: string, to: string): boolean {
  const allowed = ADMIN_TRANSITIONS[from as OrderStatusValue] ?? [];
  return allowed.includes(to as OrderStatusValue);
}

export function requiresRefund(from: string, to: string): boolean {
  // Cancelling a paid or processing order means money was collected — refund needed
  return to === "cancelled" && ["paid", "advance_paid", "processing"].includes(from);
}

export function requiresRefundForOrder(
  from: string,
  to: string,
  paymentMethod: string,
  paymentStatus: string
): boolean {
  return requiresRefund(from, to) && paymentMethod !== "COD Advance" && paymentStatus !== "partially_paid";
}

export function canInitiateRefund(paymentMethod: string): boolean {
  return paymentMethod !== "COD Advance";
}

export function getCancellationResultStatus(paymentMethod: string, paymentStatus: string): "refund_pending" | "cancelled" {
  return paymentStatus === "paid" && paymentMethod !== "COD Advance" ? "refund_pending" : "cancelled";
}

export function refundPaymentMatchesOrder(paymentId: unknown, orderPaymentId: string | null): boolean {
  return typeof paymentId === "string" && paymentId.length > 0 && paymentId === orderPaymentId;
}

export function classifyRefundWebhook(order: { payment_method: string; payment_status: string; razorpay_payment_id?: string | null }, paymentId: unknown): "quarantine" | "record_non_refundable" | "process" {
  if (!refundPaymentMatchesOrder(paymentId, order.razorpay_payment_id ?? null)) {
    return "quarantine";
  }
  if (order.payment_method === "COD Advance" || order.payment_status === "partially_paid") {
    return "record_non_refundable";
  }
  return "process";
}

export function getRefundWebhookIdempotencyKey(refundId: string): string {
  return `rzp_refund_${refundId}`;
}

export function isProcessedRefundEvent(eventType: string, refundStatus: unknown): boolean {
  return eventType === "refund.processed" && refundStatus === "processed";
}

export function shouldMarkOrderRefunded(
  paymentMethod: string,
  paymentStatus: string,
  refundedAmount: number,
  orderTotal: number
): boolean {
  return paymentMethod !== "COD Advance" && paymentStatus !== "partially_paid" && refundedAmount >= orderTotal;
}

export function getValidNextStatuses(current: string): OrderStatusValue[] {
  return ADMIN_TRANSITIONS[current as OrderStatusValue] ?? [];
}

export const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Pending Payment",
  paid: "Payment Confirmed",
  advance_paid: "Advance Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  payment_failed: "Payment Failed",
  refund_pending: "Refund Pending",
  refunded: "Refunded",
};

export const STATUS_COLORS: Record<string, string> = {
  pending_payment: "bg-amber-100 text-amber-800",
  paid: "bg-blue-100 text-blue-800",
  advance_paid: "bg-blue-100 text-blue-800",
  processing: "bg-purple-100 text-purple-800",
  shipped: "bg-sky-100 text-sky-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  payment_failed: "bg-red-100 text-red-800",
  refund_pending: "bg-orange-100 text-orange-800",
  refunded: "bg-gray-100 text-gray-700",
};
