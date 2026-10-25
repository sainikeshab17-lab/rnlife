import "server-only";
import { getDb, withTransaction, type DbConnection, type DbOrder, type DbOrderAddress, type DbOrderItem } from "@/lib/db";
import { shiprocketRequest, shiprocketEnabled, ShiprocketError } from "@/lib/shiprocket/client";
import { hasValidShiprocketLabelHostAllowlist, isValidShiprocketLabelUrl } from "@/lib/policies";
import type { ShiprocketCreateOrderResponse, ShiprocketOrderInput, ShiprocketAwbResponse } from "@/lib/shiprocket/types";
import { prepareShiprocketShipment } from "@/services/shiprocket/shipment-preparation";

type ShippingDependencies = {
  db: DbConnection;
  request: typeof shiprocketRequest;
  enabled: typeof shiprocketEnabled;
  env: NodeJS.ProcessEnv;
  transaction: typeof withTransaction;
  prepare: (orderId: string) => ReturnType<typeof prepareShiprocketShipment>;
};

const runtimeDependencies = (): ShippingDependencies => {
  const db = getDb();
  return {
    db, request: shiprocketRequest, enabled: shiprocketEnabled, env: process.env, transaction: withTransaction,
    prepare: orderId => prepareShiprocketShipment(orderId, { db, env: process.env }),
  };
};

async function requireEligibleOrder(db: DbConnection, orderId: string) {
  const order = await db.prepare("SELECT * FROM orders WHERE id = ? AND is_confirmed = TRUE").get<DbOrder>(orderId);
  if (!order) throw new ShiprocketError("Order not found.", 404);
  const cod = ["COD", "Cash on Delivery"].includes(order.payment_method);
  const invalidStatus = ["cancelled", "refunded", "refund_pending", "payment_failed", "delivered", "shipped"].includes(order.order_status) ||
    Boolean(order.cancellation_requested) || ["pending", "refund_pending", "partially_refunded", "refunded"].includes(String(order.refund_status ?? ""));
  const invalidPayment = cod
    ? !["pending_payment", "paid"].includes(order.payment_status)
    : order.payment_status !== "paid";
  if (invalidStatus || invalidPayment) throw new ShiprocketError("Order is not eligible for shipping.", 409);
  return order;
}

function assertEligibleOrder(order: DbOrder | undefined): asserts order is DbOrder {
  if (!order) throw new ShiprocketError("Order not found.", 404);
  if (!order.is_confirmed) throw new ShiprocketError("Order is not eligible for shipping.", 409);
  const cod = ["COD", "Cash on Delivery"].includes(order.payment_method);
  const invalidStatus = ["cancelled", "refunded", "refund_pending", "payment_failed", "delivered", "shipped"].includes(order.order_status) ||
    Boolean(order.cancellation_requested) || ["pending", "refund_pending", "partially_refunded", "refunded"].includes(String(order.refund_status ?? ""));
  const invalidPayment = cod ? !["pending_payment", "paid"].includes(order.payment_status) : order.payment_status !== "paid";
  if (invalidStatus || invalidPayment) throw new ShiprocketError("Order is not eligible for shipping.", 409);
}

const allowedPriorStates: Record<string, string[]> = {
  creating: ["not_created", "failed"], assigning_awb: ["order_created"],
  pickup_requesting: ["awb_assigned"], generating_label: ["awb_assigned", "pickup_requested"],
};

function isSuccessfulPickupResponse(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const response = (value as Record<string, unknown>).response;
  if (!response || typeof response !== "object" || Array.isArray(response)) return false;
  const pickup = response as Record<string, unknown>;
  return (value as Record<string, unknown>).pickup_status === 1 && pickup.status === 3 &&
    typeof pickup.pickup_scheduled_date === "string" && pickup.pickup_scheduled_date.trim().length > 0 && pickup.pickup_scheduled_date.length <= 80 &&
    typeof pickup.pickup_token_number === "string" && pickup.pickup_token_number.trim().length > 0 && pickup.pickup_token_number.length <= 200;
}

/** Row lock serializes the eligibility check and durable operation reservation with cancellation/refund writers. */
async function claimEligibleOperation(orderId: string, nextState: keyof typeof allowedPriorStates, deps: ShippingDependencies) {
  return deps.transaction(async (tx) => {
    const order = await tx.prepare("SELECT * FROM orders WHERE id = ? FOR UPDATE").get<DbOrder>(orderId);
    assertEligibleOrder(order);
    const pendingRefund = await tx.prepare(`SELECT id FROM refund_records WHERE order_id = ? AND status IN ('pending', 'processed') LIMIT 1`)
      .get<{ id: string }>(orderId);
    if (pendingRefund) throw new ShiprocketError("A refund is pending or requires reconciliation for this order.", 409);
    const pendingRefundEvent = await tx.prepare(`SELECT event_key FROM razorpay_refund_webhook_inbox
      WHERE (order_id = ? OR payment_id = ?) AND state IN ('received', 'deferred', 'quarantined') LIMIT 1`)
      .get<{ event_key: string }>(orderId, order.razorpay_payment_id ?? "");
    if (pendingRefundEvent) throw new ShiprocketError("A refund webhook requires processing or reconciliation for this order.", 409);
    const allowed = allowedPriorStates[nextState];
    const state = order.shiprocket_state;
    if (!state || !allowed.includes(state)) {
      throw new ShiprocketError("Shipment operation is already in progress or needs reconciliation.", 409);
    }
    const claim = await tx.prepare(`UPDATE orders SET shiprocket_state = ?, shiprocket_last_error = NULL,
      shiprocket_updated_at = NOW(), updated_at = NOW() WHERE id = ? AND shiprocket_state = ?`)
      .run(nextState, orderId, state);
    if (claim.rowCount !== 1) throw new ShiprocketError("Could not safely reserve shipment operation.", 409);
    return order;
  });
}

export async function createOrResumeShipment(orderId: string, deps = runtimeDependencies()) {
  if (!deps.enabled()) throw new ShiprocketError("Shiprocket shipping is disabled.");
  const { db } = deps;
  const order = await requireEligibleOrder(db, orderId);
  const persistedState = order.shiprocket_state ?? "";
  if (persistedState === "unknown" || persistedState === "creating") {
    throw new ShiprocketError("Previous Shiprocket order creation has an uncertain outcome. Reconcile it before retrying.", 409);
  }
  if (order.shiprocket_order_id != null && order.shiprocket_shipment_id != null &&
      ["order_created", "awb_assigned", "pickup_requested", "label_ready"].includes(persistedState)) {
    return db.prepare("SELECT * FROM orders WHERE id = ?").get<DbOrder>(orderId);
  }
  if (persistedState !== "not_created" && persistedState !== "failed") {
    throw new ShiprocketError("Shipment operation is already in progress or requires reconciliation.", 409);
  }
  if (order.shiprocket_order_id != null || order.shiprocket_shipment_id != null || order.tracking_number) {
    throw new ShiprocketError("Shipment identifiers or tracking already exist; reconcile before creating another shipment.", 409);
  }
  const prepared = await deps.prepare(orderId);
  if (prepared.orderId !== orderId) throw new ShiprocketError("Shipment preparation did not match the requested order.", 409);
  const cod = ["COD", "Cash on Delivery"].includes(order.payment_method);
  const address = await db.prepare("SELECT * FROM order_addresses WHERE order_id = ?").get<DbOrderAddress>(orderId);
  const items = await db.prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY id").all<DbOrderItem>(orderId);
  if (!address || !items.length || !deps.env.SHIPROCKET_PICKUP_LOCATION) throw new ShiprocketError("Order address, items, or pickup location is missing.", 400);
  const postcodeDigits = String(address.pin_code ?? "").trim();
  const phoneDigits = String(address.phone || order.customer_phone || "").replace(/\D/g, "");
  const postcode = Number(postcodeDigits);
  const phone = Number(phoneDigits);
  if (!order.id || order.id.length > 50) throw new ShiprocketError("Order ID is invalid for Shiprocket.", 400);
  if (!address.full_name.trim() || !address.address_line1.trim() || !address.city.trim() || !address.state.trim() ||
      !/^\d{6}$/.test(postcodeDigits) || !/^\d{10,12}$/.test(phoneDigits) || !order.customer_email.includes("@") ||
      !Number.isFinite(order.subtotal) || !Number.isFinite(order.shipping) || !Number.isFinite(order.discount) ||
      !Number.isFinite(order.total) || order.subtotal < 0 || order.shipping < 0 || order.discount < 0 || order.total <= 0 ||
      items.some(item => !item.product_name?.trim())) {
    throw new ShiprocketError("Order address or recipient details are incomplete.", 400);
  }
  if (items.some(item => !item.sku?.trim() || !Number.isInteger(item.quantity) || item.quantity < 1 || !Number.isFinite(item.price) || item.price < 0)) {
    throw new ShiprocketError("Order items contain invalid shipment data.", 400);
  }

  let current = await db.prepare("SELECT shiprocket_state, shiprocket_order_id, shiprocket_shipment_id FROM orders WHERE id = ?")
    .get<{ shiprocket_state: string; shiprocket_order_id: string | number | null; shiprocket_shipment_id: string | number | null }>(orderId);
  if (!current) throw new ShiprocketError("Order not found.", 404);
  if (current.shiprocket_state === "unknown" || current.shiprocket_state === "creating") {
    throw new ShiprocketError("Previous Shiprocket order creation has an uncertain outcome. Reconcile it in Shiprocket before retrying.", 409);
  }
  if (!current.shiprocket_order_id) {
    if (order.tracking_number) throw new ShiprocketError("This order already has tracking information. Reconcile it before creating a Shiprocket shipment.", 409);
    const orderDate = new Date(order.created_at);
    if (!Number.isFinite(orderDate.getTime())) throw new ShiprocketError("Order date is invalid for Shiprocket.", 400);
    const packageDimensions = {
      length: prepared.dimensions.lengthCm,
      breadth: prepared.dimensions.breadthCm,
      height: prepared.dimensions.heightCm,
      weight: prepared.weightKg,
    };
    await claimEligibleOperation(orderId, "creating", deps);
    const [first, ...rest] = address.full_name.trim().split(/\s+/);
    const payload: ShiprocketOrderInput = {
      order_id: order.id, order_date: orderDate.toISOString().slice(0, 10),
      pickup_location: deps.env.SHIPROCKET_PICKUP_LOCATION,
      billing_customer_name: first, billing_address: [address.address_line1, address.landmark].filter(Boolean).join(", "),
      ...(address.address_line2 ? { billing_address_2: address.address_line2 } : {}),
      billing_city: address.city.slice(0, 30), billing_pincode: postcode, billing_state: address.state,
      billing_country: address.country || "India", billing_email: order.customer_email,
      billing_phone: phone, shipping_is_billing: true,
      order_items: items.map(item => ({ name: item.product_name, sku: item.sku, units: item.quantity, selling_price: item.price })),
      payment_method: cod ? "COD" : "Prepaid", shipping_charges: order.shipping,
      total_discount: order.discount, sub_total: order.subtotal - order.discount,
      ...packageDimensions,
    };
    if (rest.length) payload.billing_customer_name = `${first} ${rest.join(" ")}`;
    try {
      const response = await deps.request<ShiprocketCreateOrderResponse>("/orders/create/adhoc", "POST", payload);
      if (typeof response.order_id !== "number" || !Number.isSafeInteger(response.order_id) || response.order_id <= 0 ||
          typeof response.shipment_id !== "number" || !Number.isSafeInteger(response.shipment_id) || response.shipment_id <= 0) {
        throw new ShiprocketError("Shiprocket returned an incomplete order response.", undefined, true);
      }
      const persisted = await db.prepare(`UPDATE orders SET shiprocket_order_id = ?, shiprocket_shipment_id = ?, shiprocket_state = 'order_created',
        shiprocket_updated_at = NOW(), updated_at = NOW() WHERE id = ? AND shiprocket_state = 'creating' AND shiprocket_order_id IS NULL`)
        .run(response.order_id, response.shipment_id, orderId);
      if (persisted.rowCount !== 1) throw new ShiprocketError("Shiprocket order was created but local persistence needs reconciliation; do not retry.", undefined, true);
      current = { shiprocket_state: "order_created", shiprocket_order_id: response.order_id, shiprocket_shipment_id: response.shipment_id };
    } catch (error) {
      const ambiguous = !(error instanceof ShiprocketError) || error.ambiguous || (error.status !== undefined && error.status >= 500);
      await db.prepare(`UPDATE orders SET shiprocket_state = ?, shiprocket_last_error = ?, shiprocket_updated_at = NOW(), updated_at = NOW()
        WHERE id = ? AND shiprocket_state = 'creating'`).run(ambiguous ? "unknown" : "failed", "Shiprocket order creation did not complete.", orderId);
      throw error;
    }
  }

  return db.prepare("SELECT * FROM orders WHERE id = ?").get<DbOrder>(orderId);
}

export async function assignShipmentAwb(orderId: string, deps = runtimeDependencies()) {
  if (!deps.enabled()) throw new ShiprocketError("Shiprocket shipping is disabled.");
  const { db } = deps;
  await requireEligibleOrder(db, orderId);
  const current = await db.prepare("SELECT shiprocket_state, shiprocket_shipment_id, tracking_number FROM orders WHERE id = ?")
    .get<{ shiprocket_state: string; shiprocket_shipment_id: string | number | null; tracking_number: string | null }>(orderId);
  if (!current?.shiprocket_shipment_id) throw new ShiprocketError("Create a Shiprocket order before assigning an AWB.", 409);
  if (current.tracking_number) throw new ShiprocketError("Tracking information already exists. Reconcile before assigning an AWB.", 409);
  if (current.shiprocket_state !== "order_created") throw new ShiprocketError("Shipment is not ready for AWB assignment or needs reconciliation.", 409);
    await claimEligibleOperation(orderId, "assigning_awb", deps);
    try {
      const shipmentId = Number(current.shiprocket_shipment_id);
      if (!Number.isSafeInteger(shipmentId)) throw new ShiprocketError("Stored Shiprocket shipment ID is invalid.", 409);
      const awb = await deps.request<ShiprocketAwbResponse>("/courier/assign/awb", "POST", { shipment_id: shipmentId });
      const data = awb.response?.data;
      if (awb.awb_assign_status === 1 && data?.shipment_id === shipmentId &&
          typeof data.awb_code === "string" && /^[A-Za-z0-9-]{4,40}$/.test(data.awb_code) &&
          (data.courier_name == null || (typeof data.courier_name === "string" && data.courier_name.trim().length > 0 && data.courier_name.length <= 120))) {
        const saved = await db.prepare(`UPDATE orders SET tracking_number = ?, courier_name = ?, tracking_url = 'https://www.shiprocket.in/shipment-tracking/', shiprocket_state = 'awb_assigned',
          shiprocket_updated_at = NOW(), updated_at = NOW() WHERE id = ? AND shiprocket_state = 'assigning_awb' AND tracking_number IS NULL`)
          .run(data.awb_code, data.courier_name ?? null, orderId);
        if (saved.rowCount !== 1) throw new ShiprocketError("Shiprocket assigned an AWB but local persistence needs reconciliation.", undefined, true);
      } else {
        throw new ShiprocketError("Shiprocket returned an incomplete or mismatched AWB response; reconcile before retrying.", undefined, true);
      }
    } catch (error) {
      const ambiguous = !(error instanceof ShiprocketError) || error.ambiguous;
      await db.prepare(`UPDATE orders SET shiprocket_state = ?, shiprocket_last_error = ?,
        shiprocket_updated_at = NOW(), updated_at = NOW() WHERE id = ? AND shiprocket_state = 'assigning_awb'`)
        .run(ambiguous ? "awb_unknown" : "order_created",
          ambiguous ? "AWB assignment outcome is unclear; reconcile with Shiprocket before retrying." : "AWB assignment failed; retry is available.", orderId);
      throw error;
  }
  return db.prepare("SELECT * FROM orders WHERE id = ?").get<DbOrder>(orderId);
}

export async function scheduleShipmentPickup(orderId: string, deps = runtimeDependencies()) {
  if (!deps.enabled()) throw new ShiprocketError("Shiprocket shipping is disabled.");
  const { db } = deps;
  await requireEligibleOrder(db, orderId);
  const row = await db.prepare("SELECT shiprocket_shipment_id, tracking_number, shiprocket_state FROM orders WHERE id = ?").get<{ shiprocket_shipment_id: string | number | null; tracking_number: string | null; shiprocket_state: string }>(orderId);
  if (!row?.shiprocket_shipment_id || !row.tracking_number) throw new ShiprocketError("An AWB must be assigned before scheduling pickup.", 409);
  const shipmentId = Number(row.shiprocket_shipment_id);
  if (!Number.isSafeInteger(shipmentId)) throw new ShiprocketError("Stored Shiprocket shipment ID is invalid.", 409);
  await claimEligibleOperation(orderId, "pickup_requesting", deps);
  try {
    const result = await deps.request<Record<string, unknown>>("/courier/generate/pickup", "POST", { shipment_id: [shipmentId] });
    if (!isSuccessfulPickupResponse(result)) {
      throw new ShiprocketError("Shiprocket returned an incomplete pickup response; reconcile before retrying.", undefined, true);
    }
    const saved = await db.prepare("UPDATE orders SET shiprocket_state = 'pickup_requested', shiprocket_updated_at = NOW(), updated_at = NOW() WHERE id = ? AND shiprocket_state = 'pickup_requesting'").run(orderId);
    if (saved.rowCount !== 1) throw new ShiprocketError("Shiprocket accepted pickup but local persistence needs reconciliation.", undefined, true);
    return result;
  } catch (error) {
    const ambiguous = !(error instanceof ShiprocketError) || error.ambiguous;
    await db.prepare("UPDATE orders SET shiprocket_state = ?, shiprocket_last_error = ?, shiprocket_updated_at = NOW(), updated_at = NOW() WHERE id = ? AND shiprocket_state = 'pickup_requesting'")
      .run(ambiguous ? "pickup_unknown" : "awb_assigned",
        ambiguous ? "Pickup request outcome is unclear; reconcile with Shiprocket before retrying." : "Pickup request failed; retry is available.", orderId);
    throw error;
  }
}

export async function generateShipmentLabel(orderId: string, deps = runtimeDependencies()) {
  if (!deps.enabled()) throw new ShiprocketError("Shiprocket shipping is disabled.");
  const labelHosts = deps.env.SHIPROCKET_LABEL_ALLOWED_HOSTS;
  if (!labelHosts?.trim()) {
    throw new ShiprocketError("Shiprocket label host allowlist is not configured. Set SHIPROCKET_LABEL_ALLOWED_HOSTS to exact HTTPS hostnames verified in staging.", 503);
  }
  if (!hasValidShiprocketLabelHostAllowlist(labelHosts)) {
    throw new ShiprocketError("SHIPROCKET_LABEL_ALLOWED_HOSTS must be a comma-separated list of exact DNS hostnames without schemes, paths, wildcards, or ports.", 503);
  }
  const { db } = deps;
  await requireEligibleOrder(db, orderId);
  const row = await db.prepare("SELECT shiprocket_shipment_id, shiprocket_state, shiprocket_label_url FROM orders WHERE id = ?")
    .get<{ shiprocket_shipment_id: string | number | null; shiprocket_state: string; shiprocket_label_url?: string | null }>(orderId);
  if (!row?.shiprocket_shipment_id) throw new ShiprocketError("An AWB must be assigned before generating a label.", 409);
  if (row.shiprocket_state === "label_ready") throw new ShiprocketError("A label already exists. Use the saved label instead of generating another.", 409);
  if (!["awb_assigned", "pickup_requested"].includes(row.shiprocket_state)) {
    throw new ShiprocketError("Label generation is unavailable or needs reconciliation.", 409);
  }
  const shipmentId = Number(row.shiprocket_shipment_id);
  if (!Number.isSafeInteger(shipmentId)) throw new ShiprocketError("Stored Shiprocket shipment ID is invalid.", 409);
  await claimEligibleOperation(orderId, "generating_label", deps);
  try {
    const result = await deps.request<{ label_url?: string }>("/courier/generate/label", "POST", { shipment_id: [shipmentId] });
    const url = isValidShiprocketLabelUrl(result.label_url, deps.env.SHIPROCKET_LABEL_ALLOWED_HOSTS)
      ? result.label_url
      : null;
    if (!url) throw new ShiprocketError("Shiprocket returned an untrusted or incomplete label URL; reconcile before retrying.", undefined, true);
    const saved = await db.prepare(`UPDATE orders SET shiprocket_label_url = ?, shiprocket_state = 'label_ready',
      shiprocket_updated_at = NOW(), updated_at = NOW() WHERE id = ? AND shiprocket_state = 'generating_label'`).run(url, orderId);
    if (saved.rowCount !== 1) throw new ShiprocketError("Shiprocket returned a label but local persistence needs reconciliation.", undefined, true);
    return url;
  } catch (error) {
    const ambiguous = !(error instanceof ShiprocketError) || error.ambiguous;
    await db.prepare(`UPDATE orders SET shiprocket_state = ?, shiprocket_last_error = ?,
      shiprocket_updated_at = NOW(), updated_at = NOW() WHERE id = ? AND shiprocket_state = 'generating_label'`)
      .run(ambiguous ? "label_unknown" : row.shiprocket_state,
        ambiguous ? "Label generation outcome is unclear; reconcile with Shiprocket before retrying." : "Label generation failed; retry is available.", orderId);
    throw error;
  }
}
