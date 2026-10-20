import { z } from "zod";
import { PRODUCTS } from "@/data/mock-data";
import { TShirtSize } from "@/types";

// Indian Phone Number: allows +91-XXXXXXXXXX, 91XXXXXXXXXX, or 10-digit 6-9XXXXXXXXX
const phoneRegex = /^(?:\+91|91|0)?[6-9]\d{9}$/;

// Standard Indian postal PIN code: 6 digits (first digit 1-9), spaces sanitized
const pinCodeRegex = /^[1-9]\d{5}$/;

export const CheckoutItemSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  size: z.enum(["XS", "S", "M", "L", "XL", "XXL"] as const, {
    errorMap: () => ({ message: "Please select a valid size (XS, S, M, L, XL, XXL)" }),
  }),
  quantity: z
    .number()
    .int("Quantity must be an integer")
    .min(1, "Quantity must be at least 1")
    .max(10, "Quantity cannot exceed 10 per design"),
  color: z.string().default("As pictured"),
});

export const DeliveryAddressSchema = z.object({
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters").max(100),
  phone: z
    .string()
    .trim()
    .regex(phoneRegex, "Please enter a valid 10-digit Indian mobile number"),
  addressLine1: z.string().trim().min(5, "Flat / House no. and street address is required").max(200),
  addressLine2: z.string().trim().max(200).optional(),
  landmark: z.string().trim().max(100).optional(),
  city: z.string().trim().min(2, "City is required").max(100),
  state: z.string().trim().min(2, "State is required").max(100),
  pinCode: z
    .string()
    .trim()
    .transform((val) => val.replace(/\s+/g, ""))
    .pipe(z.string().regex(pinCodeRegex, "Please enter a valid postal PIN code")),
  country: z.string().trim().default("India"),
});

export const CreateCheckoutOrderSchema = z.object({
  customerName: z.string().trim().min(2, "Customer name is required"),
  customerEmail: z.string().trim().email("Please provide a valid email address"),
  customerPhone: z
    .string()
    .trim()
    .regex(phoneRegex, "Please enter a valid 10-digit Indian mobile number"),
  address: DeliveryAddressSchema,
  items: z.array(CheckoutItemSchema).min(1, "Your cart must contain at least one T-shirt"),
  promoCode: z.string().trim().optional(),
  userId: z.string().optional(),
});

export type CreateCheckoutOrderInput = z.infer<typeof CreateCheckoutOrderSchema>;

export interface VerifiedCheckoutItem {
  productId: string;
  productSlug: string;
  productName: string;
  color: string;
  size: TShirtSize;
  price: number; // Trusted: ₹999 strictly
  quantity: number;
  image: string;
  sku: string;
  fit: string;
}

export interface CalculatedOrderPricing {
  items: VerifiedCheckoutItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  appliedPromo?: string;
}

/**
 * Server-controlled calculation of checkout pricing using trusted catalogue data.
 * Fixes every T-shirt price strictly to ₹999.
 * Shipping is ₹0 (Free shipping on all orders).
 * Promo discount is ₹0 (Coupons removed).
 * Line total = ₹999 * quantity.
 * Subtotal = ₹999 * total quantity.
 * Total = subtotal.
 */
export function calculateTrustedOrderPricing(
  itemsInput: z.infer<typeof CheckoutItemSchema>[],
  _promoCodeInput?: string
): { success: true; pricing: CalculatedOrderPricing } | { success: false; error: string } {
  if (!itemsInput || itemsInput.length === 0) {
    return { success: false, error: "Cart is empty" };
  }

  const verifiedItems: VerifiedCheckoutItem[] = [];
  let calculatedSubtotal = 0;

  for (const item of itemsInput) {
    const trustedProduct = PRODUCTS.find((p) => p.id === item.productId);
    if (!trustedProduct) {
      return { success: false, error: `Invalid product ID: ${item.productId}` };
    }

    if (!trustedProduct.sizes.includes(item.size)) {
      return {
        success: false,
        error: `Size ${item.size} is not available for ${trustedProduct.name}`,
      };
    }

    // Always use authoritative fixed price: ₹999
    const fixedPrice = 999;
    const lineTotal = fixedPrice * item.quantity;
    calculatedSubtotal += lineTotal;

    const matchedColor =
      trustedProduct.colors.find((c) => c.name.toLowerCase() === item.color.toLowerCase()) ||
      trustedProduct.colors[0];

    verifiedItems.push({
      productId: trustedProduct.id,
      productSlug: trustedProduct.slug,
      productName: trustedProduct.name,
      color: matchedColor?.name || "As pictured",
      size: item.size,
      price: fixedPrice,
      quantity: item.quantity,
      image: matchedColor?.images[0] || trustedProduct.colors[0].images[0],
      sku: `${trustedProduct.sku}-${item.size}`,
      fit: trustedProduct.fit,
    });
  }

  // Section 7 pricing rules:
  // Shipping: ₹0
  // Additional fees: ₹0
  // Discount: ₹0 (Promo codes removed)
  const shippingCharge = 0;
  const discountAmount = 0;
  const calculatedTotal = calculatedSubtotal;

  return {
    success: true,
    pricing: {
      items: verifiedItems,
      subtotal: calculatedSubtotal,
      shipping: shippingCharge,
      discount: discountAmount,
      total: calculatedTotal,
    },
  };
}

/**
 * Generates human-friendly sequential order numbers, e.g. RNL-261048
 */
export function generateOrderNumber(): string {
  const datePrefix = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const entropy = Math.floor(100 + Math.random() * 900);
  return `RNL-${datePrefix}-${randomSuffix}-${entropy}`;
}
