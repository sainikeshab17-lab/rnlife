import "server-only";
import { getDb, type DbConnection, type DbOrder, type DbOrderAddress, type DbOrderItem } from "@/lib/db";
import { ShiprocketError } from "@/lib/shiprocket/client";

type PreparationDependencies = { db: DbConnection; env: NodeJS.ProcessEnv };
const runtimeDependencies = (): PreparationDependencies => ({ db: getDb(), env: process.env });

function positiveConfig(env: NodeJS.ProcessEnv, name: string) {
  const raw = env[name];
  const value = raw?.trim() ? Number(raw) : NaN;
  if (!Number.isFinite(value) || value <= 0) {
    throw new ShiprocketError(`${name} must be configured as a positive number before shipment preparation.`, 503);
  }
  return value;
}

/** Read-only preflight. Order and item data are read from PostgreSQL; this never calls Shiprocket or writes order state. */
export async function prepareShiprocketShipment(orderId: string, deps = runtimeDependencies()) {
  if (typeof orderId !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(orderId)) {
    throw new ShiprocketError("Invalid order ID.", 400);
  }
  const { db, env } = deps;
  const order = await db.prepare("SELECT * FROM orders WHERE id = ? AND is_confirmed = TRUE").get<DbOrder>(orderId);
  if (!order) throw new ShiprocketError("Confirmed order not found.", 404);

  const cod = ["COD", "Cash on Delivery"].includes(order.payment_method);
  const validPayment = cod
    ? ["pending_payment", "paid"].includes(order.payment_status)
    : order.payment_status === "paid";
  const blockedStatuses = ["cancelled", "refunded", "refund_pending", "payment_failed", "delivered", "shipped"];
  if (!validPayment || blockedStatuses.includes(order.order_status) || Boolean(order.cancellation_requested) ||
      ["pending", "refund_pending", "partially_refunded", "refunded"].includes(String(order.refund_status ?? ""))) {
    throw new ShiprocketError("Order payment or lifecycle state is not eligible for shipment preparation.", 409);
  }
  if (order.shiprocket_state !== "not_created" && order.shiprocket_state !== "failed") {
    throw new ShiprocketError("A shipment already exists or a previous attempt needs reconciliation.", 409);
  }
  if (order.shiprocket_order_id != null || order.shiprocket_shipment_id != null || order.tracking_number) {
    throw new ShiprocketError("Shipment identifiers or tracking already exist; reconcile before preparing again.", 409);
  }

  const [address, items] = await Promise.all([
    db.prepare("SELECT * FROM order_addresses WHERE order_id = ?").get<DbOrderAddress>(orderId),
    db.prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY id").all<DbOrderItem>(orderId),
  ]);
  if (!address || !items.length) throw new ShiprocketError("Order address or items are missing.", 409);
  const postcode = String(address.pin_code ?? "").trim();
  const phone = String(address.phone || order.customer_phone || "").replace(/\D/g, "");
  const requiredAddressFields = [address.full_name, address.address_line1, address.city, address.state];
  if (!requiredAddressFields.every(value => typeof value === "string" && value.trim()) ||
      !/^[1-9]\d{5}$/.test(postcode) || !/^\d{10,12}$/.test(phone) ||
      !["india", "in"].includes(String(address.country ?? "").trim().toLowerCase()) ||
      typeof order.customer_email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(order.customer_email)) {
    throw new ShiprocketError("Delivery address or recipient details are invalid.", 400);
  }
  if (items.some(item => !item.product_id?.trim() || !item.product_name?.trim() || !item.sku?.trim() ||
      !Number.isSafeInteger(item.quantity) || item.quantity < 1 ||
      !Number.isFinite(item.price) || item.price < 0)) {
    throw new ShiprocketError("Persisted order items contain invalid shipment data.", 400);
  }
  const totalUnits = items.reduce((total, item) => total + item.quantity, 0);
  if (!Number.isSafeInteger(totalUnits) || totalUnits < 1) {
    throw new ShiprocketError("Order quantities cannot produce a valid parcel.", 400);
  }

  const pickupLocation = env.SHIPROCKET_PICKUP_LOCATION?.trim();
  if (!pickupLocation) throw new ShiprocketError("SHIPROCKET_PICKUP_LOCATION must be configured.", 503);
  const pickupPostcode = env.SHIPROCKET_PICKUP_POSTCODE?.trim();
  if (!pickupPostcode || !/^[1-9]\d{5}$/.test(pickupPostcode)) {
    throw new ShiprocketError("SHIPROCKET_PICKUP_POSTCODE must be a valid six-digit Indian PIN code.", 503);
  }

  // Parcel weight uses server-configured unit weight multiplied by persisted order quantities.
  // Product dimensions are absent from the existing schema; use the operator-measured parcel template.
  const itemWeightKg = positiveConfig(env, "SHIPROCKET_ITEM_WEIGHT_KG");
  const dimensions = {
    lengthCm: positiveConfig(env, "SHIPROCKET_PACKAGE_LENGTH_CM"),
    breadthCm: positiveConfig(env, "SHIPROCKET_PACKAGE_BREADTH_CM"),
    heightCm: positiveConfig(env, "SHIPROCKET_PACKAGE_HEIGHT_CM"),
  };
  const weightKg = Number((itemWeightKg * totalUnits).toFixed(3));
  if (!Number.isFinite(weightKg) || weightKg <= 0) throw new ShiprocketError("Calculated parcel weight is invalid.", 400);

  return {
    orderId: order.id,
    paymentMethod: cod ? "COD" : "Prepaid",
    pickupLocation,
    pickupPostcode,
    deliveryPostcode: postcode,
    itemCount: items.length,
    totalUnits,
    weightKg,
    dimensions,
    items: items.map(item => ({ productId: item.product_id, name: item.product_name, sku: item.sku, quantity: item.quantity })),
  };
}
