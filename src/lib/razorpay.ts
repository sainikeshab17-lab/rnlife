import crypto from "crypto";
import Razorpay from "razorpay";

export const RAZORPAY_KEY_ID =
  process.env.RAZORPAY_KEY_ID ||
  process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
  "";

export const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";

export const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "";

// Initialize Razorpay SDK instance on the server
let razorpayClient: Razorpay | null = null;

export function getRazorpayClient(): Razorpay {
  if (!razorpayClient) {
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      throw new Error("Razorpay server credentials are not configured.");
    }

    razorpayClient = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayClient;
}

export async function findRazorpayOrdersByReceipt(receipt: string) {
  // Supported by the installed Razorpay SDK's orders.all({ receipt, count }) API.
  return getRazorpayClient().orders.all({ receipt, count: 100 });
}

export interface VerifyPaymentSignatureParams {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  secret?: string;
}

/**
 * Validates Razorpay standard payment signature using HMAC SHA256
 * and constant-time comparison to prevent timing attacks.
 */
export function verifyPaymentSignature({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
  secret = RAZORPAY_KEY_SECRET,
}: VerifyPaymentSignatureParams): boolean {
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !secret) {
    return false;
  }

  try {
    const text = `${razorpayOrderId}|${razorpayPaymentId}`;
    const generatedSignature = crypto
      .createHmac("sha256", secret)
      .update(text)
      .digest("hex");

    const expectedBuffer = Buffer.from(generatedSignature, "utf-8");
    const receivedBuffer = Buffer.from(razorpaySignature, "utf-8");

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  } catch (err) {
    console.error("Payment signature verification failed with error:", err);
    return false;
  }
}

/**
 * Validates Razorpay Webhook signature against raw request body
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string = RAZORPAY_WEBHOOK_SECRET
): boolean {
  if (!rawBody || !signature || !secret) {
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "utf-8");
    const receivedBuffer = Buffer.from(signature, "utf-8");

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  } catch (err) {
    console.error("Webhook signature verification failed with error:", err);
    return false;
  }
}

export function isPaymentCaptured(status: string | undefined): boolean {
  return status === "captured";
}

export function isVerifiedCapturedWebhookPayment(payment: unknown): payment is {
  id: string;
  order_id: string;
  status: "captured";
  captured: true;
  currency: "INR";
  amount: number;
} {
  if (!payment || typeof payment !== "object") return false;
  const candidate = payment as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.order_id === "string" &&
    candidate.status === "captured" &&
    candidate.captured === true &&
    candidate.currency === "INR" &&
    typeof candidate.amount === "number" &&
    Number.isSafeInteger(candidate.amount) &&
    candidate.amount > 0
  );
}

export function isVerifiedCapturedPaymentDetails(
  payment: unknown,
  expectedOrderId: string,
  expectedAmountPaisa: number
): boolean {
  return isVerifiedCapturedWebhookPayment(payment) &&
    payment.order_id === expectedOrderId &&
    payment.amount === expectedAmountPaisa;
}

/** Validates a fetched provider payment's identity and price before branching on its state. */
export function isVerifiedPaymentDetails(
  payment: unknown,
  expectedOrderId: string,
  expectedAmountPaisa: number,
  expectedPaymentId?: string
): payment is { id: string; order_id: string; amount: number; currency: "INR"; status: string; captured: boolean } {
  if (!payment || typeof payment !== "object") return false;
  const candidate = payment as Record<string, unknown>;
  return typeof candidate.id === "string" && candidate.id.length > 0 &&
    (!expectedPaymentId || candidate.id === expectedPaymentId) &&
    candidate.order_id === expectedOrderId &&
    candidate.amount === expectedAmountPaisa &&
    candidate.currency === "INR" &&
    Number.isSafeInteger(candidate.amount) &&
    ["created", "authorized", "captured", "refunded", "failed", "cancelled"].includes(String(candidate.status)) &&
    typeof candidate.captured === "boolean";
}

export interface CreateRefundParams {
  paymentId: string;
  amountPaisa?: number; // In paisa (e.g. 99900 for ₹999.00). If omitted, full refund.
  notes?: Record<string, string>;
  receipt?: string;
}

export interface RazorpayRefundResult {
  success: boolean;
  refundId?: string;
  amount?: number;
  status?: string;
  error?: string;
}

/**
 * Initiates an online refund via Razorpay Payments API
 */
export async function createRazorpayRefund({
  paymentId,
  amountPaisa,
  notes,
  receipt,
}: CreateRefundParams): Promise<RazorpayRefundResult> {
  // A simulated refund must never be reported as a successful provider refund:
  // the caller persists successful results as money returned to the customer.
  if (!RAZORPAY_KEY_SECRET) {
    return {
      success: false,
      error: "Razorpay server credentials are not configured.",
    };
  }

  try {
    const client = getRazorpayClient();
    const payload: Parameters<Razorpay["payments"]["refund"]>[1] = {};
    if (amountPaisa) payload.amount = amountPaisa;
    if (notes) payload.notes = notes;
    if (receipt) payload.receipt = receipt;

    const refund = await client.payments.refund(paymentId, payload);

    return {
      success: true,
      refundId: refund.id,
      amount: refund.amount,
      status: refund.status,
    };
  } catch (err: unknown) {
    console.error("Razorpay refund creation failed:", err);
    const details = err && typeof err === "object"
      ? err as { error?: { description?: string }; message?: string }
      : undefined;
    return {
      success: false,
      error: details?.error?.description || details?.message || "Refund failed",
    };
  }
}
