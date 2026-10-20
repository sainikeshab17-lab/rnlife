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
    const amountInPaisa = Math.round(pricing.total * 100);

    if (!Number.isSafeInteger(amountInPaisa) || amountInPaisa < 100) {
      return NextResponse.json(
        { error: "The minimum online payment is ₹1." },
        { status: 400 }
      );
    }

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      console.error("Razorpay server credentials are missing.");
      return NextResponse.json(
        { error: "Online payments are temporarily unavailable." },
        { status: 500 }
      );
    }

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
    } catch (error: unknown) {
      await releaseInventoryReservation(
        items.map((i) => ({ productId: i.productId, size: i.size, quantity: i.quantity }))
      );
      await logPaymentAudit(order.id, "razorpay_order_creation_failed", {
        error: error instanceof Error ? error.message : "Razorpay API error",
      });

      const statusCode =
        typeof error === "object" &&
        error !== null &&
        "statusCode" in error &&
        error.statusCode === 401
          ? 401
          : 500;

      console.error("Razorpay orders.create failed:", error);
      return NextResponse.json(
        {
          error:
            statusCode === 401
              ? "Razorpay authentication failed. Check the server credentials."
              : "Unable to initiate payment with Razorpay. Please try again.",
        },
        { status: statusCode }
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
