import { NextRequest, NextResponse } from "next/server";
import {
  CheckoutIdempotencyKeySchema,
  CreateCheckoutOrderSchema,
  calculateTrustedOrderPricing,
  createCheckoutRequestHash,
  generateOrderNumber,
} from "@/services/checkout-service";
import {
  checkAndReserveInventory,
  claimRazorpayOrderCreation,
  createPendingOrder,
  getRazorpayOrderCreationState,
  getOrderById,
  logPaymentAudit,
  markRazorpayOrderCreationRetryable,
  markRazorpayOrderCreationUnknown,
  markStaleRazorpayOrderCreationUnknown,
  scopeCheckoutIdempotencyKey,
  updateOrderRazorpayId,
  withCheckoutIdempotency,
} from "@/lib/db/orders";
import { findRazorpayOrdersByReceipt, getRazorpayClient, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } from "@/lib/razorpay";
import { createClient } from "@/lib/supabase/server";
import type { DbOrder } from "@/lib/db";
import {
  classifyRazorpayOrderCreateFailure,
  getRazorpayOrderRecoveryAction,
  validateRazorpayOrderLookup,
  validateRazorpayOrderResponse,
  classifyRazorpayOrderPayments,
  type RazorpayOrderCreationState,
} from "@/services/razorpay-order-recovery";

const CheckoutRequestSchema = CreateCheckoutOrderSchema.extend({
  idempotencyKey: CheckoutIdempotencyKeySchema,
});

class InventoryConflictError extends Error {}

type RazorpayOrderResolution =
  | { status: "ready"; razorpayOrderId: string }
  | { status: "processing" | "reconciliation_required" | "retryable" };

async function resolveRazorpayOrder(order: DbOrder, receipt: string, allowClaim = true): Promise<RazorpayOrderResolution> {
  if (order.razorpay_order_id) {
    try {
      const payments = await getRazorpayClient().orders.fetchPayments(order.razorpay_order_id);
      const outcome = classifyRazorpayOrderPayments(payments, {
        orderId: order.razorpay_order_id,
        amount: Math.round(order.total * 100),
      });
      if (outcome === "none" || outcome === "failed") {
        return { status: "ready", razorpayOrderId: order.razorpay_order_id };
      }
      if (outcome === "authorized") return { status: "processing" };
      return { status: "reconciliation_required" };
    } catch (error: unknown) {
      console.error(`[Checkout] Could not confirm existing Razorpay order status for local order ${order.id}.`, error);
      return { status: "reconciliation_required" };
    }
  }

  const creation = await getRazorpayOrderCreationState(order.id);

  const expected = {
    receipt,
    amount: Math.round(order.total * 100),
    orderId: order.id,
  };
  const action = getRazorpayOrderRecoveryAction({
    state: (creation.state ?? null) as RazorpayOrderCreationState,
    razorpayOrderId: order.razorpay_order_id,
    attemptedAt: creation.createdAt,
  });

  if (action === "claim_creation") {
    if (!allowClaim) return { status: "processing" };
    const claimed = await claimRazorpayOrderCreation(order.id);
    if (!claimed) {
      const latest = await getOrderById(order.id);
      return latest ? resolveRazorpayOrder(latest, receipt, false) : { status: "reconciliation_required" };
    }

    try {
      const providerOrder = await getRazorpayClient().orders.create({
        amount: expected.amount,
        currency: "INR",
        receipt: expected.receipt,
        notes: {
          orderId: expected.orderId,
          orderNumber: order.order_number,
          customerEmail: order.customer_email,
        },
      });
      const validation = validateRazorpayOrderResponse(providerOrder, expected);
      if (!validation.valid) {
        await markRazorpayOrderCreationUnknown(order.id);
        console.error(`[Checkout] Razorpay returned an order with unexpected details for local order ${order.id}; reconciliation is required.`);
        return { status: "reconciliation_required" };
      }
      const persisted = await updateOrderRazorpayId(order.id, validation.razorpayOrderId);
      if (!persisted) {
        await markRazorpayOrderCreationUnknown(order.id);
        console.error(`[Checkout] Razorpay order could not be attached to local order ${order.id}; reconciliation is required.`);
        return { status: "reconciliation_required" };
      }
      return { status: "ready", razorpayOrderId: validation.razorpayOrderId };
    } catch (error: unknown) {
      const failureState = classifyRazorpayOrderCreateFailure(error);
      try {
        if (failureState === "retryable") await markRazorpayOrderCreationRetryable(order.id);
        else await markRazorpayOrderCreationUnknown(order.id);
      } catch (stateError: unknown) {
        console.error(`[Checkout] Could not persist Razorpay creation outcome for local order ${order.id}; the creating claim will require reconciliation.`, stateError);
      }
      const statusCode = error && typeof error === "object" && "statusCode" in error
        ? Number((error as { statusCode: unknown }).statusCode)
        : undefined;
      console.error(`[Checkout] Razorpay order creation ${failureState} for local order ${order.id} (provider status ${Number.isInteger(statusCode) ? statusCode : "unknown"}).`);
      return { status: failureState === "retryable" ? "retryable" : "reconciliation_required" };
    }
  }

  if (action === "wait") return { status: "processing" };

  if (creation.state === "creating") {
    await markStaleRazorpayOrderCreationUnknown(order.id);
    const latestOrder = await getOrderById(order.id);
    if (!latestOrder) return { status: "reconciliation_required" };
    if (latestOrder.razorpay_order_id) return { status: "ready", razorpayOrderId: latestOrder.razorpay_order_id };
    const latestState = await getRazorpayOrderCreationState(order.id);
    if (latestState.state === "creating") return { status: "processing" };
  }

  try {
    const lookup = await findRazorpayOrdersByReceipt(receipt);
    const result = validateRazorpayOrderLookup(lookup, expected);
    if (result.status === "found") {
      const persisted = await updateOrderRazorpayId(order.id, result.razorpayOrderId);
      if (persisted) return { status: "ready", razorpayOrderId: result.razorpayOrderId };
      console.error(`[Checkout] Reconciled Razorpay order could not be attached to local order ${order.id}.`);
    } else if (result.status === "ambiguous") {
      console.error(`[Checkout] Razorpay order receipt lookup is ambiguous for local order ${order.id}: ${result.reason}`);
    }
  } catch (error: unknown) {
    console.error(`[Checkout] Razorpay receipt reconciliation failed for local order ${order.id}.`, error);
  }
  return { status: "reconciliation_required" };
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();
    const validation = CheckoutRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid checkout request", details: validation.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const {
      customerName, customerEmail: submittedEmail, customerPhone,
      address, items, promoCode, idempotencyKey: requestKey,
    } = validation.data;

    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const customerEmail = authData.user?.email ?? submittedEmail;
    const userId = authData.user?.id ?? null;

    const pricingResult = calculateTrustedOrderPricing(items, promoCode);
    if (!pricingResult.success) {
      return NextResponse.json({ error: pricingResult.error }, { status: 400 });
    }
    const pricing = pricingResult.pricing;
    const amountInPaisa = Math.round(pricing.total * 100);
    if (!Number.isSafeInteger(amountInPaisa) || amountInPaisa < 100) {
      return NextResponse.json({ error: "The minimum online payment is ₹1." }, { status: 400 });
    }
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      console.error("Razorpay server credentials are missing.");
      return NextResponse.json({ error: "Online payments are temporarily unavailable." }, { status: 500 });
    }

    const reservedItems = pricing.items.filter((item) => item.fulfillmentType === "stock").map((item) => ({
      productId: item.productId, size: item.size, quantity: item.quantity,
    }));
    const idempotencyKey = scopeCheckoutIdempotencyKey(userId ?? customerEmail, requestKey);
    const paymentMethod = "Razorpay (UPI / Cards / NetBanking)";
    const requestHash = createCheckoutRequestHash({
      userId,
      customerEmail,
      paymentMethod,
      customerName,
      customerPhone,
      address,
      items: pricing.items,
      subtotal: pricing.subtotal,
      shipping: pricing.shipping,
      discount: pricing.discount,
      total: pricing.total,
    });

    // Commit the idempotent local order and stock reservation first. The
    // provider call happens afterward under a durable per-order claim.
    const checkout = await withCheckoutIdempotency({
      idempotencyKey,
      requestHash,
      create: async (db) => {
        const inventory = await checkAndReserveInventory(reservedItems, db);
        if (!inventory.ok) throw new InventoryConflictError(inventory.error || "Insufficient stock.");

        return createPendingOrder({
          orderNumber: generateOrderNumber(),
          customerName,
          customerEmail,
          customerPhone,
          subtotal: pricing.subtotal,
          shipping: pricing.shipping,
          discount: pricing.discount,
          total: pricing.total,
          paymentMethod,
          userId,
          items: pricing.items,
          address,
        }, db);
      },
    });

    if (checkout.status === "conflict") {
      return NextResponse.json({ error: "This checkout key was already used with different order details. Start a new checkout." }, { status: 409 });
    }
    const { order, guestToken } = checkout;

    if (checkout.status === "replayed" &&
        (order.payment_status !== "pending_payment" || order.order_status !== "pending_payment")) {
      return NextResponse.json({ error: "This checkout order is no longer pending. Open My Orders to check its status." }, { status: 409 });
    }
    const resolution = await resolveRazorpayOrder(order, order.order_number);
    if (resolution.status !== "ready") {
      const statusCode = resolution.status === "processing" ? 202 : resolution.status === "retryable" ? 502 : 503;
      return NextResponse.json({
        success: false,
        status: resolution.status,
        orderId: order.id,
        orderNumber: order.order_number,
        error: resolution.status === "processing"
          ? "Payment order creation is still processing. Retry this checkout shortly."
          : resolution.status === "retryable"
            ? "Razorpay rejected order creation. Correct the issue and retry this same checkout."
            : "Payment order creation needs reconciliation. Your order and stock reservation are saved; do not start a new checkout.",
      }, { status: statusCode });
    }

    if (checkout.status === "created") {
      try {
        await logPaymentAudit(order.id, "order_created", {
          orderNumber: order.order_number,
          razorpayOrderId: resolution.razorpayOrderId,
          amount: pricing.total,
        });
      } catch {
        console.error("[Checkout] Order creation audit failed for order:", order.id);
      }
    }

    return NextResponse.json({
      success: true,
      alreadyCreated: checkout.status === "replayed",
      orderId: order.id,
      orderNumber: order.order_number,
      razorpayOrderId: resolution.razorpayOrderId,
      amount: amountInPaisa,
      currency: "INR",
      keyId: RAZORPAY_KEY_ID,
      ...(order.user_id === null ? { guestToken } : {}),
      pricing: {
        subtotal: pricing.subtotal,
        shipping: pricing.shipping,
        discount: pricing.discount,
        total: pricing.total,
      },
      customer: {
        name: order.customer_name,
        email: order.customer_email,
        phone: order.customer_phone,
      },
    }, { status: checkout.status === "created" ? 201 : 200 });
  } catch (error) {
    if (error instanceof InventoryConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    const statusCode = typeof error === "object" && error !== null &&
      "statusCode" in error && error.statusCode === 401 ? 401 : 500;
    console.error("Error in /api/checkout/create-order:", error);
    return NextResponse.json({
      error: statusCode === 401
        ? "Razorpay authentication failed. Check the server credentials."
        : "Unable to initiate payment with Razorpay. Please retry the same checkout.",
    }, { status: statusCode });
  }
}
