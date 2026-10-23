import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { processCheckoutAttemptExpiryBatch } from "@/services/checkout-payment-attempts";

export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const expected = process.env.CHECKOUT_EXPIRY_CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || supplied.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

/** Invoke from the staging/production scheduler with the configured bearer secret. */
export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await processCheckoutAttemptExpiryBatch();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Checkout attempt expiry batch failed:", error);
    return NextResponse.json({ error: "Checkout attempt expiry batch failed." }, { status: 500 });
  }
}
