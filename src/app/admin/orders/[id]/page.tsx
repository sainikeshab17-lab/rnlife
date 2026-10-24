"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Truck,
  Package,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Loader2,
  DollarSign,
  MapPin,
  Calendar,
  Save,
} from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { formatINR } from "@/lib/utils";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  getValidNextStatuses,
  requiresRefundForOrder,
} from "@/lib/order-status-machine";
import { OrderWithDetails } from "@/lib/db/index";

export default function AdminOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<OrderWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status transition form state
  const [selectedNextStatus, setSelectedNextStatus] = useState<string>("");
  const [statusNote, setStatusNote] = useState<string>("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Tracking form state
  const [courierName, setCourierName] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [updatingTracking, setUpdatingTracking] = useState(false);
  const [shiprocketEnabled, setShiprocketEnabled] = useState(false);
  const [shippingBusy, setShippingBusy] = useState(false);
  const [shippingMessage, setShippingMessage] = useState<string | null>(null);

  const fetchOrderDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`);
      if (!res.ok) throw new Error("Order not found or access denied.");
      const data = await res.json();
      setOrder(data.order);
      setShiprocketEnabled(data.shiprocketEnabled === true);
      setCourierName(data.order.courier_name || "");
      setTrackingNumber(data.order.tracking_number || "");
      setTrackingUrl(data.order.tracking_url || "");
    } catch (err: any) {
      setError(err?.message || "Failed to load order.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) fetchOrderDetail();
  }, [orderId]);

  const handleStatusTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNextStatus) return;

    const willNeedRefund = order ? requiresRefundForOrder(order.order_status, selectedNextStatus, order.payment_method, order.payment_status) : false;
    if (
      willNeedRefund &&
      !window.confirm(
        `CAUTION: Cancelling this order requires a refund of the amount actually collected. Are you sure you want to proceed?`
      )
    ) {
      return;
    }

    setUpdatingStatus(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: selectedNextStatus, note: statusNote }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatusMessage({ type: "error", text: data.error || "Transition failed." });
        return;
      }

      setStatusMessage({ type: "success", text: data.message || "Status updated successfully." });
      setSelectedNextStatus("");
      setStatusNote("");
      await fetchOrderDetail();
    } catch {
      setStatusMessage({ type: "error", text: "Network error while updating status." });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleTrackingUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingTracking(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courier_name: courierName,
          tracking_number: trackingNumber,
          tracking_url: trackingUrl,
        }),
      });

      if (!res.ok) throw new Error("Failed to update tracking");
      await fetchOrderDetail();
      alert("Courier tracking updated successfully.");
    } catch (err: any) {
      alert(err?.message || "Failed to update tracking");
    } finally {
      setUpdatingTracking(false);
    }
  };

  const runShiprocketAction = async (action: "create" | "assign_awb" | "pickup" | "label") => {
    const orderReference = order?.order_number || orderId;
    const prompt = action === "create" ? `Create a LIVE Shiprocket provider order for RIGHTNOWLIFE order ${orderReference}? This changes the Shiprocket account but does not assign a courier or schedule pickup.` :
      action === "assign_awb" ? `Assign a courier and AWB to the live Shiprocket shipment for order ${orderReference}?` :
      action === "pickup" ? `Request a REAL courier pickup for order ${orderReference}? This can trigger fulfillment.` :
        `Generate a label through Shiprocket for order ${orderReference}? This calls the live provider; it does not schedule pickup.`;
    if (!window.confirm(prompt)) return;
    setShippingBusy(true); setShippingMessage(null);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/shipping`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, confirmed: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Shiprocket operation failed.");
      if (action === "label" && data.labelUrl) window.open(data.labelUrl, "_blank", "noopener,noreferrer");
      setShippingMessage(action === "create" ? "Shiprocket order created. Assign its AWB as a separate step." :
        action === "assign_awb" ? "AWB assigned." :
        action === "pickup" ? "Pickup request submitted." : "Label generated.");
      await fetchOrderDetail();
    } catch (error) { setShippingMessage(error instanceof Error ? error.message : "Shiprocket operation failed."); }
    finally { setShippingBusy(false); }
  };

  const validNextStatuses = order ? getValidNextStatuses(order.order_status) : [];
  const shiprocketCod = order ? ["COD", "Cash on Delivery"].includes(order.payment_method) : false;
  const shiprocketOrderEligible = !!order &&
    !["cancelled", "refunded", "refund_pending", "payment_failed", "delivered", "shipped"].includes(order.order_status) &&
    (shiprocketCod ? ["pending_payment", "paid"].includes(order.payment_status) : order.payment_status === "paid");

  return (
    <AdminLayout
      title={order ? `Order #${order.order_number}` : "Order Details"}
      subtitle="Complete order audit, line-item pricing integrity, fulfillment lifecycle, and payment credentials verification."
      actions={
        <Link
          href="/admin/orders"
          className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-xs font-bold uppercase tracking-wider text-neutral-700 flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Orders</span>
        </Link>
      }
    >
      {loading ? (
        <div className="bg-white border border-neutral-200 p-12 text-center shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin text-neutral-400 mx-auto mb-3" />
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            Loading order details from database...
          </p>
        </div>
      ) : error || !order ? (
        <div className="bg-red-50 border border-red-200 p-6 text-red-700 text-xs shadow-sm">
          <p className="font-bold uppercase tracking-wider mb-1">Failed to load order</p>
          <p>{error || "Order not found"}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-neutral-200 p-4 shadow-sm space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">
                Order Status
              </span>
              <div className="pt-1">
                <span
                  className={`inline-block px-3 py-1 text-xs uppercase font-bold ${
                    STATUS_COLORS[order.order_status] || "bg-neutral-100 text-neutral-800"
                  }`}
                >
                  {STATUS_LABELS[order.order_status] || order.order_status}
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 pt-1">
                Placed on {new Date(order.created_at).toLocaleString("en-IN")}
              </p>
            </div>

            <div className="bg-white border border-neutral-200 p-4 shadow-sm space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">
                Payment Verification
              </span>
              <div className="pt-1">
                <span
                  className={`inline-block px-3 py-1 text-xs uppercase font-bold ${
                    order.payment_status === "paid" || order.payment_status === "partially_paid"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {order.payment_status.toUpperCase()}
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 pt-1">
                Method: {order.payment_method}
              </p>
              {order.payment_status === "partially_paid" && <p className="text-[11px] text-emerald-700 pt-1 font-semibold">
                Advance received: {formatINR((order.payment_attempts?.find((attempt) => attempt.purpose === "cod_advance" && attempt.payment_state === "captured")?.amount_paisa ?? 0) / 100)} · Balance due on delivery: {formatINR(order.total - ((order.payment_attempts?.find((attempt) => attempt.purpose === "cod_advance" && attempt.payment_state === "captured")?.amount_paisa ?? 0) / 100))}
              </p>}
            </div>

            <div className="bg-white border border-neutral-200 p-4 shadow-sm space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">
                Order Value (INR)
              </span>
              <p className="text-xl font-black text-black font-mono pt-1">
                {formatINR(order.total)}
              </p>
              <p className="text-[11px] text-neutral-500">
                Subtotal: {formatINR(order.subtotal)} | Shipping: {formatINR(order.shipping)}
              </p>
            </div>
          </div>

          {/* Refund Banner if Refund Pending */}
          {order.refund_status === "refund_pending" && order.payment_method !== "COD Advance" && (
            <div className="bg-orange-50 border border-orange-200 p-4 shadow-sm flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-orange-900 space-y-1">
                <p className="font-bold uppercase tracking-wider">
                  Refund Pending — Action Required
                </p>
                <p>
                  This order was cancelled after payment was confirmed. A refund of{" "}
                  <strong>{formatINR(order.total)}</strong> must be issued to the customer.
                </p>
                <p className="text-[11px] text-orange-800">
                  Razorpay Payment ID: <code className="font-mono font-bold">{order.razorpay_payment_id || "N/A"}</code>
                </p>
              </div>
            </div>
          )}

          {/* Two Columns: Left = Line items & Address; Right = Transition & Tracking */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 Columns */}
            <div className="lg:col-span-7 space-y-6">
              {/* Line Items */}
              <div className="bg-white border border-neutral-200 p-5 shadow-sm space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-black pb-2 border-b border-neutral-200">
                  Purchased Items ({order.items.length})
                </h3>
                <div className="divide-y divide-neutral-100">
                  {order.items.map((item) => (
                    <div key={item.id} className="py-3 flex items-center gap-3">
                      <div className="w-14 h-14 relative bg-neutral-100 border border-neutral-200 flex-shrink-0">
                        {item.image && (
                          <Image
                            src={item.image}
                            alt={item.product_name}
                            fill
                            className="object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold uppercase text-neutral-900 truncate">
                          {item.product_name}
                        </p>
                        <p className="text-[11px] text-neutral-500">
                          Size: <strong>{item.size}</strong> • Color: {item.color} • Qty: {item.quantity}
                        </p>
                        <span className="text-[10px] text-emerald-700 font-mono font-bold block">
                          Locked Unit Price: {formatINR(item.price)}
                        </span>
                        {item.customization && <div className="mt-1 text-[11px] text-sky-800 space-y-0.5">
                          <p>Custom quote: “{item.customization.quote}” · Mood: {item.customization.mood} · Style: {item.customization.quoteStyle}</p>
                          <p>Font: {item.customization.font} · Print: {item.customization.printColor} · Placement: {item.customization.placement} · {item.fulfillment_type === "made_to_order" ? "Made to order (no stock reservation)" : ""}</p>
                        </div>}
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-xs text-black block">
                          {formatINR(item.price * item.quantity)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-neutral-200 space-y-1.5 text-xs text-neutral-600">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-mono">{formatINR(order.subtotal)}</span>
                  </div>
                  {order.discount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Promotional Discount:</span>
                      <span className="font-mono">-{formatINR(order.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Shipping Charges:</span>
                    <span className="font-mono">{formatINR(order.shipping)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-black pt-2 border-t border-neutral-200 text-sm">
                    <span>Total Amount:</span>
                    <span className="font-mono">{formatINR(order.total)}</span>
                  </div>
                </div>
              </div>

              {/* Delivery Address */}
              <div className="bg-white border border-neutral-200 p-5 shadow-sm space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-black pb-2 border-b border-neutral-200 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Delivery Address</span>
                </h3>
                {order.address ? (
                  <div className="text-xs text-neutral-700 space-y-0.5">
                    <p className="font-bold text-neutral-900">{order.address.full_name}</p>
                    <p>{order.address.address_line1}</p>
                    {order.address.address_line2 && <p>{order.address.address_line2}</p>}
                    <p>
                      {order.address.city}, {order.address.state} —{" "}
                      <strong className="font-mono">{order.address.pin_code}</strong>
                    </p>
                    <p className="text-neutral-500">{order.address.country}</p>
                    <p className="text-neutral-500 font-mono pt-1">Phone: {order.address.phone}</p>
                  </div>
                ) : (
                  <p className="text-xs text-neutral-400 italic">No address recorded</p>
                )}
              </div>

              {/* Status History Audit */}
              <div className="bg-white border border-neutral-200 p-5 shadow-sm space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-black pb-2 border-b border-neutral-200">
                  Lifecycle Audit History
                </h3>
                {order.history && order.history.length > 0 ? (
                  <div className="space-y-3">
                    {order.history.map((h) => (
                      <div key={h.id} className="text-xs border-l-2 border-neutral-300 pl-3 py-0.5 space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold uppercase text-neutral-800">
                            {h.from_status ? `${h.from_status} → ` : ""}
                            {h.to_status}
                          </span>
                          <span className="text-[10px] text-neutral-400 font-mono">
                            {new Date(h.created_at).toLocaleString("en-IN")}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-500">By: {h.actor}</p>
                        {h.note && <p className="text-[11px] text-neutral-700 italic font-mono">&ldquo;{h.note}&rdquo;</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-400 italic">No status transitions recorded yet.</p>
                )}
              </div>
            </div>

            {/* Right 5 Columns: Status Transition Form & Courier Tracking */}
            <div className="lg:col-span-5 space-y-6">
              {/* Order Status Transition Action Box */}
              <div className="bg-white border border-neutral-200 p-5 shadow-sm space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-black pb-2 border-b border-neutral-200">
                  Fulfillment Status Control
                </h3>

                {statusMessage && (
                  <div
                    className={`p-3 text-xs border ${
                      statusMessage.type === "success"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                        : "bg-red-50 border-red-200 text-red-800"
                    }`}
                  >
                    {statusMessage.text}
                  </div>
                )}

                {validNextStatuses.length === 0 ? (
                  <div className="p-3 bg-neutral-50 border border-neutral-200 text-xs text-neutral-500 text-center">
                    This order is in a terminal state (<strong>{order.order_status}</strong>). No further transitions allowed.
                  </div>
                ) : (
                  <form onSubmit={handleStatusTransition} className="space-y-3">
                    <div>
                      <label className="block text-[11px] uppercase font-bold text-neutral-700 tracking-wider mb-1">
                        Select Next Valid Status:
                      </label>
                      <select
                        value={selectedNextStatus}
                        onChange={(e) => setSelectedNextStatus(e.target.value)}
                        required
                        className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black bg-white font-bold uppercase outline-none cursor-pointer"
                      >
                        <option value="">-- Choose transition --</option>
                        {validNextStatuses.map((st) => (
                          <option key={st} value={st}>
                            {STATUS_LABELS[st] || st}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] uppercase font-bold text-neutral-700 tracking-wider mb-1">
                        Reason or Dispatch Note (Optional):
                      </label>
                      <textarea
                        value={statusNote}
                        onChange={(e) => setStatusNote(e.target.value)}
                        placeholder="e.g. Courier picked up, customer requested cancellation..."
                        rows={2}
                        className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={updatingStatus || !selectedNextStatus}
                      className="w-full py-2.5 bg-black hover:bg-neutral-800 text-white text-xs uppercase font-bold tracking-wider cursor-pointer disabled:opacity-50"
                    >
                      {updatingStatus ? "Recording Transition..." : "Execute Status Transition"}
                    </button>

                    <p className="text-[10px] text-neutral-400 leading-tight">
                      * Status transitions are strictly enforced on the server. Admins cannot manually set orders to &ldquo;Paid&rdquo;.
                    </p>
                  </form>
                )}
              </div>

              {/* Courier & AWB Assignment Box */}
              <div className="bg-white border border-neutral-200 p-5 shadow-sm space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-black pb-2 border-b border-neutral-200 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Courier & AWB Tracking</span>
                </h3>

                <form onSubmit={handleTrackingUpdate} className="space-y-3">
                  <div>
                    <label className="block text-[11px] uppercase font-bold text-neutral-700 tracking-wider mb-1">
                      Courier Partner:
                    </label>
                    <input
                      type="text"
                      value={courierName}
                      onChange={(e) => setCourierName(e.target.value)}
                      placeholder="e.g. Blue Dart, Delhivery, DTDC"
                      className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] uppercase font-bold text-neutral-700 tracking-wider mb-1">
                      Air Waybill (AWB) / Tracking #:
                    </label>
                    <input
                      type="text"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="e.g. BLD9876543210"
                      className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] uppercase font-bold text-neutral-700 tracking-wider mb-1">
                      Courier Tracking URL:
                    </label>
                    <input
                      type="url"
                      value={trackingUrl}
                      onChange={(e) => setTrackingUrl(e.target.value)}
                      placeholder="https://track.bluedart.com/..."
                      className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={updatingTracking}
                    className="w-full py-2 bg-neutral-800 hover:bg-black text-white text-xs uppercase font-bold tracking-wider cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{updatingTracking ? "Saving..." : "Save Tracking & Notify"}</span>
                  </button>
                </form>
                <div className="mt-4 border-t border-neutral-200 pt-4 space-y-3">
                  <p className="text-[11px] text-neutral-600">Shiprocket · {order.shiprocket_state || "not_created"}</p>
                  {order.tracking_number && <p className="text-xs text-neutral-800">{order.courier_name || "Courier pending"} · AWB {order.tracking_number}</p>}
                  {!shiprocketEnabled && <p className="text-xs text-neutral-600">Shiprocket actions are disabled by server configuration.</p>}
                  {["creating", "unknown", "assigning_awb", "awb_unknown", "pickup_requesting", "pickup_unknown", "generating_label", "label_unknown"].includes(order.shiprocket_state || "") && <div role="alert" className="border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 space-y-1">
                    <p className="font-bold">Provider outcome may be incomplete. Do not retry any Shiprocket action.</p>
                    <p>An authorized operator must search Shiprocket using this exact RIGHTNOWLIFE order reference, compare recipient and shipment details, and record the provider state and evidence. If the result is still unclear, leave it blocked and ask an engineer to reconcile local IDs/state with a reviewed conditional update. Do not clear IDs or tracking data or submit a replacement order/pickup.</p>
                  </div>}
                  <div className="flex flex-wrap gap-2">
                    {shiprocketEnabled && !order.shiprocket_order_id && !order.tracking_number && ["not_created", "failed"].includes(order.shiprocket_state || "not_created") && <button type="button" onClick={() => runShiprocketAction("create")} disabled={shippingBusy || !shiprocketOrderEligible} className="px-3 py-2 bg-black text-white text-[10px] font-bold uppercase disabled:opacity-50">Create Shiprocket Order</button>}
                    {shiprocketEnabled && order.shiprocket_order_id && order.shiprocket_state === "order_created" && !order.tracking_number && <button type="button" onClick={() => runShiprocketAction("assign_awb")} disabled={shippingBusy} className="px-3 py-2 bg-black text-white text-[10px] font-bold uppercase disabled:opacity-50">Assign Courier &amp; AWB</button>}
                    {shiprocketEnabled && order.shiprocket_shipment_id && order.tracking_number && order.shiprocket_state === "awb_assigned" && <button type="button" onClick={() => runShiprocketAction("pickup")} disabled={shippingBusy} className="px-3 py-2 border border-neutral-300 text-[10px] font-bold uppercase disabled:opacity-50">Request Pickup (Live)</button>}
                    {shiprocketEnabled && order.shiprocket_shipment_id && order.tracking_number && ["awb_assigned", "pickup_requested"].includes(order.shiprocket_state || "") && <button type="button" onClick={() => runShiprocketAction("label")} disabled={shippingBusy} className="px-3 py-2 border border-neutral-300 text-[10px] font-bold uppercase disabled:opacity-50">Generate Label</button>}
                    {order.shiprocket_label_url && <a href={order.shiprocket_label_url} target="_blank" rel="noreferrer" className="px-3 py-2 border border-neutral-300 text-[10px] font-bold uppercase">Open Label</a>}
                  </div>
                  {shippingMessage && <p role="status" className="text-xs text-neutral-700">{shippingMessage}</p>}
                  {order.shiprocket_last_error && <p className="text-xs text-amber-800">{order.shiprocket_last_error}</p>}
                </div>
              </div>

              {/* Customer Cancellation Request Decision Box */}
              {order.cancellation_requested === 1 && (
                <div className="bg-amber-50 border border-amber-300 p-5 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900 pb-2 border-b border-amber-200 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Customer Cancellation Request</span>
                  </h3>
                  <div className="text-xs text-amber-950 space-y-1">
                    <p><strong>Reason:</strong> {order.cancellation_reason || "None specified"}</p>
                    <p className="text-[11px] text-amber-800">
                      Requested at: {order.cancellation_requested_at ? new Date(order.cancellation_requested_at).toLocaleString("en-IN") : "Recent"}
                    </p>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm("Approve cancellation? This will cancel the order and trigger inventory restock/refund queue.")) return;
                        const res = await fetch(`/api/admin/orders/${order.id}/cancel`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ approved: true, note: "Admin approved cancellation" }),
                        });
                        if (res.ok) {
                          alert("Cancellation approved.");
                          fetchOrderDetail();
                        } else {
                          const err = await res.json();
                          alert(err.error || "Failed to approve cancellation");
                        }
                      }}
                      className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-wider"
                    >
                      Approve & Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const reason = prompt("Reason for rejecting cancellation:");
                        if (reason === null) return;
                        const res = await fetch(`/api/admin/orders/${order.id}/cancel`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ approved: false, note: reason }),
                        });
                        if (res.ok) {
                          alert("Cancellation rejected.");
                          fetchOrderDetail();
                        } else {
                          const err = await res.json();
                          alert(err.error || "Failed to reject cancellation");
                        }
                      }}
                      className="flex-1 py-2 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 text-xs font-bold uppercase tracking-wider"
                    >
                      Reject Request
                    </button>
                  </div>
                </div>
              )}

              {/* Online Razorpay Refund Trigger Box */}
              {order.payment_method === "COD Advance" && order.payment_status === "partially_paid" && order.order_status !== "refunded" && (
                <div className="bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900">
                  <p className="font-bold uppercase tracking-wider">COD Advance is non-refundable</p>
                  <p className="mt-1">The ₹200 advance must not be refunded. Cancellation does not refund this payment.</p>
                </div>
              )}
              {(order.payment_status === "paid" || (order.payment_status === "partially_paid" && order.payment_method !== "COD Advance")) && order.order_status !== "refunded" && (
                <div className="bg-white border border-neutral-200 p-5 shadow-sm space-y-3">
                  {(() => {
                    const capturedAdvance = order.total;
                    return <>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-black pb-2 border-b border-neutral-200 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Issue Online Refund (Razorpay)</span>
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Collected: <strong>{formatINR(capturedAdvance)}</strong> • Refunds are limited to captured payments.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      const amountStr = prompt(`Enter refund amount in ₹ (Max: ${capturedAdvance}):`, String(capturedAdvance));
                      if (!amountStr) return;
                      const amount = Number(amountStr);
                      if (!Number.isFinite(amount) || amount <= 0 || amount > capturedAdvance) {
                        alert("Invalid refund amount.");
                        return;
                      }
                      const reason = prompt("Enter refund reason:", "Order cancelled / Customer refund");
                      if (!reason) return;

                      const res = await fetch(`/api/admin/refunds`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ orderId: order.id, amount, reason }),
                      });

                      const data = await res.json();
                      if (res.ok) {
                        alert(data.message || "Refund issued successfully.");
                        fetchOrderDetail();
                      } else {
                        alert(data.error || "Refund initiation failed.");
                      }
                    }}
                    className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs uppercase font-bold tracking-wider cursor-pointer"
                  >
                    Initiate Online Refund
                  </button>
                    </>;
                  })()}
                </div>
              )}

              {/* Gateway Audit Identifiers */}
              <div className="bg-white border border-neutral-200 p-5 shadow-sm space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-black pb-2 border-b border-neutral-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Razorpay Gateway Tokens</span>
                </h3>

                <div className="space-y-1.5 text-xs text-neutral-600 font-mono">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-neutral-400 block font-sans">
                      Razorpay Order ID:
                    </span>
                    <span className="text-neutral-800">{order.razorpay_order_id || "None (Offline / Sandbox)"}</span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-neutral-400 block font-sans">
                      Razorpay Payment ID:
                    </span>
                    <span className="text-neutral-800">{order.razorpay_payment_id || "Pending Confirmation"}</span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-neutral-400 block font-sans">
                      Signature Verification:
                    </span>
                    <span className="text-emerald-700 font-bold font-sans">
                      {order.razorpay_signature ? "CRYPTOGRAPHICALLY VERIFIED" : "Awaiting Signature"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
