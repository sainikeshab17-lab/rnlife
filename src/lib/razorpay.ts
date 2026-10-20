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
  // If running in development/test without real credentials, return safe simulated refund
  if (!RAZORPAY_KEY_SECRET) {
    const simRefundId = `rfnd_sim_${crypto.randomBytes(8).toString("hex")}`;
    return {
      success: true,
      refundId: simRefundId,
      amount: amountPaisa || 99900,
      status: "processed",
    };
  }

  try {
    const client = getRazorpayClient();
    const payload: any = {};
    if (amountPaisa) payload.amount = amountPaisa;
    if (notes) payload.notes = notes;
    if (receipt) payload.receipt = receipt;

    const refund = await (client.payments as any).refund(paymentId, payload);

    return {
      success: true,
      refundId: refund.id,
      amount: refund.amount,
      status: refund.status,
    };
  } catch (err: any) {
    console.error("Razorpay refund creation failed:", err);
    return {
      success: false,
      error: err?.error?.description || err?.message || "Refund failed",
    };
  }
}
