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
 *   paid            → cancelled  (must trigger refund process)
 *   processing      → cancelled  (must trigger refund process)
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
  return to === "cancelled" && ["paid", "processing"].includes(from);
}

export function getValidNextStatuses(current: string): OrderStatusValue[] {
  return ADMIN_TRANSITIONS[current as OrderStatusValue] ?? [];
}

export const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Pending Payment",
  paid: "Payment Confirmed",
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
  processing: "bg-purple-100 text-purple-800",
  shipped: "bg-sky-100 text-sky-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  payment_failed: "bg-red-100 text-red-800",
  refund_pending: "bg-orange-100 text-orange-800",
  refunded: "bg-gray-100 text-gray-700",
};
