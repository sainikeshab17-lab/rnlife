import { createHash } from "crypto";
import { z } from "zod";
import { PRODUCTS } from "@/data/mock-data";
import { CustomTShirtCustomization, TShirtSize } from "@/types";

// Indian Phone Number: allows +91-XXXXXXXXXX, 91XXXXXXXXXX, or 10-digit 6-9XXXXXXXXX
const phoneRegex = /^(?:\+91|91|0)?[6-9]\d{9}$/;

// Standard Indian postal PIN code: 6 digits (first digit 1-9), spaces sanitized
const pinCodeRegex = /^[1-9]\d{5}$/;
export const CUSTOM_QUOTE_PRODUCT_ID = "rnl-custom-quote-tee";
const CustomizationSchema = z.object({
  type: z.literal("quote_tshirt"),
  mood: z.enum(["happy", "confident", "savage", "heartbroken", "overthinking", "energetic", "exhausted", "angry", "funny", "emotional"]),
  quote: z.string().trim().min(1).max(80),
  quoteStyle: z.enum(["deep", "savage", "minimal", "funny"]),
  font: z.enum(["bold", "serif", "mono"]),
  printColor: z.enum(["ink", "sun", "ocean", "berry"]),
  placement: z.enum(["center", "chest"]),
});

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
  gender: z.enum(["Men", "Women", "Unisex"]).optional(),
  customization: CustomizationSchema.optional(),
}).strict();

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
});

export type CreateCheckoutOrderInput = z.infer<typeof CreateCheckoutOrderSchema>;

export const CheckoutIdempotencyKeySchema = z.string().uuid();

export function createCheckoutRequestHash(params: {
  userId: string | null;
  customerEmail: string;
  paymentMethod: string;
  customerName: string;
  customerPhone: string;
  address: z.infer<typeof DeliveryAddressSchema>;
  items: VerifiedCheckoutItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
}): string {
  return createHash("sha256").update(JSON.stringify({
    ...params,
    customerEmail: params.customerEmail.toLowerCase().trim(),
    customerPhone: params.customerPhone.trim(),
  })).digest("hex");
}

export interface VerifiedCheckoutItem {
  productId: string;
  productSlug: string;
  productName: string;
  color: string;
  gender?: "Men" | "Women" | "Unisex";
  size: TShirtSize;
  price: number;
  quantity: number;
  image: string;
  sku: string;
  fit: string;
  fulfillmentType: "stock" | "made_to_order";
  customization?: CustomTShirtCustomization;
}

export interface CalculatedOrderPricing {
  items: VerifiedCheckoutItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  appliedPromo?: string;
}

export function calculateCodAdvanceAmounts(orderTotal: number): { success: true; advance: number; balanceDue: number } | { success: false; error: string } {
  if (!Number.isSafeInteger(orderTotal) || orderTotal <= 200) {
    return { success: false, error: "COD Advance is available only when the final order total is greater than ₹200." };
  }
  return { success: true, advance: 200, balanceDue: orderTotal - 200 };
}

/**
 * Server-controlled calculation of checkout pricing using trusted catalogue data
 * and the explicit made-to-order custom quote product contract.
 * Shipping is ₹0 (Free shipping on all orders).
 * Promo discount is ₹0 (Coupons removed).
 * Graphic tees remain ₹999; custom quote tees are ₹1,299.
 * Total = subtotal.
 */
export function calculateTrustedOrderPricing(
  itemsInput: z.infer<typeof CheckoutItemSchema>[],
  _promoCodeInput?: string,
  configuredGenderOptions: Record<string, Array<"Men" | "Women" | "Unisex">> = {}
): { success: true; pricing: CalculatedOrderPricing } | { success: false; error: string } {
  if (!itemsInput || itemsInput.length === 0) {
    return { success: false, error: "Cart is empty" };
  }

  const verifiedItems: VerifiedCheckoutItem[] = [];
  let calculatedSubtotal = 0;

  for (const item of itemsInput) {
    if (item.productId === CUSTOM_QUOTE_PRODUCT_ID) {
      const parsedCustomization = CustomizationSchema.safeParse(item.customization);
      if (!parsedCustomization.success) {
        return { success: false, error: "Custom T-shirt details are missing or invalid." };
      }
      if (/\b(kill|die|hate|fuck|shit|bitch|asshole)\b/i.test(parsedCustomization.data.quote)) {
        return { success: false, error: "Please choose a T-shirt quote without offensive language." };
      }
      const price = 1299;
      calculatedSubtotal += price * item.quantity;
      verifiedItems.push({
        productId: CUSTOM_QUOTE_PRODUCT_ID,
        productSlug: "wear-your-mood",
        productName: "Wear Your Mood Custom Quote Tee",
        color: "Natural",
        size: item.size,
        price,
        quantity: item.quantity,
        image: "/products/custom-tee-preview.svg",
        sku: `RNL-CUSTOM-QUOTE-${item.size}`,
        fit: "Regular",
        fulfillmentType: "made_to_order",
        customization: parsedCustomization.data,
      });
      continue;
    }

    if (item.customization) {
      return { success: false, error: "Customization cannot be attached to a catalog product." };
    }
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
    const configuredGenders = configuredGenderOptions[trustedProduct.id] ?? trustedProduct.genders ?? [];
    if (configuredGenders.length > 0 && !item.gender) {
      return { success: false, error: `Please select a gender for ${trustedProduct.name}.` };
    }
    if (item.gender && !configuredGenders.includes(item.gender)) {
      return { success: false, error: `Gender ${item.gender} is not available for ${trustedProduct.name}.` };
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
      ...(item.gender ? { gender: item.gender } : {}),
      size: item.size,
      price: fixedPrice,
      quantity: item.quantity,
      image: matchedColor?.images[0] || trustedProduct.colors[0].images[0],
      sku: `${trustedProduct.sku}-${item.size}`,
      fit: trustedProduct.fit,
      fulfillmentType: "stock",
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
