import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  CreateCheckoutOrderSchema, CheckoutIdempotencyKeySchema, calculateTrustedOrderPricing,
  createCheckoutRequestHash, generateOrderNumber, calculateCodAdvanceAmounts,
} from "@/services/checkout-service";
import {
  checkAndReserveInventory, createCodAdvanceAttempt, createPendingOrder,
  getOrderById, scopeCheckoutIdempotencyKey, withCheckoutIdempotency,
  claimCodAdvanceOrderCreation, attachCodAdvanceRazorpayOrder, setCodAdvanceCreationFailure,
  getPaymentAttemptById,
} from "@/lib/db/orders";
import { getRazorpayClient, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, findRazorpayOrdersByReceipt } from "@/lib/razorpay";
import { classifyRazorpayOrderCreateFailure, classifyRazorpayOrderPayments, validateRazorpayOrderLookup, validateRazorpayOrderResponse } from "@/services/razorpay-order-recovery";
import type { DbOrder } from "@/lib/db";

export const dynamic = "force-dynamic";

const RequestSchema = CreateCheckoutOrderSchema.extend({ idempotencyKey: CheckoutIdempotencyKeySchema });
class InventoryConflictError extends Error {}

async function prepareAdvanceProviderOrder(order: DbOrder, attemptId: string): Promise<
  | { status: "ready"; razorpayOrderId: string }
  | { status: "processing" | "reconciliation_required" | "retryable" }
> {
  const attempt = await getPaymentAttemptById(attemptId);
  if (!attempt || attempt.order_id !== order.id || attempt.purpose !== "cod_advance" || attempt.amount_paisa !== 20000) {
    return { status: "reconciliation_required" as const };
  }
  if (attempt.razorpay_order_id && attempt.creation_state === "ready") {
    try {
      const outcome = classifyRazorpayOrderPayments(await getRazorpayClient().orders.fetchPayments(attempt.razorpay_order_id), {
        orderId: attempt.razorpay_order_id, amount: 20000,
      });
      if (outcome === "none" || outcome === "failed") return { status: "ready" as const, razorpayOrderId: attempt.razorpay_order_id };
      return { status: outcome === "authorized" ? "processing" as const : "reconciliation_required" as const };
    } catch {
      return { status: "reconciliation_required" as const };
    }
  }

  if (attempt.creation_state === "unknown" && !attempt.razorpay_order_id) {
    try {
      const lookup = validateRazorpayOrderLookup(await findRazorpayOrdersByReceipt(attempt.receipt), {
        receipt: attempt.receipt, amount: 20000, orderId: order.id,
      });
      if (lookup.status === "found" && await attachCodAdvanceRazorpayOrder(attempt.id, lookup.razorpayOrderId)) {
        return prepareAdvanceProviderOrder(order, attempt.id);
      }
    } catch { /* ambiguity remains durable; never create another provider order */ }
    return { status: "reconciliation_required" as const };
  }

  const claim = await claimCodAdvanceOrderCreation(attempt.id);
  if (claim === "ready") return prepareAdvanceProviderOrder(order, attempt.id);
  if (claim !== "claimed") return { status: claim === "wait" ? "processing" as const : "reconciliation_required" as const };

  try {
    const providerOrder = await getRazorpayClient().orders.create({
      amount: 20000, currency: "INR", receipt: attempt.receipt,
      notes: { orderId: order.id, orderNumber: order.order_number, paymentAttemptId: attempt.id, paymentPurpose: "cod_advance" },
    });
    const checked = validateRazorpayOrderResponse(providerOrder, { receipt: attempt.receipt, amount: 20000, orderId: order.id });
    if (!checked.valid || !await attachCodAdvanceRazorpayOrder(attempt.id, checked.razorpayOrderId)) {
      await setCodAdvanceCreationFailure(attempt.id, "unknown", "provider_order_response_mismatch");
      return { status: "reconciliation_required" as const };
    }
    return { status: "ready" as const, razorpayOrderId: checked.razorpayOrderId };
  } catch (error) {
    const state = classifyRazorpayOrderCreateFailure(error);
    await setCodAdvanceCreationFailure(attempt.id, state === "retryable" ? "retryable" : "unknown", state);
    if (state === "unknown") {
      // Receipt reconciliation is read-only and must find exactly one matching provider order.
      try {
        const lookup = validateRazorpayOrderLookup(await findRazorpayOrdersByReceipt(attempt.receipt), {
          receipt: attempt.receipt, amount: 20000, orderId: order.id,
        });
        if (lookup.status === "found" && await attachCodAdvanceRazorpayOrder(attempt.id, lookup.razorpayOrderId)) {
          return prepareAdvanceProviderOrder(order, attempt.id);
        }
      } catch { /* keep the attempt ambiguous and require safe reconciliation */ }
    }
    return { status: state === "retryable" ? "retryable" as const : "reconciliation_required" as const };
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    const user = data.user;
    if (error || !user?.email) return NextResponse.json({ success: false, error: "Please sign in before choosing COD Advance." }, { status: 401 });

    const raw: unknown = await req.json();
    const parsed = RequestSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid checkout details.", details: parsed.error.flatten().fieldErrors }, { status: 400 });
    const { customerName, customerPhone, address, items, promoCode, idempotencyKey: requestKey } = parsed.data;
    const customerEmail = user.email;
    const result = calculateTrustedOrderPricing(items, promoCode);
    if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    const pricing = result.pricing;
    const advanceAmounts = calculateCodAdvanceAmounts(pricing.total);
    if (!advanceAmounts.success) return NextResponse.json({ success: false, error: advanceAmounts.error }, { status: 400 });
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) return NextResponse.json({ success: false, error: "Online payments are temporarily unavailable." }, { status: 503 });

    const stockItems = pricing.items.filter((item) => item.fulfillmentType === "stock");
    const idempotencyKey = scopeCheckoutIdempotencyKey(user.id, requestKey);
    const paymentMethod = "COD Advance";
    const requestHash = createCheckoutRequestHash({
      userId: user.id, customerEmail, paymentMethod, customerName, customerPhone, address,
      items: pricing.items, subtotal: pricing.subtotal, shipping: pricing.shipping,
      discount: pricing.discount, total: pricing.total,
    });
    const checkout = await withCheckoutIdempotency({
      idempotencyKey, requestHash,
      create: async (db) => {
        const stock = await checkAndReserveInventory(stockItems.map((item) => ({ productId: item.productId, size: item.size, quantity: item.quantity })), db);
        if (!stock.ok) throw new InventoryConflictError(stock.error || "Insufficient stock.");
        const created = await createPendingOrder({
          orderNumber: generateOrderNumber(), customerName, customerEmail, customerPhone,
          subtotal: pricing.subtotal, shipping: pricing.shipping, discount: pricing.discount,
          total: pricing.total, paymentMethod, userId: user.id,
          items: pricing.items, address,
        }, db);
        await db.prepare("UPDATE orders SET payment_status = 'pending_advance' WHERE id = ?").run(created.order.id);
        await createCodAdvanceAttempt(created.order.id, idempotencyKey, db);
        return created;
      },
    });
    if (checkout.status === "conflict") return NextResponse.json({ success: false, error: "This checkout key was used with different details. Start checkout again." }, { status: 409 });
    const order = await getOrderById(checkout.order.id);
    if (!order) return NextResponse.json({ success: false, error: "Created order could not be reloaded for payment setup." }, { status: 503 });
    if (checkout.status === "replayed" && order.payment_status !== "pending_advance") {
      return NextResponse.json({ success: false, error: "This order is no longer waiting for an advance. Check your orders." }, { status: 409 });
    }
    const attemptId = order.current_payment_attempt_id;
    if (!attemptId) return NextResponse.json({ success: false, error: "Payment attempt is missing and requires support reconciliation." }, { status: 503 });
    const provider = await prepareAdvanceProviderOrder(order, attemptId);
    if (provider.status !== "ready") {
      const status = provider.status === "processing" ? 202 : provider.status === "retryable" ? 502 : 503;
      return NextResponse.json({ success: false, status: provider.status, orderId: order.id, orderNumber: order.order_number,
        error: provider.status === "processing" ? "The ₹200 payment is still being checked. Retry shortly; do not start a new checkout."
          : provider.status === "retryable" ? "Razorpay declined order setup. Correct the issue and retry this same checkout."
            : "Payment setup needs reconciliation. Your order and stock reservation are saved; do not start another checkout." }, { status });
    }
    return NextResponse.json({ success: true, orderId: order.id, orderNumber: order.order_number,
      paymentAttemptId: attemptId, razorpayOrderId: provider.razorpayOrderId, amount: 20000, currency: "INR", keyId: RAZORPAY_KEY_ID,
      total: order.total, balanceDue: calculateCodAdvanceAmounts(order.total).success
        ? order.total - advanceAmounts.advance : 0,
      pricing: { subtotal: order.subtotal, shipping: order.shipping, discount: order.discount, total: order.total },
    }, { status: checkout.status === "created" ? 201 : 200 });
  } catch (error) {
    if (error instanceof InventoryConflictError) return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    console.error("[COD Advance] Checkout initialization failed.", error);
    return NextResponse.json({ success: false, error: "Unable to initialize COD Advance. Please retry the same checkout." }, { status: 500 });
  }
}
