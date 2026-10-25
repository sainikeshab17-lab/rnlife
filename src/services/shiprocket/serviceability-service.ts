import "server-only";
import { ShiprocketError, shiprocketRequest } from "@/lib/shiprocket/client";

export type ShiprocketServiceabilityInput = {
  deliveryPostcode: string;
  cod: boolean;
  weightKg?: number;
  dimensionsCm?: { length: number; breadth: number; height: number };
};
export type ShiprocketCourierOption = {
  courierId: number;
  courierName: string;
  rate?: number;
  estimatedDeliveryDays?: number;
  estimatedDeliveryDate?: string;
  rating?: number;
};
export type ShiprocketServiceabilityResult = {
  serviceable: boolean;
  couriers: ShiprocketCourierOption[];
};

type ServiceabilityResponse = {
  data?: { available_courier_companies?: unknown };
};
type ServiceabilityDependencies = {
  request: typeof shiprocketRequest;
  env: NodeJS.ProcessEnv;
};

const runtimeDependencies = (): ServiceabilityDependencies => ({ request: shiprocketRequest, env: process.env });

function positiveNumber(raw: string | undefined, name: string): number {
  const value = raw?.trim() ? Number(raw) : NaN;
  if (!Number.isFinite(value) || value <= 0) throw new ShiprocketError(`${name} must be configured as a positive number.`, 503);
  return value;
}

function optionalPositiveNumber(raw: string | undefined, name: string): number | undefined {
  if (!raw?.trim()) return undefined;
  return positiveNumber(raw, name);
}

function normalizeCourier(value: unknown): ShiprocketCourierOption {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ShiprocketError("Shiprocket returned an invalid serviceability response.", 502);
  }
  const row = value as Record<string, unknown>;
  const courierId = row.courier_company_id;
  const courierName = row.courier_name;
  if (!Number.isSafeInteger(Number(courierId)) || Number(courierId) <= 0 ||
      typeof courierName !== "string" || !courierName.trim() || courierName.length > 120) {
    throw new ShiprocketError("Shiprocket returned an invalid serviceability response.", 502);
  }

  const result: ShiprocketCourierOption = { courierId: Number(courierId), courierName: courierName.trim() };
  const rate = optionalProviderNumber(row.rate ?? row.freight_charge);
  const estimatedDeliveryDays = optionalProviderNumber(row.estimated_delivery_days);
  const rating = optionalProviderNumber(row.rating);
  if (rate !== undefined) result.rate = rate;
  if (estimatedDeliveryDays !== undefined) result.estimatedDeliveryDays = estimatedDeliveryDays;
  if (rating !== undefined) result.rating = rating;
  if (typeof row.etd === "string" && row.etd.trim() && row.etd.length <= 80) result.estimatedDeliveryDate = row.etd.trim();
  return result;
}

function optionalProviderNumber(value: unknown): number | undefined {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  if (typeof value === "string" && !value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export async function checkShiprocketServiceability(
  input: ShiprocketServiceabilityInput,
  deps = runtimeDependencies(),
): Promise<ShiprocketServiceabilityResult> {
  const pickupLocation = deps.env.SHIPROCKET_PICKUP_LOCATION?.trim();
  const pickupPostcode = deps.env.SHIPROCKET_PICKUP_POSTCODE?.trim();
  if (!pickupLocation) throw new ShiprocketError("SHIPROCKET_PICKUP_LOCATION must identify the configured pickup location.", 503);
  if (!pickupPostcode || !/^\d{6}$/.test(pickupPostcode)) {
    throw new ShiprocketError("SHIPROCKET_PICKUP_POSTCODE must be configured as a six-digit postcode for that pickup location.", 503);
  }
  if (!input || typeof input.deliveryPostcode !== "string" || !/^\d{6}$/.test(input.deliveryPostcode) ||
      typeof input.cod !== "boolean") {
    throw new ShiprocketError("A six-digit delivery postcode and COD selection are required.", 400);
  }

  const weight = input.weightKg === undefined
    ? positiveNumber(deps.env.SHIPROCKET_PACKAGE_WEIGHT_KG, "SHIPROCKET_PACKAGE_WEIGHT_KG")
    : positiveInputNumber(input.weightKg, "Package weight");
  const dimensionNames = ["SHIPROCKET_PACKAGE_LENGTH_CM", "SHIPROCKET_PACKAGE_BREADTH_CM", "SHIPROCKET_PACKAGE_HEIGHT_CM"] as const;
  const dimensions = input.dimensionsCm
    ? [
        positiveInputNumber(input.dimensionsCm.length, "Package length"),
        positiveInputNumber(input.dimensionsCm.breadth, "Package breadth"),
        positiveInputNumber(input.dimensionsCm.height, "Package height"),
      ]
    : dimensionNames.map(name => optionalPositiveNumber(deps.env[name], name));
  if (dimensions.some(value => value !== undefined) && dimensions.some(value => value === undefined)) {
    throw new ShiprocketError("Configure all three package dimensions or leave all three blank.", 503);
  }

  const query = new URLSearchParams({
    pickup_postcode: pickupPostcode,
    delivery_postcode: input.deliveryPostcode,
    cod: input.cod ? "1" : "0",
    weight: String(weight),
  });
  if (dimensions.every((value): value is number => value !== undefined)) {
    query.set("length", String(dimensions[0]));
    query.set("breadth", String(dimensions[1]));
    query.set("height", String(dimensions[2]));
  }

  const response = await deps.request<ServiceabilityResponse>(`/courier/serviceability/?${query.toString()}`, "GET");
  const available = response?.data?.available_courier_companies;
  if (!Array.isArray(available)) throw new ShiprocketError("Shiprocket returned an invalid serviceability response.", 502);
  const couriers = available.map(normalizeCourier);
  return { serviceable: couriers.length > 0, couriers };
}

function positiveInputNumber(value: number, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new ShiprocketError(`${label} must be a positive number.`, 400);
  }
  return value;
}
