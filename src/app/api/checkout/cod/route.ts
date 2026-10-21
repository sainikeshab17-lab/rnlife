
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  CreateCheckoutOrderSchema,
  CheckoutIdempotencyKeySchema,
  calculateTrustedOrderPricing,
  createCheckoutRequestHash,
  generateOrderNumber,
} from "@/services/checkout-service";
import {
  checkAndReserveInventory,
  createPendingOrder,
  getOrderById,
  logPaymentAudit,
  scopeCheckoutIdempotencyKey,
  withCheckoutIdempotency,
} from "@/lib/db/orders";
import { dispatchAllOrderNotifications } from "@/services/notification-service";

export const dynamic = "force-dynamic";

const CheckoutRequestSchema = CreateCheckoutOrderSchema.extend({
  idempotencyKey: CheckoutIdempotencyKeySchema,
});

class InventoryConflictError extends Error {}

export async function POST(req: NextRequest) {
  try {
    // 1. Verify the user's actual Supabase session.
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    const user = data.user;

    if (error || !user || !user.email) {
      return NextResponse.json(
        { success: false, error: "Please sign in before placing your order." },
        { status: 401 }
      );
    }

    // 2. Validate the checkout payload.
    const body: unknown = await req.json();
    const validation = CheckoutRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid checkout details.",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      customerName,
      customerPhone,
      address,
      items,
      promoCode,
      idempotencyKey: requestKey,
    } = validation.data;

    // Always use the authenticated account's email and ID.
    const customerEmail = user.email;

    // 3. Calculate pricing on the server.
    const pricingResult = calculateTrustedOrderPricing(items, promoCode);

    if (!pricingResult.success) {
      return NextResponse.json(
        { success: false, error: pricingResult.error },
        { status: 400 }
      );
    }

    const pricing = pricingResult.pricing;

    // 4. Reserve inventory before creating the order.
    const reservedItems = items.map((item) => ({
      productId: item.productId,
      size: item.size,
      quantity: item.quantity,
    }));

    const idempotencyKey = scopeCheckoutIdempotencyKey(user.id, requestKey);
    const requestHash = createCheckoutRequestHash({
      userId: user.id,
      customerEmail,
      paymentMethod: "Cash on Delivery",
      customerName,
      customerPhone,
      address,
      items: pricing.items,
      subtotal: pricing.subtotal,
      shipping: pricing.shipping,
      discount: pricing.discount,
      total: pricing.total,
    });

    // The lock, reservation and order insert share one transaction. Repeated
    // requests return the original order and cannot reserve stock twice.
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
          paymentMethod: "Cash on Delivery",
          userId: user.id,
          items: pricing.items,
          address,
        }, db);
      },
    });

    if (checkout.status === "conflict") {
      return NextResponse.json({ success: false, error: "This checkout key was already used with different order details. Start a new checkout." }, { status: 409 });
    }
    const { order } = checkout;
    if (checkout.status === "replayed" &&
        (order.payment_status !== "pending_payment" || order.order_status !== "pending_payment")) {
      return NextResponse.json({ success: false, error: "This checkout order is no longer pending. Open My Orders to check its status." }, { status: 409 });
    }

    // 6. Log the COD order. Logging failure should not lose the order.
    if (checkout.status === "created") {
      try {
        await logPaymentAudit(order.id, "cod_order_created", {
        orderNumber: order.order_number,
        amount: pricing.total,
        paymentMethod: "Cash on Delivery",
        });
      } catch {
        console.error("[COD] Audit logging failed for order:", order.id);
      }
    }

    // 7. Dispatch notifications (customer confirmation, admin alert, seller fulfillment)
    try {
      const fullOrder = await getOrderById(order.id);
      if (fullOrder) {
        await dispatchAllOrderNotifications(fullOrder);
      }
    } catch {
      console.error("[COD] Failed to dispatch order notifications for:", order.id);
    }

    // 8. Return the saved order details.
    return NextResponse.json(
      {
        success: true,
        paymentMethod: "COD",
        orderId: order.id,
        orderNumber: order.order_number,
        pricing: {
          subtotal: pricing.subtotal,
          shipping: pricing.shipping,
          discount: pricing.discount,
          total: pricing.total,
        },
        message: "Your COD order has been placed.",
      },
      { status: checkout.status === "created" ? 201 : 200 }
    );
  } catch (error) {
    if (error instanceof InventoryConflictError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }

    // Avoid returning internal database or provider details to clients.
    console.error("[POST /api/checkout/cod] Order creation failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to place your COD order. Please try again.",
      },
      { status: 500 }
    );
  }
}
