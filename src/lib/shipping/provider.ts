/**
 * Carrier Integration Abstraction
 *
 * Provides a clean interface for dispatch tracking and label generation
 * without hardcoding carrier-specific APIs across order operations.
 * Allows adding Delhivery, Blue Dart, Shiprocket, or DTDC later
 * without rewriting order management.
 */

export interface TrackingUpdateResult {
  courierName: string;
  trackingNumber: string;
  trackingUrl: string | null;
  statusText?: string;
  estimatedDeliveryDate?: string | null;
}

export interface ShippingProvider {
  name: string;
  generateTrackingUrl(trackingNumber: string): string | null;
  validateAwb(trackingNumber: string): boolean;
  supportsLiveTracking(): boolean;
  fetchLiveStatus?(trackingNumber: string): Promise<{
    currentStatus: string;
    events: Array<{ timestamp: string; location: string; description: string }>;
  } | null>;
}

/**
 * Standard carriers used by RightNowLife
 */
export const SHIPPING_PROVIDERS: Record<string, ShippingProvider> = {
  bluedart: {
    name: "Blue Dart Express",
    generateTrackingUrl: (awb) =>
      `https://www.bluedart.com/tracking?handler=tnt&action=custtrack&trackid=${encodeURIComponent(awb)}`,
    validateAwb: (awb) => /^[0-9]{8,11}$/.test(awb.trim()),
    supportsLiveTracking: () => false, // Live API unconfigured in dev
  },
  delhivery: {
    name: "Delhivery Surface & Express",
    generateTrackingUrl: (awb) =>
      `https://www.delhivery.com/track/package/${encodeURIComponent(awb)}`,
    validateAwb: (awb) => /^[0-9A-Za-z]{10,16}$/.test(awb.trim()),
    supportsLiveTracking: () => false,
  },
  dtdc: {
    name: "DTDC Courier",
    generateTrackingUrl: (awb) =>
      `https://www.dtdc.in/tracking/tracking_results.asp?Ttype=awb_no&strCnno=${encodeURIComponent(awb)}`,
    validateAwb: (awb) => /^[A-Za-z0-9]{9,12}$/.test(awb.trim()),
    supportsLiveTracking: () => false,
  },
  generic: {
    name: "Standard Indian Surface / Air Courier",
    generateTrackingUrl: () => null,
    validateAwb: (awb) => awb.trim().length >= 4,
    supportsLiveTracking: () => false,
  },
};

export function getShippingProvider(providerKey: string): ShippingProvider {
  return SHIPPING_PROVIDERS[providerKey] || SHIPPING_PROVIDERS.generic;
}

export function createTrackingUrl(providerKey: string, awb: string): string | null {
  const provider = getShippingProvider(providerKey);
  return provider.generateTrackingUrl(awb);
}

export function validateAwbFormat(providerKey: string, awb: string): boolean {
  const provider = getShippingProvider(providerKey);
  return provider.validateAwb(awb);
}

export function getProviderByName(name?: string | null): ShippingProvider {
  if (!name) return SHIPPING_PROVIDERS.generic;
  const normalized = name.toLowerCase().replace(/[^a-z]/g, "");
  if (normalized.includes("bluedart") || normalized.includes("blue")) {
    return SHIPPING_PROVIDERS.bluedart;
  }
  if (normalized.includes("delhivery")) {
    return SHIPPING_PROVIDERS.delhivery;
  }
  if (normalized.includes("dtdc")) {
    return SHIPPING_PROVIDERS.dtdc;
  }
  return SHIPPING_PROVIDERS.generic;
}
