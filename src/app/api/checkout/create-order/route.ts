import { NextRequest, NextResponse } from "next/server";
import {
  CreateCheckoutOrderSchema,
  calculateTrustedOrderPricing,
  generateOrderNumber,
} from "@/services/checkout-service";
import {
  checkAndReserveInventory,
  releaseInventoryReservation,
  createPendingOrder,
  updateOrderRazorpayId,
  logPaymentAudit,
} from "@/lib/db/orders";
import { getRazorpayClient, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } from "@/lib/razorpay";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1. Validate payload with Zod
    const validation = CreateCheckoutOrderSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid checkout request",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { customerName, customerEmail, customerPhone, address, items, promoCode, userId } =
      validation.data;

    // 2. Server-side trusted price calculation (₹999 per item)
    const pricingResult = calculateTrustedOrderPricing(items, promoCode);
    if (!pricingResult.success) {
      return NextResponse.json({ error: pricingResult.error }, { status: 400 });
    }

    const pricing = pricingResult.pricing;

    // 3. Check and reserve inventory
    const inventoryCheck = await checkAndReserveInventory(
      items.map((i) => ({ productId: i.productId, size: i.size, quantity: i.quantity }))
    );

    if (!inventoryCheck.ok) {
      return NextResponse.json({ error: inventoryCheck.error }, { status: 400 });
    }

    // 4. Create pending order in database
    const orderNumber = generateOrderNumber();
    let createdOrder: Awaited<ReturnType<typeof createPendingOrder>>;
    try {
      createdOrder = await createPendingOrder({
      orderNumber,
      customerName,
      customerEmail,
      customerPhone,
      subtotal: pricing.subtotal,
      shipping: pricing.shipping,
      discount: pricing.discount,
      total: pricing.total,
      paymentMethod: "Razorpay (UPI / Cards / NetBanking)",
      userId: userId || null,
      items: pricing.items,
        address,
      });
    } catch (error) {
      await releaseInventoryReservation(
        items.map((i) => ({ productId: i.productId, size: i.size, quantity: i.quantity }))
      );
      throw error;
    }
    const { order, guestToken } = createdOrder;

    // 5. Create Razorpay order on server
    let razorpayOrderId: string;
    const amountInPaisa = Math.round(pricing.total * 100);

    const hasRealRazorpayKeys =
      RAZORPAY_KEY_ID !== "rzp_test_placeholder_key" &&
      RAZORPAY_KEY_SECRET !== "rzp_test_placeholder_secret";

    if (hasRealRazorpayKeys) {
      try {
        const rzp = getRazorpayClient();
        const rzpOrder = await rzp.orders.create({
          amount: amountInPaisa,
          currency: "INR",
          receipt: order.order_number,
          notes: {
            orderId: order.id,
            orderNumber: order.order_number,
            customerEmail: order.customer_email,
          },
        });
        razorpayOrderId = rzpOrder.id;
      } catch (err: any) {
        // Release reserved inventory if Razorpay order generation fails
        await releaseInventoryReservation(
          items.map((i) => ({ productId: i.productId, size: i.size, quantity: i.quantity }))
        );
        await logPaymentAudit(order.id, "razorpay_order_creation_failed", {
          error: err?.message || "Razorpay API error",
        });

        console.error("Razorpay orders.create failed:", err);
        return NextResponse.json(
          {
            error: "Unable to initiate payment with Razorpay. Please check credentials or try again.",
            details: err?.error?.description || err?.message,
          },
          { status: 502 }
        );
      }
    } else {
      // Local development test mode with placeholder keys
      razorpayOrderId = `order_test_${randomUUID().replace(/-/g, "").slice(0, 14)}`;
      console.info(
        `[Razorpay Dev Mode] Generated test order ID ${razorpayOrderId} for amount ₹${pricing.total}. Configure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env for live test sandbox.`
      );
    }

    // Update order with Razorpay order ID
    await updateOrderRazorpayId(order.id, razorpayOrderId);

    await logPaymentAudit(order.id, "order_created", {
      orderNumber: order.order_number,
      razorpayOrderId,
      amount: pricing.total,
    });

    // 6. Return minimal public checkout details to client
    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.order_number,
      razorpayOrderId,
      amount: amountInPaisa,
      currency: "INR",
      keyId: RAZORPAY_KEY_ID,
      guestToken,
      isTestMode: !hasRealRazorpayKeys,
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
    });
  } catch (err: any) {
    console.error("Error in /api/checkout/create-order:", err);
    return NextResponse.json(
      { error: "Internal server error occurred while creating order" },
      { status: 500 }
    );
  }
}
