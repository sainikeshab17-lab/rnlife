import crypto from "crypto";
import Razorpay from "razorpay";

export const RAZORPAY_KEY_ID =
  process.env.RAZORPAY_KEY_ID ||
  process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
  "rzp_test_placeholder_key";

export const RAZORPAY_KEY_SECRET =
  process.env.RAZORPAY_KEY_SECRET || "rzp_test_placeholder_secret";

export const RAZORPAY_WEBHOOK_SECRET =
  process.env.RAZORPAY_WEBHOOK_SECRET || "rzp_webhook_placeholder_secret";

// Initialize Razorpay SDK instance on the server
let razorpayClient: Razorpay | null = null;

export function getRazorpayClient(): Razorpay {
  if (!razorpayClient) {
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
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
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
  if (!rawBody || !signature) {
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
