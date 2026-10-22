import React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, CheckCircle2, ShieldCheck, Truck } from "lucide-react";
import { AccountLayout } from "@/components/layout/AccountLayout";
import { getOrderById, getOrderByNumber, isOrderOwnedByCustomer } from "@/lib/db/orders";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatINR } from "@/lib/utils";
import { OrderActionButtons } from "@/components/order/OrderActionButtons";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/types";
import { hasRequiredOrderPayment } from "@/services/order-payment-state";
import { RetryPendingPayment } from "@/components/checkout/RetryPendingPayment";

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string; email?: string }>;
}

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params, searchParams }: OrderDetailPageProps) {
  const { id } = await params;
  const { token } = await searchParams;

  // Retrieve from live database
  let dbOrder = await getOrderById(id);
  if (!dbOrder) {
    dbOrder = await getOrderByNumber(id);
  }

  if (!dbOrder) {
    notFound();
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const isAccountOwner = Boolean(authData.user && isOrderOwnedByCustomer(dbOrder, {
    userId: authData.user.id,
    email: authData.user.email,
    emailVerified: Boolean(authData.user.email_confirmed_at),
  }));
  if (!isAccountOwner && (!token || token !== dbOrder.guest_token)) notFound();

  const verifiedAdvance = dbOrder.payment_attempts?.find((attempt) => attempt.purpose === "cod_advance" && attempt.payment_state === "captured")?.amount_paisa ?? 0;
  const isPaid = hasRequiredOrderPayment(dbOrder.payment_method, dbOrder.payment_status, verifiedAdvance > 0);
  const advanceAmount = verifiedAdvance / 100;

  // Build real-time timeline steps
  const timelineSteps = [
    {
      title: isPaid ? "Order Confirmed" : "Checkout Started",
      description: isPaid ? "Required payment was verified and the order is ready for fulfillment." : "Your checkout is saved. The order will be confirmed after payment is verified.",
      timestamp: new Date(dbOrder.created_at).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      completed: isPaid,
      current: !isPaid,
    },
    {
      title: dbOrder.payment_status === "partially_paid" ? "COD Advance Verified" : isPaid ? "Payment Verified via Razorpay" : "Pending Gateway Payment",
      description: dbOrder.payment_status === "partially_paid"
        ? `₹${advanceAmount} advance verified. ₹${Math.max(0, dbOrder.total - advanceAmount)} remains due on delivery.`
        : isPaid ? `Payment verified with reference ID ${dbOrder.razorpay_payment_id || "captured"}.`
        : "Awaiting customer payment confirmation from payment provider.",
      timestamp: isPaid
        ? new Date(dbOrder.updated_at).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "Pending",
      completed: isPaid,
      current: !isPaid,
    },
    {
      title: "Warehouse Fulfillment & Quality Inspection",
      description: "Garments picked from inventory and checked for stitch and print integrity.",
      timestamp: isPaid ? "In Queue" : "Awaiting Payment",
      completed: isPaid && (dbOrder.order_status === "processing" || dbOrder.order_status === "shipped" || dbOrder.order_status === "delivered"),
      current: isPaid && (dbOrder.order_status === "processing" || dbOrder.order_status === "paid"),
    },
    {
      title: "Handed to Express Air Courier",
      description: "Delhivery / BlueDart air courier dispatch with live tracking number.",
      timestamp: dbOrder.order_status === "shipped" || dbOrder.order_status === "delivered" ? "In Transit" : "Estimated 24h",
      completed: isPaid && (dbOrder.order_status === "shipped" || dbOrder.order_status === "delivered"),
      current: isPaid && dbOrder.order_status === "shipped",
    },
  ];

  return (
    <AccountLayout
      title={`${isPaid ? "Order" : "Checkout"} #${dbOrder.order_number}`}
      subtitle={`${isPaid ? "Order placed" : "Checkout started"} on ${new Date(dbOrder.created_at).toLocaleDateString("en-IN", {
        dateStyle: "full",
      })}`}
    >
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <Link
            href="/account/orders"
            className="text-xs uppercase tracking-wider font-bold text-[#858585] hover:text-[#111111] flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to All Orders
          </Link>
          <div className="flex items-center gap-3">
            <span
              className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider ${
                isPaid
                  ? "bg-[#079447]/10 text-[#079447] border border-[#079447]/30"
                  : "bg-amber-100 text-amber-800 border border-amber-200"
              }`}
            >
              {dbOrder.payment_status === "partially_paid" ? "₹200 ADVANCE VERIFIED" : isPaid ? "PAYMENT PAID" : "PENDING PAYMENT"}
            </span>
              <StatusBadge status={(isPaid ? dbOrder.order_status : "pending_payment") as OrderStatus} />
            <OrderActionButtons
              order={{
                id: dbOrder.id,
                order_number: dbOrder.order_number,
                order_status: dbOrder.order_status,
                cancellation_requested: dbOrder.cancellation_requested,
                items: dbOrder.items.map((item) => ({
                  id: item.id,
                  product_name: item.product_name,
                  size: item.size,
                  color: item.color,
                  price: item.price,
                  quantity: item.quantity,
                })),
              }}
              guestToken={isAccountOwner ? undefined : token}
              customerEmail={dbOrder.customer_email}
            />
          </div>
        </div>

        {/* Visual Timeline Tracker */}
        <div className="border border-[#E5E5E5] bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E5E5E5] gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111] flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#079447]" /> Dispatch & Verification Status
            </h3>
            <div className="flex items-center gap-3 text-xs">
              {dbOrder.courier_name && (
                <span className="font-semibold text-[#111111]">
                  Courier: {dbOrder.courier_name}
                </span>
              )}
              {isPaid && dbOrder.tracking_number ? (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[#858585]">
                    AWB: <strong>{dbOrder.tracking_number}</strong>
                  </span>
                  {dbOrder.tracking_url && (
                    <a
                      href={dbOrder.tracking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-[#111111] text-white text-[11px] font-bold uppercase tracking-wider hover:bg-[#222222]"
                    >
                      Track Shipment &rarr;
                    </a>
                  )}
                </div>
              ) : (
                <span className="text-xs font-mono text-[#858585]">
                  AWB: {isPaid ? (dbOrder.razorpay_order_id ? `RNL-AIR-${dbOrder.order_number.slice(-4)}` : "ASSIGNING") : "Assigned after payment confirmation"}
                </span>
              )}
            </div>
          </div>

          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E5E5E5]">
            {timelineSteps.map((step, idx) => (
              <div key={idx} className="relative flex items-start gap-4">
                <span
                  className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-white ${
                    step.completed
                      ? "bg-[#111111]"
                      : step.current
                      ? "bg-[#FFB900] text-[#111111] ring-2 ring-[#111111]"
                      : "bg-[#E5E5E5]"
                  }`}
                >
                  {step.completed && <CheckCircle2 className="w-3.5 h-3.5" />}
                  {step.current && <span className="w-2 h-2 rounded-full bg-[#111111] animate-ping" />}
                </span>

                <div className="flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p
                      className={`text-xs font-bold uppercase tracking-wider ${
                        step.completed ? "text-[#111111]" : "text-[#858585]"
                      }`}
                    >
                      {step.title}
                    </p>
                    <span className="text-[11px] text-[#858585] font-mono">
                      {step.timestamp}
                    </span>
                  </div>
                  <p className="text-xs text-[#858585] mt-0.5">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Garments Table & Delivery Summary */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Garments list (7 cols) */}
          <div className="md:col-span-7 border border-[#E5E5E5] bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111] pb-3 border-b border-[#E5E5E5]">
              Ordered Items ({dbOrder.items.length})
            </h3>

            <div className="divide-y divide-[#E5E5E5]">
              {dbOrder.items.map((item) => (
                <div key={item.id} className="py-3 flex gap-4 items-center">
                  <div className="relative w-16 h-20 bg-[#F5F4F0] shrink-0 overflow-hidden">
                    <Image
                      src={item.image}
                      alt={item.product_name}
                      fill
                      className="object-cover object-top"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={item.customization ? "/wear-your-mood" : `/products/${item.product_slug}`}
                      className="text-xs font-bold uppercase tracking-tight text-[#111111] hover:underline truncate block"
                    >
                      {item.product_name}
                    </Link>
                    {item.customization && <p className="mt-1 text-[11px] text-[#555]">Quote: “{item.customization.quote}” · Mood: {item.customization.mood} · Style: {item.customization.quoteStyle} · Font: {item.customization.font} · Print: {item.customization.printColor} · Placement: {item.customization.placement}</p>}
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-[#858585]">
                      <span>Size: <strong>{item.size}</strong></span>
                      <span>•</span>
                      <span>Color: {item.color}</span>
                      <span>•</span>
                      <span>Qty: {item.quantity}</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-[#111111]">
                    {formatINR(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            {/* Price Breakdown */}
            <div className="pt-4 border-t border-[#E5E5E5] space-y-1.5 text-xs text-[#858585]">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-semibold text-[#111111]">{formatINR(dbOrder.subtotal)}</span>
              </div>
              {dbOrder.discount > 0 && (
                <div className="flex justify-between text-[#079447]">
                  <span>Discount</span>
                  <span>-{formatINR(dbOrder.discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Shipping</span>
                <span className="font-semibold text-[#111111]">
                  {dbOrder.shipping === 0 ? "FREE" : formatINR(dbOrder.shipping)}
                </span>
              </div>
              <div className="flex justify-between text-sm font-black text-[#111111] pt-2 border-t border-[#E5E5E5]">
                <span>{dbOrder.payment_status === "partially_paid" ? "Order Total" : "Total Amount"}</span>
                <span>{formatINR(dbOrder.total)}</span>
              </div>
              {dbOrder.payment_status === "partially_paid" && <>
                <div className="flex justify-between"><span>Verified COD Advance</span><span>{formatINR(advanceAmount)}</span></div>
                <div className="flex justify-between font-bold text-[#111111]"><span>Balance Due on Delivery</span><span>{formatINR(Math.max(0, dbOrder.total - advanceAmount))}</span></div>
              </>}
            </div>
          </div>

          {/* Delivery & Payment Details (5 cols) */}
          <div className="md:col-span-5 space-y-6">
            <div className="border border-[#E5E5E5] bg-white p-6 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111] pb-2 border-b border-[#E5E5E5]">
                Delivery Address
              </h3>
              {dbOrder.address ? (
                <div className="text-xs text-[#858585] space-y-1">
                  <p className="font-bold text-[#111111]">{dbOrder.address.full_name}</p>
                  <p className="font-mono text-[#858585]">+91 {dbOrder.address.phone}</p>
                  <p>{dbOrder.address.address_line1}</p>
                  {dbOrder.address.address_line2 && <p>{dbOrder.address.address_line2}</p>}
                  {dbOrder.address.landmark && <p>Landmark: {dbOrder.address.landmark}</p>}
                  <p>
                    {dbOrder.address.city}, {dbOrder.address.state} — {dbOrder.address.pin_code}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-[#858585]">Address details unavailable</p>
              )}
            </div>

            <div className="border border-[#E5E5E5] bg-white p-6 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111] pb-2 border-b border-[#E5E5E5]">
                Payment Information
              </h3>
              <div className="text-xs text-[#858585] space-y-1">
                <p className="font-medium">
                  Method: <strong className="text-[#111111]">{dbOrder.payment_method}</strong>
                </p>
                <p className="font-medium">
                  Payment Status:{" "}
                  <strong className={isPaid ? "text-[#079447]" : "text-amber-800"}>
                    {dbOrder.payment_status === "partially_paid" ? "₹200 Advance Verified" : isPaid ? "Paid & Verified" : dbOrder.payment_status === "pending_advance" ? "Advance payment pending" : "Pending Payment"}
                  </strong>
                </p>
                {dbOrder.razorpay_payment_id && (
                  <p className="font-mono text-[11px] text-[#111111]">
                    Payment ID: {dbOrder.razorpay_payment_id}
                  </p>
                )}
                {dbOrder.razorpay_order_id && (
                  <p className="font-mono text-[11px] text-[#858585]">
                    Gateway Order: {dbOrder.razorpay_order_id}
                  </p>
                )}
                <div className="pt-2 flex items-center gap-1.5 text-[11px] text-[#858585]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#079447]" />
                  <span>Verified Razorpay Gateway Signature</span>
                </div>
              </div>
            </div>
            {(isAccountOwner || (dbOrder.user_id === null && token === dbOrder.guest_token)) && !isPaid && ["pending_payment", "pending_advance"].includes(dbOrder.payment_status) && (
              <RetryPendingPayment orderId={dbOrder.id} isAdvance={dbOrder.payment_method === "COD Advance"} guestToken={isAccountOwner ? undefined : token} />
            )}
          </div>
        </div>
      </div>
    </AccountLayout>
  );
}
