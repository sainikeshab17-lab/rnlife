/**
 * RIGHTNOWLIFE Store Policies & Configuration
 *
 * Central configuration for Cancellations, Returns, Exchanges,
 * Shipping, and Refunds.
 *
 * NOTE FOR STORE OWNER:
 * Review and approve these draft policy parameters before launch.
 */

export interface StorePolicyConfig {
  cancellation: {
    // Orders in these statuses can be cancelled by the customer
    eligibleStatuses: string[];
    // Cutoff time after order placement during which cancellation is allowed (hours)
    cutoffHours: number;
    // Customer cancellation note required
    requireReason: boolean;
  };
  returns: {
    // Allowed window after delivery (days)
    windowDays: number;
    // Allow exchange requests
    allowExchanges: boolean;
    // Available reasons for return/exchange
    allowedReasons: string[];
    // Requires inspection before restocking
    requireInspectionBeforeRestock: boolean;
  };
  shipping: {
    // Valid URL schemes for courier tracking links
    allowedUrlSchemes: string[];
    // Standard dispatch timeframe promise (hours)
    dispatchSlaHours: number;
    // Standard estimated delivery timeframe (days)
    estimatedDeliveryDays: number;
  };
  refunds: {
    // Supported states in lifecycle
    lifecycleStates: string[];
    // Razorpay standard refund speed ("normal" = 5-7 business days, "optimum" = instant if available)
    defaultSpeed: "normal" | "optimum";
  };
}

export const STORE_POLICIES: StorePolicyConfig = {
  cancellation: {
    // Eligible for cancellation: pending payment, confirmed paid, processing
    eligibleStatuses: ["pending_payment", "paid", "processing"],
    cutoffHours: 24, // Customer can cancel within 24 hours of placing
    requireReason: true,
  },
  returns: {
    windowDays: 7, // 7-Day Free Size Exchange & Return Guarantee
    allowExchanges: true,
    allowedReasons: [
      "Size too small",
      "Size too large / too oversized",
      "Defective stitching / print blemish",
      "Received wrong design or color",
      "Fabric hand-feel / quality not as expected",
      "Changed mind (unopened & unworn with tags)",
    ],
    requireInspectionBeforeRestock: true, // Never restock automatically
  },
  shipping: {
    allowedUrlSchemes: ["https:", "http:"], // Rejects dangerous javascript: / data: / vbscript:
    dispatchSlaHours: 24,
    estimatedDeliveryDays: 3,
  },
  refunds: {
    lifecycleStates: [
      "refund_requested",
      "refund_pending",
      "refund_processed",
      "refund_failed",
      "refund_rejected",
    ],
    defaultSpeed: "normal",
  },
};

export const RETURN_REASONS = [
  "Size too small",
  "Size too large / too oversized",
  "Defective stitching / print blemish",
  "Received wrong design or color",
  "Fabric hand-feel / quality not as expected",
  "Changed mind (unopened & unworn with tags)",
] as const;

export const CANCELLATION_REASONS = [
  "Ordered wrong size / color by mistake",
  "Duplicate order placed",
  "Shipping timeframe too long",
  "Changed mind / financial reasons",
  "Applied wrong coupon code / wanted discount",
] as const;

export function isValidCancellationStatus(status: string): boolean {
  return STORE_POLICIES.cancellation.eligibleStatuses.includes(status);
}

export function isReturnWindowValid(deliveryDateIso: string): boolean {
  const deliveryTime = new Date(deliveryDateIso).getTime();
  const daysSince = (Date.now() - deliveryTime) / (1000 * 60 * 60 * 24);
  return daysSince <= STORE_POLICIES.returns.windowDays;
}

/**
 * Validates tracking URL safely against allowed schemes
 */
export function isValidTrackingUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (trimmed === "") return false;

  try {
    const parsed = new URL(trimmed);
    return STORE_POLICIES.shipping.allowedUrlSchemes.includes(parsed.protocol);
  } catch {
    return false;
  }
}

function parseShiprocketLabelAllowedHosts(value: string | null | undefined): Set<string> {
  if (!value) return new Set();
  const hosts = value.split(",").map((host) => host.trim().toLowerCase());
  if (!hosts.length || hosts.some((host) =>
    !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)
  )) return new Set();
  return new Set(hosts);
}

export function hasValidShiprocketLabelHostAllowlist(value: string | null | undefined): boolean {
  return parseShiprocketLabelAllowedHosts(value).size > 0;
}

/** Validate a Shiprocket label URL against exact, staging-verified HTTPS hosts. */
export function isValidShiprocketLabelUrl(
  value: string | null | undefined,
  allowedHostsValue: string | null | undefined,
): value is string {
  if (!value || value.length > 4096) return false;
  const allowedHosts = parseShiprocketLabelAllowedHosts(allowedHostsValue);
  if (!allowedHosts.size) return false;

  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password &&
      (!parsed.port || parsed.port === "443") && allowedHosts.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Checks whether an order is eligible for customer-initiated cancellation
 */
export function isOrderEligibleForCancellation(order: {
  order_status: string;
  created_at: string;
}): { eligible: boolean; reason?: string } {
  if (!STORE_POLICIES.cancellation.eligibleStatuses.includes(order.order_status)) {
    return {
      eligible: false,
      reason: `Orders in '${order.order_status}' status cannot be cancelled directly. Once shipped or delivered, please request a Return/Exchange instead.`,
    };
  }

  // Check cutoff hours
  const orderTime = new Date(order.created_at).getTime();
  const now = Date.now();
  const hoursSince = (now - orderTime) / (1000 * 60 * 60);

  if (hoursSince > STORE_POLICIES.cancellation.cutoffHours) {
    return {
      eligible: false,
      reason: `Cancellation window of ${STORE_POLICIES.cancellation.cutoffHours} hours has elapsed. Please request a Return once received.`,
    };
  }

  return { eligible: true };
}

/**
 * Checks whether an order is eligible for customer return or exchange
 */
export function isOrderEligibleForReturn(order: {
  order_status: string;
  actual_delivery_date?: string | null;
  created_at: string;
}): { eligible: boolean; reason?: string } {
  if (order.order_status !== "delivered") {
    return {
      eligible: false,
      reason: "Only delivered orders are eligible for return or size exchange.",
    };
  }

  const deliveryTime = order.actual_delivery_date
    ? new Date(order.actual_delivery_date).getTime()
    : new Date(order.created_at).getTime();
  const now = Date.now();
  const daysSince = (now - deliveryTime) / (1000 * 60 * 60 * 24);

  if (daysSince > STORE_POLICIES.returns.windowDays) {
    return {
      eligible: false,
      reason: `Return window of ${STORE_POLICIES.returns.windowDays} days from delivery has expired.`,
    };
  }

  return { eligible: true };
}
