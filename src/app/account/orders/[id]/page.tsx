import React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, CheckCircle2, Clock, Printer, ShieldCheck, Truck } from "lucide-react";
import { AccountLayout } from "@/components/layout/AccountLayout";
import { DEMO_ORDERS } from "@/data/mock-data";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatINR } from "@/lib/utils";

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  return DEMO_ORDERS.map((o) => ({
    id: o.id,
  }));
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params;
  const order = DEMO_ORDERS.find((o) => o.id === id) || DEMO_ORDERS[0];

  if (!order) {
    notFound();
  }

  return (
    <AccountLayout
      title={`Order #${order.orderNumber}`}
      subtitle={`Placed on ${new Date(order.createdAt).toLocaleDateString("en-IN", {
        dateStyle: "full",
      })}`}
    >
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <Link
            href="/account/orders"
            className="text-xs uppercase tracking-wider font-bold text-neutral-600 hover:text-black flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to All Orders
          </Link>
          <div className="flex items-center gap-3">
            <StatusBadge status={order.orderStatus} />
          </div>
        </div>

        {/* Visual Timeline Tracker */}
        <div className="border border-neutral-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
            <h3 className="text-xs font-bold uppercase tracking-wider text-black flex items-center gap-2">
              <Truck className="w-4 h-4" /> Real-Time Air Courier Dispatch Status
            </h3>
            <span className="text-xs font-mono text-neutral-500">
              AWB: {order.trackingNumber}
            </span>
          </div>

          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-neutral-200">
            {order.timeline.map((step, idx) => (
              <div key={idx} className="relative flex items-start gap-4">
                <span
                  className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-white ${
                    step.completed
                      ? "bg-black"
                      : step.current
                      ? "bg-[#B8FF3B] text-black ring-2 ring-black"
                      : "bg-neutral-200"
                  }`}
                >
                  {step.completed && <CheckCircle2 className="w-3.5 h-3.5" />}
                  {step.current && <span className="w-2 h-2 rounded-full bg-black animate-ping" />}
                </span>

                <div className="flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={`text-xs font-bold uppercase tracking-wider ${step.completed ? "text-black" : "text-neutral-500"}`}>
                      {step.title}
                    </p>
                    <span className="text-[11px] text-neutral-400 font-mono">
                      {step.timestamp}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600 mt-0.5">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Garments Table & Delivery Summary */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Garments list (7 cols) */}
          <div className="md:col-span-7 border border-neutral-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-black pb-3 border-b border-neutral-200">
              Ordered Items ({order.items.length})
            </h3>

            <div className="divide-y divide-neutral-100">
              {order.items.map((item) => (
                <div key={item.id} className="py-3 flex gap-4 items-center">
                  <div className="relative w-16 h-20 bg-neutral-100 shrink-0 overflow-hidden">
                    <Image src={item.image} alt={item.productName} fill className="object-cover object-top" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/products/${item.productSlug}`}
                      className="text-xs font-bold uppercase tracking-tight text-neutral-900 hover:underline truncate block"
                    >
                      {item.productName}
                    </Link>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-neutral-500">
                      <span>Size: {item.size}</span>
                      <span>•</span>
                      <span>Color: {item.color}</span>
                      <span>•</span>
                      <span>Qty: {item.quantity}</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-black">
                    {formatINR(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            {/* Price Breakdown */}
            <div className="pt-4 border-t border-neutral-200 space-y-1.5 text-xs text-neutral-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-semibold text-black">{formatINR(order.subtotal)}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount</span>
                  <span>-{formatINR(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Shipping</span>
                <span className="font-semibold text-black">
                  {order.shipping === 0 ? "FREE" : formatINR(order.shipping)}
                </span>
              </div>
              <div className="flex justify-between text-sm font-black text-black pt-2 border-t border-neutral-200">
                <span>Total Paid</span>
                <span>{formatINR(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Delivery & Payment Details (5 cols) */}
          <div className="md:col-span-5 space-y-6">
            <div className="border border-neutral-200 bg-white p-6 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-black pb-2 border-b border-neutral-200">
                Delivery Address
              </h3>
              <div className="text-xs text-neutral-700 space-y-1">
                <p className="font-bold text-black">{order.deliveryAddress.fullName}</p>
                <p className="font-mono text-neutral-500">{order.deliveryAddress.phone}</p>
                <p>{order.deliveryAddress.addressLine1}</p>
                {order.deliveryAddress.addressLine2 && <p>{order.deliveryAddress.addressLine2}</p>}
                <p>{order.deliveryAddress.city}, {order.deliveryAddress.state} – {order.deliveryAddress.pinCode}</p>
              </div>
            </div>

            <div className="border border-neutral-200 bg-white p-6 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-black pb-2 border-b border-neutral-200">
                Payment Details
              </h3>
              <div className="text-xs text-neutral-700 space-y-1">
                <p className="font-medium">
                  Method: <strong className="text-black">{order.paymentMethod}</strong>
                </p>
                <p className="font-medium">
                  Status: <strong className="text-emerald-700">{order.paymentStatus}</strong>
                </p>
                <div className="pt-2 flex items-center gap-1.5 text-[11px] text-neutral-500">
                  <ShieldCheck className="w-3.5 h-3.5 text-neutral-700" />
                  <span>Encrypted Razorpay Gateway Verification</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AccountLayout>
  );
}
