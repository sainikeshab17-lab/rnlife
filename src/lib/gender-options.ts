import type { ProductGender } from "@/types";

export interface GenderOptionsResponse {
  productFound: boolean;
  genders: ProductGender[];
}

const VALID_GENDERS = new Set<ProductGender>(["Men", "Women", "Unisex"]);

/** Reject malformed API responses rather than treating a failed lookup as no configuration. */
export function parseGenderOptionsResponse(value: unknown): GenderOptionsResponse {
  if (!value || typeof value !== "object" || !("productFound" in value) || typeof value.productFound !== "boolean" || !("genders" in value) || !Array.isArray(value.genders) || value.genders.some((gender) => typeof gender !== "string" || !VALID_GENDERS.has(gender as ProductGender))) {
    throw new Error("Invalid product gender options response.");
  }
  return { productFound: value.productFound, genders: [...new Set(value.genders as ProductGender[])] };
}

export function isAvailableGender(
  configured: readonly ProductGender[],
  selected: ProductGender | null | undefined,
): selected is ProductGender {
  return Boolean(selected && configured.includes(selected));
}

export function genderDisplayLabel(gender: ProductGender): "Male" | "Female" | "Unisex" {
  if (gender === "Men") return "Male";
  if (gender === "Women") return "Female";
  return "Unisex";
}

export function confirmGenderSelection(
  configured: readonly ProductGender[],
  selected: ProductGender | null | undefined,
  onConfirm: (gender: ProductGender) => void,
): boolean {
  if (!isAvailableGender(configured, selected)) return false;
  onConfirm(selected);
  return true;
}
