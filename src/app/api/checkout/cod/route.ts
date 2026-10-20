
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  CreateCheckoutOrderSchema,
  calculateTrustedOrderPricing,
  generateOrderNumber,
} from "@/services/checkout-service";
import {
  checkAndReserveInventory,
  releaseInventoryReservation,
  createPendingOrder,
  getOrderById,
  logPaymentAudit,
} from "@/lib/db/orders";
import { dispatchAllOrderNotifications } from "@/services/notification-service";

export const dynamic = "force-dynamic";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[char];
  });
}

export async function POST(req: NextRequest) {
  let reservedItems: Array<{
    productId: string;
    size: string;
    quantity: number;
  }> = [];

  let reservationHeld = false;

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
    const validation = CreateCheckoutOrderSchema.safeParse(body);

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
    reservedItems = items.map((item) => ({
      productId: item.productId,
      size: item.size,
      quantity: item.quantity,
    }));

    const inventory = await checkAndReserveInventory(reservedItems);

    if (!inventory.ok) {
      return NextResponse.json(
        {
          success: false,
          error: inventory.error || "Insufficient stock.",
        },
        { status: 409 }
      );
    }

    reservationHeld = true;

    // 5. Create the order. COD does not create a Razorpay order.
    const { order, guestToken } = await createPendingOrder({
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
    });

    // The order now exists; do not release its reservation because
    // an audit or notification operation subsequently fails.
    reservationHeld = false;

    // 6. Log the COD order. Logging failure should not lose the order.
    try {
      await logPaymentAudit(order.id, "cod_order_created", {
        orderNumber: order.order_number,
        amount: pricing.total,
        paymentMethod: "Cash on Delivery",
      });
    } catch {
      console.error("[COD] Audit logging failed for order:", order.id);
    }

    // 7. Dispatch notifications (customer confirmation, admin alert, seller fulfillment)
    try {
      const fullOrder = await getOrderById(order.id);
      if (fullOrder) {
        dispatchAllOrderNotifications(fullOrder).catch((err) => {
          console.error("[COD] Notification dispatch error:", err);
        });
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
        guestToken,
        pricing: {
          subtotal: pricing.subtotal,
          shipping: pricing.shipping,
          discount: pricing.discount,
          total: pricing.total,
        },
        message: "Your COD order has been placed.",
      },
      { status: 201 }
    );
  } catch (error) {
    // Only release stock if an order was not successfully created.
    if (reservationHeld && reservedItems.length > 0) {
      try {
        await releaseInventoryReservation(reservedItems);
      } catch {
        console.error("[COD] Inventory reservation release failed.");
      }
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
