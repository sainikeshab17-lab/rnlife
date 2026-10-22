export interface RefundReconciliationReservation {
  id: string;
  order_id: string;
  order_number: string;
  razorpay_payment_id: string;
  razorpay_refund_id: string | null;
  amount_paisa: number;
  currency: string;
  status: string;
  created_at: string;
}

export interface ProviderRefundSnapshot {
  id?: unknown;
  payment_id?: unknown;
  amount?: unknown;
  currency?: unknown;
  status?: unknown;
  created_at?: unknown;
  notes?: Record<string, unknown> | null;
}

export interface RefundReconciliationProvider {
  fetchRefund(paymentId: string, refundId: string): Promise<ProviderRefundSnapshot>;
  fetchRefunds(paymentId: string): Promise<ProviderRefundSnapshot[]>;
}

export type RefundProviderOutcome = "processed" | "failed" | "pending" | "missing" | "uncertain" | "contradictory";

export interface RefundProviderResolution {
  outcome: RefundProviderOutcome;
  refund?: ProviderRefundSnapshot;
  reason?: string;
}

export interface PersistedRefundState {
  status: string;
  razorpay_refund_id: string | null;
  amount_paisa: number;
}

export async function reconcileRefundReservation<T extends PersistedRefundState>(params: {
  reservation: RefundReconciliationReservation;
  provider: RefundReconciliationProvider;
  apply: (resolution: RefundProviderResolution) => Promise<T | undefined>;
  notifyProcessed: (refund: T) => Promise<unknown>;
}): Promise<{ resolution: RefundProviderResolution; stored?: T }> {
  const resolution = await resolveProviderRefund(params.reservation, params.provider);
  if (!["processed", "failed", "pending"].includes(resolution.outcome) || !resolution.refund) {
    return { resolution };
  }

  const stored = await params.apply(resolution);
  if (stored?.status === "processed" && stored.razorpay_refund_id) {
    await params.notifyProcessed(stored);
  }
  return { resolution, stored };
}

const PROVIDER_CLOCK_SKEW_MS = 5 * 60 * 1000;

function isRecentForReservation(refund: ProviderRefundSnapshot, reservation: RefundReconciliationReservation): boolean {
  if (typeof refund.created_at !== "number" || !Number.isFinite(refund.created_at)) return false;
  const reservationTime = Date.parse(reservation.created_at);
  return Number.isFinite(reservationTime) && refund.created_at * 1000 >= reservationTime - PROVIDER_CLOCK_SKEW_MS;
}

function validateRefund(
  refund: ProviderRefundSnapshot,
  reservation: RefundReconciliationReservation
): RefundProviderResolution {
  if (
    typeof refund.id !== "string" || !refund.id ||
    (reservation.razorpay_refund_id && refund.id !== reservation.razorpay_refund_id) ||
    refund.payment_id !== reservation.razorpay_payment_id ||
    refund.amount !== reservation.amount_paisa ||
    refund.currency !== reservation.currency || reservation.currency !== "INR" ||
    refund.notes?.orderId !== reservation.order_id ||
    (refund.notes.orderNumber !== undefined && refund.notes.orderNumber !== reservation.order_number) ||
    !isRecentForReservation(refund, reservation)
  ) {
    return { outcome: "contradictory", reason: "Provider refund details do not match the local reservation." };
  }

  if (refund.status === "processed" || refund.status === "failed" || refund.status === "pending") {
    return { outcome: refund.status, refund };
  }
  return { outcome: "uncertain", refund, reason: "Provider returned an unknown refund state." };
}

/** Read refund status from Razorpay; absence and lookup errors never release a reservation. */
export async function resolveProviderRefund(
  reservation: RefundReconciliationReservation,
  provider: RefundReconciliationProvider
): Promise<RefundProviderResolution> {
  if (reservation.status !== "pending") {
    return { outcome: "contradictory", reason: "Only a pending refund can be reconciled." };
  }

  try {
    if (reservation.razorpay_refund_id) {
      const refund = await provider.fetchRefund(reservation.razorpay_payment_id, reservation.razorpay_refund_id);
      return validateRefund(refund, reservation);
    }

    const refunds = await provider.fetchRefunds(reservation.razorpay_payment_id);
    const recentRefunds = refunds.filter((refund) => isRecentForReservation(refund, reservation));
    const matchingOrder = recentRefunds.filter((refund) => refund.notes?.orderId === reservation.order_id);

    if (matchingOrder.length > 1) {
      return { outcome: "contradictory", reason: "Multiple provider refunds match this reservation." };
    }
    if (matchingOrder.length === 1) return validateRefund(matchingOrder[0], reservation);
    if (recentRefunds.length > 0) {
      return { outcome: "contradictory", reason: "A recent provider refund exists for this payment but has a different order association." };
    }
    return { outcome: "missing", reason: "No matching refund was found; provider absence is not proof of failure." };
  } catch {
    return { outcome: "uncertain", reason: "Razorpay refund status could not be fetched." };
  }
}
