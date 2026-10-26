import { createHash, randomUUID } from "crypto";
import {
  getDb,
  DbOrder,
  DbOrderItem,
  DbOrderAddress,
  DbOrderStatusHistory,
  DbShippingEvent,
  DbReturn,
  DbReturnItem,
  DbRefundRecord,
  DbRazorpayPaymentAttempt,
  DbConnection,
  OrderWithDetails,
  withTransaction,
} from "./index";
import type { CustomTShirtCustomization } from "@/types";
import { getCancellationResultStatus, shouldMarkOrderRefunded } from "@/lib/order-status-machine";
import { STORE_POLICIES } from "@/lib/policies";
import { hasUnresolvedShiprocketOperation } from "./shiprocket-operation-guard";

export function orderInventoryVariants<T extends { productId: string; size: string }>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    Buffer.compare(Buffer.from(a.productId, "utf8"), Buffer.from(b.productId, "utf8")) ||
    Buffer.compare(Buffer.from(a.size, "utf8"), Buffer.from(b.size, "utf8"))
  );
}

export class InventoryUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryUnavailableError";
  }
}

export async function lockInventoryVariants(
  db: DbConnection,
  variants: Array<{ productId: string; size: string }>
): Promise<Array<{ productId: string; size: string }>> {
  const ordered = orderInventoryVariants(
    [...new Map(variants.map((variant) => [`${variant.productId}\0${variant.size}`, variant])).values()]
  );
  if (!ordered.length) return ordered;

  const tupleList = ordered.map(() => "(?, ?)").join(", ");
  const parameters = ordered.flatMap((variant) => [variant.productId, variant.size]);
  const rows = await db.prepare(`
    SELECT product_id, size FROM inventory
    WHERE (product_id, size) IN (${tupleList})
    ORDER BY product_id COLLATE "C", size COLLATE "C"
    FOR UPDATE
  `).all<{ product_id: string; size: string }>(...parameters);
  if (rows.length !== ordered.length) {
    throw new Error("Inventory row missing while locking stock variants.");
  }
  return rows.map((row) => ({ productId: row.product_id, size: row.size }));
}

export function isOrderOwnedByCustomer(
  order: Pick<DbOrder, "user_id" | "customer_email">,
  customer: { userId: string; email?: string | null; emailVerified: boolean }
): boolean {
  if (order.user_id === customer.userId) return true;
  return Boolean(
    customer.emailVerified && customer.email &&
    order.customer_email.toLowerCase().trim() === customer.email.toLowerCase().trim()
  );
}

export function stripGuestToken<T extends { guest_token: string }>(record: T): Omit<T, "guest_token"> {
  return Object.fromEntries(Object.entries(record).filter(([field]) => field !== "guest_token")) as Omit<T, "guest_token">;
}

export async function checkAndReserveInventory(
  items: Array<{ productId: string; size: string; quantity: number }>,
  connection?: DbConnection
): Promise<{ ok: boolean; error?: string }> {
  const reserve = async (db: DbConnection) => {
    const quantities = new Map<string, { productId: string; size: string; quantity: number }>();
    for (const item of items) {
      const key = `${item.productId}\0${item.size}`;
      const existing = quantities.get(key);
      quantities.set(key, {
        ...item,
        quantity: (existing?.quantity ?? 0) + item.quantity,
      });
    }

    const orderedQuantities = orderInventoryVariants([...quantities.values()]);
    let lockedVariants: Array<{ productId: string; size: string }>;
    try {
      lockedVariants = await lockInventoryVariants(db, orderedQuantities);
    } catch (error) {
      if (error instanceof Error && error.message === "Inventory row missing while locking stock variants.") {
        return { ok: false, error: "Stock is not configured for one or more selected sizes." };
      }
      throw error;
    }
    const lockedRows: Array<{ item: (typeof orderedQuantities)[number]; available: number }> = [];
    for (const item of lockedVariants) {
      const quantity = quantities.get(`${item.productId}\0${item.size}`);
      if (!quantity) throw new Error("Locked inventory variant was not part of the reservation.");
      const row = await db.prepare(`
        SELECT stock, reserved FROM inventory WHERE product_id = ? AND size = ?
      `).get<{ stock: number; reserved: number }>(item.productId, item.size);
      if (!row) throw new Error("Inventory row disappeared while reserving stock.");
      const available = Math.max(0, row.stock - row.reserved);
      if (available < quantity.quantity) {
        return {
          ok: false,
          error: `Insufficient stock for product (${item.size}). Only ${available} available.`,
        };
      }
      lockedRows.push({ item: quantity, available });
    }

    for (const { item } of lockedRows) {
      await db.prepare(`
        UPDATE inventory SET reserved = reserved + ?
        WHERE product_id = ? AND size = ?
      `).run(item.quantity, item.productId, item.size);
    }
    return { ok: true };
  };
  return connection ? reserve(connection) : withTransaction(reserve);
}

export async function releaseInventoryReservation(
  items: Array<{ productId: string; size: string; quantity: number }>
): Promise<void> {
  await withTransaction(async (db) => {
    const ordered = orderInventoryVariants(items);
    await lockInventoryVariants(db, ordered);
    for (const item of ordered) {
      await db.prepare(`
      UPDATE inventory 
      SET reserved = GREATEST(0, reserved - ?) 
      WHERE product_id = ? AND size = ?
    `).run(item.quantity, item.productId, item.size);
    }
  });
}

export async function commitInventoryDeduction(
  items: Array<{ productId: string; size: string; quantity: number }>
): Promise<void> {
  await withTransaction(async (db) => {
    const ordered = orderInventoryVariants(items);
    await lockInventoryVariants(db, ordered);
    for (const item of ordered) {
      const result = await db.prepare(`
        UPDATE inventory SET stock = stock - ?, reserved = reserved - ?
        WHERE product_id = ? AND size = ? AND stock >= ? AND reserved >= ?
      `).run(item.quantity, item.quantity, item.productId, item.size, item.quantity, item.quantity);
      if (result.rowCount !== 1) throw new Error("Inventory reservation missing while committing deduction.");
    }
  });
}

export interface CreateOrderParams {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  paymentMethod: string;
  razorpayOrderId?: string;
  userId?: string | null;
  items: Array<{
    productId: string;
    productSlug: string;
    productName: string;
    color: string;
    gender?: "Men" | "Women" | "Unisex";
    size: string;
    price: number;
    quantity: number;
    image: string;
    sku: string;
    fit: string;
    fulfillmentType?: "stock" | "made_to_order";
    customization?: CustomTShirtCustomization;
  }>;
  address: {
    fullName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    landmark?: string;
    city: string;
    state: string;
    pinCode: string;
    country?: string;
  };
}

export async function createPendingOrder(params: CreateOrderParams, connection?: DbConnection): Promise<{
  order: DbOrder;
  guestToken: string;
}> {
  const orderId = `ord_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const guestToken = randomUUID();
  const now = new Date().toISOString();
  const create = async (db: DbConnection) => {
  await db.prepare(`
    INSERT INTO orders (
      id, order_number, customer_name, customer_email, customer_phone,
      subtotal, shipping, discount, total, payment_method, payment_status,
      order_status, is_confirmed, razorpay_order_id, guest_token, user_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment', 'pending_payment', ?, ?, ?, ?, ?, ?)
  `).run(
    orderId,
    params.orderNumber,
    params.customerName,
    params.customerEmail.toLowerCase().trim(),
    params.customerPhone.trim(),
    params.subtotal,
    params.shipping,
    params.discount,
    params.total,
    params.paymentMethod,
    params.paymentMethod === "COD" || params.paymentMethod === "Cash on Delivery",
    params.razorpayOrderId || null,
    guestToken,
    params.userId || null,
    now,
    now
  );

  // Insert items
  const insertItem = db.prepare(`
    INSERT INTO order_items (
      id, order_id, product_id, product_slug, product_name,
      color, size, price, quantity, image, sku, fit, fulfillment_type, customization, gender
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?)
  `);

  for (const item of params.items) {
    const itemId = `item_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    await insertItem.run(
      itemId,
      orderId,
      item.productId,
      item.productSlug,
      item.productName,
      item.color,
      item.size,
      item.price,
      item.quantity,
      item.image,
      item.sku,
      item.fit,
      item.fulfillmentType ?? "stock",
      item.customization ? JSON.stringify(item.customization) : null,
      item.gender ?? null
    );
  }

  // Insert delivery address
  const addrId = `addr_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  await db.prepare(`
    INSERT INTO order_addresses (
      id, order_id, full_name, phone, address_line1, address_line2,
      landmark, city, state, pin_code, country
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    addrId,
    orderId,
    params.address.fullName,
    params.address.phone,
    params.address.addressLine1,
    params.address.addressLine2 || null,
    params.address.landmark || null,
    params.address.city,
    params.address.state,
    params.address.pinCode,
    params.address.country || "India"
  );

  if (params.paymentMethod.startsWith("Razorpay")) {
    await writeRazorpayCreationState(db, orderId, params.razorpayOrderId ? "ready" : "pending", {
      ...(params.razorpayOrderId ? { razorpayOrderId: params.razorpayOrderId } : {}),
    });
  }

  const order = await db.prepare("SELECT * FROM orders WHERE id = ?").get<DbOrder>(orderId);
  if (!order) throw new Error("Created order could not be retrieved.");
  return { order, guestToken };
  };
  return connection ? create(connection) : withTransaction(create);
}

export async function updateOrderRazorpayId(
  orderId: string,
  razorpayOrderId: string,
  connection?: DbConnection
): Promise<boolean> {
  const attach = async (db: DbConnection) => {
    const order = await db.prepare("SELECT * FROM orders WHERE id = ? FOR UPDATE").get<DbOrder>(orderId);
    if (!order) return false;
    if (order.razorpay_order_id) return order.razorpay_order_id === razorpayOrderId;
    const now = new Date().toISOString();
    const orderUpdate = await db.prepare(`
      UPDATE orders SET razorpay_order_id = ?, updated_at = ?
      WHERE id = ? AND razorpay_order_id IS NULL
    `).run(razorpayOrderId, now, orderId);
    if (orderUpdate.rowCount !== 1) {
      const existing = await db.prepare("SELECT razorpay_order_id FROM orders WHERE id = ?")
        .get<{ razorpay_order_id: string | null }>(orderId);
      return existing?.razorpay_order_id === razorpayOrderId;
    }
    await writeRazorpayCreationState(db, orderId, "ready", { razorpayOrderId });
    return true;
  };
  return connection ? attach(connection) : withTransaction(attach);
}

async function writeRazorpayCreationState(db: DbConnection, orderId: string, state: string, payload: unknown = {}): Promise<void> {
  await db.prepare(`INSERT INTO payment_audits (id, order_id, event_type, payload, created_at) VALUES (?, ?, ?, ?, NOW())`)
    .run(`aud_${randomUUID().replace(/-/g, "").slice(0, 16)}`, orderId, `razorpay_order_creation:${state}`, JSON.stringify(payload));
}

export async function getRazorpayOrderCreationState(orderId: string): Promise<{ state: string | null; createdAt: string | null }> {
  const row = await getDb().prepare(`SELECT event_type, created_at FROM payment_audits
    WHERE order_id = ? AND event_type IN (
      'razorpay_order_creation:pending', 'razorpay_order_creation:creating',
      'razorpay_order_creation:ready', 'razorpay_order_creation:unknown',
      'razorpay_order_creation:retryable'
    ) ORDER BY created_at DESC LIMIT 1`)
    .get<{ event_type: string; created_at: string }>(orderId);
  return row ? { state: row.event_type.split(":").at(-1) ?? null, createdAt: row.created_at } : { state: null, createdAt: null };
}

export async function claimRazorpayOrderCreation(orderId: string): Promise<boolean> {
  return withTransaction(async (db) => {
    const order = await db.prepare("SELECT * FROM orders WHERE id = ? FOR UPDATE").get<DbOrder>(orderId);
    if (!order || order.razorpay_order_id) return false;
    const latest = await db.prepare(`SELECT event_type FROM payment_audits
      WHERE order_id = ? AND event_type IN (
        'razorpay_order_creation:pending', 'razorpay_order_creation:creating',
        'razorpay_order_creation:ready', 'razorpay_order_creation:unknown',
        'razorpay_order_creation:retryable'
      ) ORDER BY created_at DESC LIMIT 1`)
      .get<{ event_type: string }>(orderId);
    const state = latest?.event_type.split(":").at(-1);
    if (state && state !== "pending" && state !== "retryable") return false;
    await writeRazorpayCreationState(db, orderId, "creating");
    return true;
  });
}

export async function markRazorpayOrderCreationRetryable(orderId: string): Promise<boolean> {
  return updateRazorpayOrderCreationState(orderId, "retryable", ["creating"]);
}

export async function markRazorpayOrderCreationUnknown(orderId: string): Promise<boolean> {
  return updateRazorpayOrderCreationState(orderId, "unknown", ["creating", "unknown"]);
}

export async function markStaleRazorpayOrderCreationUnknown(orderId: string): Promise<boolean> {
  return withTransaction(async (db) => {
    const order = await db.prepare("SELECT * FROM orders WHERE id = ? FOR UPDATE").get<DbOrder>(orderId);
    if (!order || order.razorpay_order_id) return false;
    const latest = await db.prepare(`SELECT event_type, created_at FROM payment_audits
      WHERE order_id = ? AND event_type IN (
        'razorpay_order_creation:pending', 'razorpay_order_creation:creating',
        'razorpay_order_creation:ready', 'razorpay_order_creation:unknown',
        'razorpay_order_creation:retryable'
      ) ORDER BY created_at DESC LIMIT 1 FOR UPDATE`)
      .get<{ event_type: string; created_at: string }>(orderId);
    if (latest?.event_type !== "razorpay_order_creation:creating" || Date.now() - Date.parse(latest.created_at) < 120_000) return false;
    await writeRazorpayCreationState(db, orderId, "unknown", { reason: "stale_claim" });
    return true;
  });
}

async function updateRazorpayOrderCreationState(orderId: string, state: "retryable" | "unknown", allowed: string[]): Promise<boolean> {
  return withTransaction(async (db) => {
    const order = await db.prepare("SELECT * FROM orders WHERE id = ? FOR UPDATE").get<DbOrder>(orderId);
    if (!order || order.razorpay_order_id) return false;
    const latest = await db.prepare(`SELECT event_type FROM payment_audits
      WHERE order_id = ? AND event_type IN (
        'razorpay_order_creation:pending', 'razorpay_order_creation:creating',
        'razorpay_order_creation:ready', 'razorpay_order_creation:unknown',
        'razorpay_order_creation:retryable'
      ) ORDER BY created_at DESC LIMIT 1`)
      .get<{ event_type: string }>(orderId);
    const current = latest?.event_type.split(":").at(-1);
    if (!current || !allowed.includes(current)) return false;
    await writeRazorpayCreationState(db, orderId, state);
    return true;
  });
}

export function scopeCheckoutIdempotencyKey(identity: string, requestKey: string): string {
  return createHash("sha256")
    .update(`${identity.trim().toLowerCase()}\0${requestKey}`)
    .digest("hex");
}

export async function withCheckoutIdempotency(params: {
  idempotencyKey: string;
  requestHash: string;
  create: (connection: DbConnection) => Promise<{ order: DbOrder; guestToken: string }>;
}): Promise<
  | { status: "created" | "replayed"; order: DbOrder; guestToken: string }
  | { status: "conflict" }
> {
  return withTransaction(async (db) => {
    await db.prepare("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))")
      .get(params.idempotencyKey);

    const existing = await db.prepare(`
      SELECT o.*, a.payload AS checkout_idempotency_payload
      FROM payment_audits a JOIN orders o ON o.id = a.order_id
      WHERE a.event_type = ? FOR UPDATE OF o
    `).get<DbOrder & { checkout_idempotency_payload: string }>(`checkout_idempotency:${params.idempotencyKey}`);
    if (existing) {
      const metadata = JSON.parse(existing.checkout_idempotency_payload) as { requestHash?: string };
      if (metadata.requestHash !== params.requestHash) return { status: "conflict" };
      return { status: "replayed", order: existing, guestToken: existing.guest_token };
    }

    const created = await params.create(db);
    await db.prepare(`INSERT INTO payment_audits (id, order_id, event_type, payload, created_at)
      VALUES (?, ?, ?, ?, NOW())`)
      .run(`aud_${randomUUID().replace(/-/g, "").slice(0, 16)}`, created.order.id,
        `checkout_idempotency:${params.idempotencyKey}`, JSON.stringify({ requestHash: params.requestHash }));
    return { status: "created", ...created };
  });
}

export async function createCodAdvanceAttempt(
  orderId: string,
  attemptKey: string,
  connection: DbConnection
): Promise<DbRazorpayPaymentAttempt> {
  const existing = await connection.prepare(`
    SELECT * FROM razorpay_payment_attempts WHERE order_id = ? AND attempt_key = ?
  `).get<DbRazorpayPaymentAttempt>(orderId, attemptKey);
  if (existing) return existing;
  const latest = await connection.prepare(`
    SELECT COALESCE(MAX(attempt_number), 0) AS value FROM razorpay_payment_attempts WHERE order_id = ?
  `).get<{ value: number }>(orderId);
  const attemptNumber = Number(latest?.value ?? 0) + 1;
  const id = `rpa_${randomUUID().replace(/-/g, "").slice(0, 18)}`;
  const now = new Date().toISOString();
  await connection.prepare(`
    INSERT INTO razorpay_payment_attempts (
      id, order_id, attempt_number, attempt_key, purpose, receipt, creation_state,
      payment_state, amount_paisa, currency, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'cod_advance', ?, 'pending', 'not_attempted', 20000, 'INR', ?, ?)
  `).run(id, orderId, attemptNumber, attemptKey, id, now, now);
  await connection.prepare(`
    UPDATE orders SET current_payment_attempt_id = ?, updated_at = ? WHERE id = ?
  `).run(id, now, orderId);
  const created = await connection.prepare("SELECT * FROM razorpay_payment_attempts WHERE id = ?")
    .get<DbRazorpayPaymentAttempt>(id);
  if (!created) throw new Error("COD Advance payment attempt could not be retrieved.");
  return created;
}

export async function getPaymentAttemptById(attemptId: string): Promise<DbRazorpayPaymentAttempt | null> {
  return (await getDb().prepare("SELECT * FROM razorpay_payment_attempts WHERE id = ?")
    .get<DbRazorpayPaymentAttempt>(attemptId)) ?? null;
}

export async function getPaymentAttemptByRazorpayOrderId(razorpayOrderId: string): Promise<DbRazorpayPaymentAttempt | null> {
  return (await getDb().prepare("SELECT * FROM razorpay_payment_attempts WHERE razorpay_order_id = ?")
    .get<DbRazorpayPaymentAttempt>(razorpayOrderId)) ?? null;
}

export async function claimCodAdvanceOrderCreation(attemptId: string): Promise<"claimed" | "ready" | "wait" | "reconcile"> {
  return withTransaction(async (db) => {
    const attempt = await db.prepare("SELECT * FROM razorpay_payment_attempts WHERE id = ? FOR UPDATE")
      .get<DbRazorpayPaymentAttempt>(attemptId);
    if (!attempt || attempt.purpose !== "cod_advance") return "reconcile";
    if (attempt.razorpay_order_id && attempt.creation_state === "ready") return "ready";
    if (attempt.creation_state === "creating") {
      if (Date.now() - Date.parse(attempt.updated_at) > 120_000) {
        await db.prepare(`UPDATE razorpay_payment_attempts SET creation_state = 'unknown',
          payment_state = 'unknown', reconciliation_note = 'stale_order_creation', updated_at = ? WHERE id = ?`)
          .run(new Date().toISOString(), attemptId);
        return "reconcile";
      }
      return "wait";
    }
    if (attempt.creation_state !== "pending" && attempt.creation_state !== "retryable") return "reconcile";
    await db.prepare(`UPDATE razorpay_payment_attempts SET creation_state = 'creating', updated_at = ? WHERE id = ?`)
      .run(new Date().toISOString(), attemptId);
    return "claimed";
  });
}

export async function attachCodAdvanceRazorpayOrder(attemptId: string, razorpayOrderId: string): Promise<boolean> {
  return withTransaction(async (db) => {
    const attempt = await db.prepare("SELECT * FROM razorpay_payment_attempts WHERE id = ? FOR UPDATE")
      .get<DbRazorpayPaymentAttempt>(attemptId);
    if (!attempt || attempt.purpose !== "cod_advance") return false;
    if (attempt.razorpay_order_id) return attempt.razorpay_order_id === razorpayOrderId;
    if (attempt.creation_state !== "creating" && attempt.creation_state !== "unknown") return false;
    const now = new Date().toISOString();
    const updated = await db.prepare(`UPDATE razorpay_payment_attempts
      SET razorpay_order_id = ?, creation_state = 'ready', payment_state = 'not_attempted', updated_at = ?
      WHERE id = ? AND creation_state IN ('creating', 'unknown')`).run(razorpayOrderId, now, attemptId);
    if (updated.rowCount !== 1) return false;
    const orderUpdated = await db.prepare(`UPDATE orders SET razorpay_order_id = ?, updated_at = ?
      WHERE id = ? AND current_payment_attempt_id = ? AND payment_method = 'COD Advance'`)
      .run(razorpayOrderId, now, attempt.order_id, attemptId);
    if (orderUpdated.rowCount !== 1) throw new Error("COD Advance Razorpay order could not be linked to its internal order.");
    await logPaymentAudit(attempt.order_id, "cod_advance_razorpay_order_created", {
      attemptId, razorpayOrderId, amountPaisa: attempt.amount_paisa,
    }, db);
    return true;
  });
}

export async function setCodAdvanceCreationFailure(attemptId: string, state: "retryable" | "unknown", note: string): Promise<void> {
  await getDb().prepare(`UPDATE razorpay_payment_attempts SET creation_state = ?,
    payment_state = ?, reconciliation_note = ?, updated_at = ?
    WHERE id = ? AND purpose = 'cod_advance' AND creation_state = 'creating'`)
    .run(state, state === "unknown" ? "unknown" : "not_attempted", note.slice(0, 300), new Date().toISOString(), attemptId);
}

export async function updateCodAdvancePaymentState(
  attemptId: string,
  paymentId: string | null,
  state: "failed" | "authorized" | "cancelled" | "unknown",
  note?: string
): Promise<void> {
  await getDb().prepare(`UPDATE razorpay_payment_attempts
    SET payment_state = ?, razorpay_payment_id = COALESCE(?, razorpay_payment_id),
        reconciliation_note = ?, updated_at = ?
    WHERE id = ? AND purpose = 'cod_advance' AND payment_state != 'captured'`)
    .run(state, paymentId, note?.slice(0, 300) ?? null, new Date().toISOString(), attemptId);
}

export async function markCodAdvanceAsVerified(params: {
  attemptId: string; paymentId: string; razorpayOrderId: string; signature?: string;
}): Promise<{ success: boolean; alreadyVerified: boolean }> {
  return withTransaction(async (db) => {
    const attempt = await db.prepare("SELECT * FROM razorpay_payment_attempts WHERE id = ? FOR UPDATE")
      .get<DbRazorpayPaymentAttempt>(params.attemptId);
    if (!attempt || attempt.purpose !== "cod_advance" || attempt.amount_paisa !== 20000 || attempt.currency !== "INR" ||
      attempt.razorpay_order_id !== params.razorpayOrderId) return { success: false, alreadyVerified: false };
    const order = await db.prepare("SELECT * FROM orders WHERE id = ? FOR UPDATE").get<DbOrder>(attempt.order_id);
    if (!order || order.payment_method !== "COD Advance" || order.current_payment_attempt_id !== attempt.id ||
      order.razorpay_order_id !== params.razorpayOrderId || Number(order.total) <= 200) {
      return { success: false, alreadyVerified: false };
    }
    if (attempt.payment_state === "captured") {
      return attempt.razorpay_payment_id === params.paymentId && order.payment_status === "partially_paid"
        ? { success: true, alreadyVerified: true }
        : { success: false, alreadyVerified: false };
    }
    if (order.payment_status !== "pending_advance" || order.order_status !== "pending_payment") {
      return { success: false, alreadyVerified: false };
    }

    const stockItems = await db.prepare(`SELECT product_id, size, quantity FROM order_items
      WHERE order_id = ? AND fulfillment_type = 'stock'
      ORDER BY product_id COLLATE "C", size COLLATE "C"`)
      .all<{ product_id: string; size: string; quantity: number }>(order.id);
    await lockInventoryVariants(db, stockItems.map(({ product_id, size }) => ({ productId: product_id, size })));
    for (const item of stockItems) {
      const deducted = await db.prepare(`UPDATE inventory SET stock = stock - ?, reserved = reserved - ?
        WHERE product_id = ? AND size = ? AND stock >= ? AND reserved >= ?`)
        .run(item.quantity, item.quantity, item.product_id, item.size, item.quantity, item.quantity);
      if (deducted.rowCount !== 1) throw new Error(`Inventory reservation missing for COD Advance order ${order.id}.`);
    }
    const now = new Date().toISOString();
    const captured = await db.prepare(`UPDATE razorpay_payment_attempts
      SET payment_state = 'captured', razorpay_payment_id = ?, reconciliation_note = NULL, updated_at = ?
      WHERE id = ? AND purpose = 'cod_advance' AND payment_state != 'captured'`)
      .run(params.paymentId, now, params.attemptId);
    if (captured.rowCount !== 1) throw new Error("Advance payment state changed during capture.");
    const transition = await db.prepare(`UPDATE orders SET payment_status = 'partially_paid',
      order_status = 'advance_paid', razorpay_payment_id = ?, razorpay_signature = COALESCE(?, razorpay_signature),
      is_confirmed = TRUE, updated_at = ? WHERE id = ? AND payment_status = 'pending_advance' AND order_status = 'pending_payment'`)
      .run(params.paymentId, params.signature ?? null, now, order.id);
    if (transition.rowCount !== 1) throw new Error(`COD Advance order state changed during capture for ${order.id}.`);
    await recordOrderStatusHistory(order.id, "pending_payment", "advance_paid", "razorpay", "₹200 COD Advance verified", db);
    await logPaymentAudit(order.id, "cod_advance_verified", {
      attemptId: params.attemptId, paymentId: params.paymentId,
      advanceAmount: 200, balanceDue: Number(order.total) - 200,
    }, db);
    return { success: true, alreadyVerified: false };
  });
}

async function populateOrderRelations(order: DbOrder): Promise<OrderWithDetails> {
  const db = getDb();
  const items = await db
    .prepare("SELECT * FROM order_items WHERE order_id = ?")
    .all<DbOrderItem>(order.id);
  const address = (await db
    .prepare("SELECT * FROM order_addresses WHERE order_id = ?")
    .get<DbOrderAddress>(order.id)) || null;
  const history = await db
    .prepare("SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC")
    .all<DbOrderStatusHistory>(order.id);
  const shipping_events = await db
    .prepare("SELECT * FROM shipping_events WHERE order_id = ? ORDER BY occurred_at ASC")
    .all<DbShippingEvent>(order.id);
  const refunds = await db
    .prepare("SELECT * FROM refund_records WHERE order_id = ? ORDER BY created_at DESC")
    .all<DbRefundRecord>(order.id);
  const payment_attempts = await db
    .prepare("SELECT * FROM razorpay_payment_attempts WHERE order_id = ? ORDER BY attempt_number ASC")
    .all<DbRazorpayPaymentAttempt>(order.id);

  const returnRows = await db
    .prepare("SELECT * FROM returns WHERE order_id = ? ORDER BY created_at DESC")
    .all<DbReturn>(order.id);
  const returns = await Promise.all(returnRows.map(async (ret) => {
    const returnItems = await db
      .prepare("SELECT * FROM return_items WHERE return_id = ?")
      .all<DbReturnItem>(ret.id);
    return { ...ret, items: returnItems };
  }));

  return {
    ...order,
    items,
    address,
    history,
    shipping_events,
    returns,
    refunds,
    payment_attempts,
  };
}

export async function getOrderById(orderId: string): Promise<OrderWithDetails | null> {
  const db = getDb();
  const order = await db.prepare("SELECT * FROM orders WHERE id = ?").get<DbOrder>(orderId);
  if (!order) return null;
  return populateOrderRelations(order);
}

export async function getOrderByRazorpayOrderId(rzpOrderId: string): Promise<OrderWithDetails | null> {
  const db = getDb();
  const order = await db
    .prepare("SELECT * FROM orders WHERE razorpay_order_id = ?")
    .get<DbOrder>(rzpOrderId);
  if (!order) return null;
  return populateOrderRelations(order);
}

export async function getOrderByNumber(orderNumber: string): Promise<OrderWithDetails | null> {
  const db = getDb();
  const order = await db
    .prepare("SELECT * FROM orders WHERE order_number = ?")
    .get<DbOrder>(orderNumber);
  if (!order) return null;
  return populateOrderRelations(order);
}

export async function getOrdersByEmail(email: string): Promise<OrderWithDetails[]> {
  const db = getDb();
  const orders = await db
    .prepare("SELECT * FROM orders WHERE customer_email = ? AND is_confirmed = TRUE AND (payment_status NOT IN ('pending_payment', 'pending_advance') OR payment_method IN ('COD', 'Cash on Delivery')) ORDER BY created_at DESC")
    .all<DbOrder>(email.toLowerCase().trim());

  return Promise.all(orders.map(populateOrderRelations));
}

export async function getOrdersByCustomer(userId: string, email: string): Promise<OrderWithDetails[]> {
  const db = getDb();
  const orders = await db
    .prepare(`
      SELECT * FROM orders
      WHERE (user_id = ? OR lower(customer_email) = ?) AND is_confirmed = TRUE
        AND (payment_status NOT IN ('pending_payment', 'pending_advance') OR payment_method IN ('COD', 'Cash on Delivery'))
      ORDER BY created_at DESC
    `)
    .all<DbOrder>(userId, email.toLowerCase().trim());

  const populated = await Promise.all(orders.map(populateOrderRelations));
  return populated.map(stripGuestToken) as OrderWithDetails[];
}

export async function getAllOrders(): Promise<OrderWithDetails[]> {
  const db = getDb();
  const orders = await db.prepare("SELECT * FROM orders WHERE is_confirmed = TRUE AND (payment_status NOT IN ('pending_payment', 'pending_advance') OR payment_method IN ('COD', 'Cash on Delivery')) ORDER BY created_at DESC").all<DbOrder>();

  return Promise.all(orders.map(populateOrderRelations));
}

/**
 * Idempotently mark order as paid.
 * Returns true if transition occurred, or true if already paid.
 */
export async function markOrderAsPaid(
  orderId: string,
  razorpayPaymentId: string,
  expectedRazorpayOrderId: string,
  razorpaySignature?: string
): Promise<{ success: boolean; alreadyPaid: boolean }> {
  return withTransaction(async (db) => {
  const current = await db.prepare("SELECT * FROM orders WHERE id = ? FOR UPDATE").get<DbOrder>(orderId);
  if (!current) return { success: false, alreadyPaid: false };
  if (current.payment_method === "COD Advance") return { success: false, alreadyPaid: false };
  if (current.razorpay_order_id !== expectedRazorpayOrderId) return { success: false, alreadyPaid: false };
  if (current.payment_status === "paid") {
    return current.razorpay_payment_id === razorpayPaymentId
      ? { success: true, alreadyPaid: true }
      : { success: false, alreadyPaid: true };
  }
  if (current.payment_status !== "pending_payment" || current.order_status !== "pending_payment") {
    return { success: false, alreadyPaid: false };
  }

  // Deduct inventory
  const items = await db
    .prepare('SELECT product_id, size, quantity FROM order_items WHERE order_id = ? AND fulfillment_type = \'stock\' ORDER BY product_id COLLATE "C", size COLLATE "C"')
    .all<{ product_id: string; size: string; quantity: number }>(orderId);
    await lockInventoryVariants(db, items.map(({ product_id, size }) => ({ productId: product_id, size })));

  for (const item of items) {
    const deduction = await db.prepare(`
      UPDATE inventory
      SET stock = stock - ?, reserved = reserved - ?
      WHERE product_id = ? AND size = ? AND stock >= ? AND reserved >= ?
    `).run(item.quantity, item.quantity, item.product_id, item.size, item.quantity, item.quantity);
    if (deduction.rowCount !== 1) {
      throw new Error(`Inventory reservation missing for paid order ${orderId}.`);
    }
  }

  const now = new Date().toISOString();
  const transition = await db.prepare(`
    UPDATE orders
    SET payment_status = 'paid',
        order_status = 'paid',
        is_confirmed = TRUE,
        razorpay_payment_id = ?,
        razorpay_signature = COALESCE(?, razorpay_signature),
        updated_at = ?
    WHERE id = ? AND payment_status = 'pending_payment' AND order_status = 'pending_payment'
  `).run(razorpayPaymentId, razorpaySignature || null, now, orderId);
  if (transition.rowCount !== 1) throw new Error(`Order payment state changed during capture for ${orderId}.`);

  return { success: true, alreadyPaid: false };
  });
}

export async function logPaymentAudit(
  orderId: string | null,
  eventType: string,
  payload: unknown,
  connection?: DbConnection
): Promise<void> {
  const db = connection ?? getDb();
  const auditId = `aud_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  await db.prepare(`
    INSERT INTO payment_audits (id, order_id, event_type, payload, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(auditId, orderId || null, eventType, JSON.stringify(payload), new Date().toISOString());
}

export async function recordPaymentAttemptFailure(
  orderId: string,
  paymentId: string,
  reason: string
): Promise<void> {
  await logPaymentAudit(orderId, "payment_attempt_failed", { paymentId, reason });
}

/**
 * Record a shipping timeline event (e.g. Dispatched, Out for Delivery, Delivered)
 */
export async function addShippingEvent(params: {
  orderId: string;
  status: string;
  location?: string | null;
  description: string;
  occurredAt?: string;
}): Promise<DbShippingEvent> {
  const db = getDb();
  const id = `shpe_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const occurredAt = params.occurredAt || new Date().toISOString();
  const createdAt = new Date().toISOString();

  await db.prepare(`
    INSERT INTO shipping_events (id, order_id, status, location, description, occurred_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.orderId,
    params.status,
    params.location || null,
    params.description,
    occurredAt,
    createdAt
  );

  return {
    id,
    order_id: params.orderId,
    status: params.status,
    location: params.location || null,
    description: params.description,
    courier_name: null,
    tracking_number: null,
    occurred_at: occurredAt,
    created_at: createdAt,
  };
}

/**
 * Record a status change in order_status_history
 */
export async function recordOrderStatusHistory(
  orderId: string,
  fromStatus: string | null,
  toStatus: string,
  actor: string,
  note?: string | null,
  connection?: DbConnection
): Promise<void> {
  const db = connection ?? getDb();
  const id = `osh_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  await db.prepare(`
    INSERT INTO order_status_history (id, order_id, from_status, to_status, actor, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, orderId, fromStatus, toStatus, actor, note || null, new Date().toISOString());
}

/**
 * Customer requests cancellation.
 * Allowed when order is pending_payment, paid, or processing (within policy).
 */
export async function requestOrderCancellation(orderId: string, reason: string): Promise<{ success: boolean; error?: string }> {
  return withTransaction(async (db) => {
    const order = await db.prepare("SELECT * FROM orders WHERE id = ? FOR UPDATE").get<DbOrder>(orderId);
    if (!order) return { success: false, error: "Order not found." };
    if (hasUnresolvedShiprocketOperation(order.shiprocket_state)) {
      return { success: false, error: "Shipment operation is in progress or requires reconciliation. Resolve it before requesting cancellation." };
    }
    if (order.cancellation_requested) {
      return { success: false, error: "Cancellation has already been requested for this order." };
    }
    if (["shipped", "delivered", "cancelled", "refunded"].includes(order.order_status)) {
      return { success: false, error: `Order cannot be cancelled in '${order.order_status}' status.` };
    }

    const now = new Date().toISOString();
    await db.prepare(`
      UPDATE orders
      SET cancellation_requested = 1,
          cancellation_requested_at = ?,
          cancellation_reason = ?,
          updated_at = ?
      WHERE id = ?
    `).run(now, reason, now, orderId);

    await recordOrderStatusHistory(
      orderId,
      order.order_status,
      order.order_status,
      order.customer_email,
      `Customer requested cancellation: ${reason}`,
      db
    );

    return { success: true };
  });
}

/**
 * Admin decides on cancellation request (approve or reject).
 * If approved:
 * - If unpaid: order marked cancelled, reserved inventory released.
 * - If prepaid: order marked refund_pending and inventory returned to stock.
 * - If COD Advance was captured: order is cancelled without refund and inventory is returned to stock.
 */
export async function decideOrderCancellation(
  orderId: string,
  approved: boolean,
  actorEmail: string,
  adminNote?: string
): Promise<{ success: boolean; newStatus?: string; error?: string }> {
  return withTransaction(async (db) => {
    const order = await db.prepare("SELECT * FROM orders WHERE id = ? FOR UPDATE").get<DbOrder>(orderId);
    if (!order) return { success: false, error: "Order not found." };
    if (!order.cancellation_requested) {
      return { success: false, error: "There is no pending cancellation request for this order." };
    }
    if (approved && hasUnresolvedShiprocketOperation(order.shiprocket_state)) {
      return { success: false, error: "Shipment operation is in progress or requires reconciliation. Resolve it before approving cancellation." };
    }

    const now = new Date().toISOString();
    if (!approved) {
      await db.prepare(`
        UPDATE orders SET cancellation_requested = 0, updated_at = ? WHERE id = ?
      `).run(now, orderId);
      await recordOrderStatusHistory(
        orderId,
        order.order_status,
        order.order_status,
        actorEmail,
        `Cancellation rejected by admin. Note: ${adminNote || "None"}`,
        db
      );
      return { success: true, newStatus: order.order_status };
    }

    const isPaid = order.payment_status === "paid" || order.payment_status === "partially_paid";
    const newStatus = getCancellationResultStatus(order.payment_method, order.payment_status);
    await db.prepare(`
      UPDATE orders
      SET order_status = ?,
          cancellation_requested = 0,
          cancelled_reason = ?,
          updated_at = ?
      WHERE id = ?
    `).run(newStatus, order.cancellation_reason || adminNote || "Approved cancellation", now, orderId);

    const items = await db
    .prepare('SELECT product_id, size, quantity FROM order_items WHERE order_id = ? AND fulfillment_type = \'stock\' ORDER BY product_id COLLATE "C", size COLLATE "C"')
      .all<{ product_id: string; size: string; quantity: number }>(orderId);
    await lockInventoryVariants(db, items.map(({ product_id, size }) => ({ productId: product_id, size })));

    for (const item of items) {
      const result = isPaid
        ? await db.prepare(`
            UPDATE inventory SET stock = stock + ?
            WHERE product_id = ? AND size = ?
          `).run(item.quantity, item.product_id, item.size)
        : await db.prepare(`
            UPDATE inventory SET reserved = GREATEST(0, reserved - ?)
            WHERE product_id = ? AND size = ?
          `).run(item.quantity, item.product_id, item.size);
      if (result.rowCount !== 1) throw new Error("Inventory row missing while processing order cancellation.");
    }

    await recordOrderStatusHistory(
      orderId,
      order.order_status,
      newStatus,
      actorEmail,
      `Cancellation approved by admin. ${adminNote ? "Note: " + adminNote : ""}`,
      db
    );
    return { success: true, newStatus };
  });
}

/**
 * Customer submits return or exchange request.
 * Validates the configured return window and prevents returning more items than purchased.
 */
export async function requestReturnOrExchange(params: {
  orderId: string;
  type: "return" | "exchange";
  reason: string;
  customerNote?: string;
  items: Array<{
    orderItemId: string;
    quantity: number;
    requestedExchangeSize?: string;
  }>;
}): Promise<{ success: boolean; returnId?: string; error?: string }> {
  if (!params.items?.length) {
    return { success: false, error: "Please select at least one item to return or exchange." };
  }
  if (new Set(params.items.map((item) => item.orderItemId)).size !== params.items.length) {
    return { success: false, error: "Each order item may only be listed once." };
  }

  return withTransaction(async (db) => {
    const order = await db.prepare("SELECT * FROM orders WHERE id = ? FOR UPDATE")
      .get<DbOrder>(params.orderId);
    if (!order) return { success: false, error: "Order not found." };
    if (order.order_status !== "delivered") {
      return { success: false, error: "Returns and exchanges can only be requested for delivered orders." };
    }

    const deliveryTime = new Date(order.actual_delivery_date || order.updated_at).getTime();
    const daysSinceDelivery = (Date.now() - deliveryTime) / (1000 * 60 * 60 * 24);
    if (!Number.isFinite(deliveryTime) || daysSinceDelivery > STORE_POLICIES.returns.windowDays) {
      return { success: false, error: `Return window has expired (${STORE_POLICIES.returns.windowDays} days policy).` };
    }

    const validatedItems: Array<{ request: typeof params.items[number]; orderItem: DbOrderItem }> = [];
    let totalRefundAmount = 0;
    for (const reqItem of params.items) {
      if (!Number.isInteger(reqItem.quantity) || reqItem.quantity <= 0) {
        return { success: false, error: "Return quantity must be at least 1." };
      }
      const orderItem = await db.prepare(
        "SELECT * FROM order_items WHERE id = ? AND order_id = ? FOR UPDATE"
      ).get<DbOrderItem>(reqItem.orderItemId, params.orderId);
      if (!orderItem) return { success: false, error: "An order item was not found." };

      const returned = await db.prepare(`
        SELECT COALESCE(SUM(ri.quantity), 0) AS total_returned
        FROM return_items ri
        JOIN returns r ON ri.return_id = r.id
        WHERE ri.order_item_id = ? AND r.status NOT IN ('rejected', 'cancelled')
      `).get<{ total_returned: number | string }>(reqItem.orderItemId);
      const remaining = orderItem.quantity - Number(returned?.total_returned ?? 0);
      if (reqItem.quantity > remaining) {
        return {
          success: false,
          error: `Cannot return ${reqItem.quantity} units of ${orderItem.product_name} (${orderItem.size}). Only ${remaining} eligible units remaining.`,
        };
      }
      validatedItems.push({ request: reqItem, orderItem });
      totalRefundAmount += orderItem.price * reqItem.quantity;
    }

    const returnId = `ret_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const returnNumber = `RET-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const now = new Date().toISOString();
    await db.prepare(`
      INSERT INTO returns (
        id, order_id, return_number, customer_email, type, status, reason, customer_note, admin_note,
        resolution_type, refund_amount, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'requested', ?, ?, NULL, ?, ?, ?, ?)
    `).run(
      returnId,
      params.orderId,
      returnNumber,
      order.customer_email,
      params.type,
      params.reason,
      params.customerNote || null,
      params.type === "exchange" ? "exchange" : "refund",
      params.type === "exchange" ? 0 : totalRefundAmount,
      now,
      now
    );

    const insertItem = db.prepare(`
      INSERT INTO return_items (
        id, return_id, order_item_id, product_id, product_name, product_slug, color, size,
        quantity, price, requested_exchange_size, condition, restocked, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?)
    `);
    for (const { request, orderItem } of validatedItems) {
      await insertItem.run(
        `reti_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
        returnId,
        request.orderItemId,
        orderItem.product_id,
        orderItem.product_name,
        orderItem.product_slug,
        orderItem.color || "As pictured",
        orderItem.size,
        request.quantity,
        orderItem.price,
        request.requestedExchangeSize || null,
        now
      );
    }
    await recordOrderStatusHistory(
      params.orderId,
      order.order_status,
      order.order_status,
      order.customer_email,
      `${params.type === "exchange" ? "Exchange" : "Return"} requested for order (${returnId}). Reason: ${params.reason}`,
      db
    );
    return { success: true, returnId };
  });
}

/**
 * Admin inspects return items and decides restocking condition.
 */
export async function inspectReturnItem(params: {
  returnItemId: string;
  condition: "resalable" | "damaged" | "unsuitable";
  actorEmail: string;
}): Promise<{ success: boolean; error?: string }> {
  return withTransaction(async (db) => {
    const item = await db.prepare("SELECT * FROM return_items WHERE id = ? FOR UPDATE")
      .get<DbReturnItem>(params.returnItemId);
    if (!item) return { success: false, error: "Return item not found." };

    let restocked = item.restocked;
    if (params.condition === "resalable" && !item.restocked && item.product_id !== "rnl-custom-quote-tee") {
      await db.prepare(`
        INSERT INTO inventory (product_id, size, stock, reserved)
        VALUES (?, ?, ?, 0)
        ON CONFLICT (product_id, size)
        DO UPDATE SET stock = inventory.stock + EXCLUDED.stock
      `).run(item.product_id, item.size, item.quantity);
      restocked = 1;
    }

    await db.prepare(`
      UPDATE return_items SET condition = ?, restocked = ? WHERE id = ?
    `).run(params.condition, restocked, params.returnItemId);
    return { success: true };
  });
}

/**
 * Record a refund record in the database
 */
export async function recordRefund(params: {
  orderId: string;
  returnId?: string | null;
  razorpayRefundId?: string | null;
  razorpayPaymentId?: string | null;
  amount: number;
  status: "pending" | "processed" | "failed";
  reason: string;
  initiatedBy: string;
  failureReason?: string | null;
  idempotencyKey?: string;
  connection?: DbConnection;
}): Promise<DbRefundRecord> {
  const db = params.connection ?? getDb();
  const id = `ref_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const now = new Date().toISOString();
  const amountPaisa = Math.round(params.amount * 100);
  const paymentId = params.razorpayPaymentId || "manual_unpaid_reversal";
  const idempotencyKey = params.idempotencyKey || `idemp_${id}`;

  const saved = await db.prepare(`
    INSERT INTO refund_records (
      id, order_id, return_id, razorpay_refund_id, razorpay_payment_id,
      amount, amount_paisa, currency, status, reason, idempotency_key, initiated_by, failure_reason,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'INR', ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (idempotency_key) DO UPDATE SET
      return_id = COALESCE(EXCLUDED.return_id, refund_records.return_id),
      razorpay_refund_id = COALESCE(EXCLUDED.razorpay_refund_id, refund_records.razorpay_refund_id),
      status = CASE WHEN refund_records.status IN ('processed', 'failed') THEN refund_records.status ELSE EXCLUDED.status END,
      reason = COALESCE(refund_records.reason, EXCLUDED.reason),
      initiated_by = COALESCE(EXCLUDED.initiated_by, refund_records.initiated_by),
      failure_reason = COALESCE(EXCLUDED.failure_reason, refund_records.failure_reason),
      updated_at = EXCLUDED.updated_at
    WHERE refund_records.order_id = EXCLUDED.order_id
      AND refund_records.razorpay_payment_id = EXCLUDED.razorpay_payment_id
      AND refund_records.amount_paisa = EXCLUDED.amount_paisa
    RETURNING *
  `).get<DbRefundRecord>(
    id,
    params.orderId,
    params.returnId || null,
    params.razorpayRefundId || null,
    paymentId,
    params.amount,
    amountPaisa,
    params.status,
    params.reason,
    idempotencyKey,
    params.initiatedBy,
    params.failureReason || null,
    now,
    now
  );

  if (!saved) throw new Error("Refund idempotency key conflicts with different refund details.");
  return saved;
}

/** Reserve refundable balance under an order row lock before calling Razorpay. */
export async function reserveRefund(params: {
  orderId: string;
  returnId?: string | null;
  paymentId: string;
  amount: number;
  reason: string;
  initiatedBy: string;
}): Promise<{ reservation: DbRefundRecord | null; reason?: "pending" | "exceeds_balance" | "order_changed" }> {
  return withTransaction(async (db) => {
    const order = await db.prepare("SELECT id, payment_status, payment_method, razorpay_payment_id, total, shiprocket_state FROM orders WHERE id = ? FOR UPDATE")
      .get<{ id: string; payment_status: string; payment_method: string; razorpay_payment_id: string | null; total: number; shiprocket_state: string | null }>(params.orderId);
    if (!order || order.payment_status !== "paid" || order.payment_method === "COD Advance" || order.razorpay_payment_id !== params.paymentId) {
      return { reservation: null, reason: "order_changed" };
    }
    if (hasUnresolvedShiprocketOperation(order.shiprocket_state)) return { reservation: null, reason: "order_changed" };
    const webhookEvent = await db.prepare(`SELECT event_key FROM razorpay_refund_webhook_inbox
      WHERE (order_id = ? OR payment_id = ?) AND state IN ('received', 'deferred', 'quarantined') LIMIT 1`)
      .get<{ event_key: string }>(params.orderId, params.paymentId);
    if (webhookEvent) return { reservation: null, reason: "order_changed" };
    const existing = await db.prepare("SELECT id FROM refund_records WHERE order_id = ? AND status = 'pending' LIMIT 1")
      .get<{ id: string }>(params.orderId);
    if (existing) return { reservation: null, reason: "pending" };

    const totals = await db.prepare(`SELECT COALESCE(SUM(amount_paisa), 0) AS total FROM refund_records
      WHERE order_id = ? AND status IN ('pending', 'processed')`).get<{ total: string | number }>(params.orderId);
    const available = Math.round(Number(order.total) * 100) - Number(totals?.total ?? 0);
    const amountPaisa = Math.round(params.amount * 100);
    if (amountPaisa > available) return { reservation: null, reason: "exceeds_balance" };

    const idempotencyKey = `admin_refund_${randomUUID()}`;
    const reservation = await recordRefund({
      orderId: params.orderId, returnId: params.returnId, razorpayPaymentId: params.paymentId,
      amount: params.amount, status: "pending", reason: params.reason, initiatedBy: params.initiatedBy,
      idempotencyKey, connection: db,
    });
    await db.prepare("UPDATE orders SET refund_status = CASE WHEN refund_status IN ('partially_refunded', 'refunded') THEN refund_status ELSE 'pending' END, updated_at = ? WHERE id = ?")
      .run(new Date().toISOString(), params.orderId);
    return { reservation };
  });
}

export async function applyRefundReconciliation(params: {
  orderId: string;
  refundRecordId: string;
  providerRefundId: string;
  providerStatus: "processed" | "failed" | "pending";
  failureReason?: string;
}): Promise<{ outcome: "applied" | "unchanged" | "conflict" | "not_found" | "deferred"; refund?: DbRefundRecord }> {
  return withTransaction(async (db) => {
    const order = await db.prepare("SELECT * FROM orders WHERE id = ? FOR UPDATE").get<DbOrder>(params.orderId);
    if (!order) return { outcome: "not_found" };
    const refund = await db.prepare("SELECT * FROM refund_records WHERE id = ? AND order_id = ? FOR UPDATE")
      .get<DbRefundRecord>(params.refundRecordId, params.orderId);
    if (!refund) return { outcome: "not_found" };
    if (refund.status === "pending" && hasUnresolvedShiprocketOperation(order.shiprocket_state)) {
      return { outcome: "deferred", refund };
    }

    if (refund.status !== "pending") {
      if (refund.status === params.providerStatus && refund.razorpay_refund_id === params.providerRefundId) {
        return { outcome: "unchanged", refund };
      }
      return { outcome: "conflict", refund };
    }
    if (refund.razorpay_refund_id && refund.razorpay_refund_id !== params.providerRefundId) {
      return { outcome: "conflict", refund };
    }

    const updated = await db.prepare(`UPDATE refund_records SET
      razorpay_refund_id = ?, status = ?, failure_reason = ?, updated_at = ?
      WHERE id = ? AND order_id = ? AND status = 'pending'
      RETURNING *`).get<DbRefundRecord>(
      params.providerRefundId, params.providerStatus,
      params.providerStatus === "failed" ? params.failureReason || "Razorpay confirmed refund failure." : null,
      new Date().toISOString(), params.refundRecordId, params.orderId
    );
    if (!updated) return { outcome: "conflict", refund };

    const totals = await db.prepare(`SELECT COALESCE(SUM(amount_paisa), 0) AS total FROM refund_records
      WHERE order_id = ? AND status = 'processed'`).get<{ total: string | number }>(order.id);
    const processedTotal = Number(totals?.total ?? 0) / 100;
    const complete = shouldMarkOrderRefunded(order.payment_method, order.payment_status, processedTotal, order.total);
    const refundStatus = complete ? "refunded" : processedTotal > 0 ? "partially_refunded" : null;

    if (params.providerStatus === "processed") {
      await db.prepare(`UPDATE orders SET order_status = ?, refund_status = ?, refund_id = ?, updated_at = ? WHERE id = ?`)
        .run(complete ? "refunded" : order.order_status, refundStatus, params.providerRefundId, new Date().toISOString(), order.id);
      if (updated.return_id) {
        await db.prepare("UPDATE returns SET status = 'completed', updated_at = ? WHERE id = ?")
          .run(new Date().toISOString(), updated.return_id);
      }
    } else if (params.providerStatus === "failed") {
      await db.prepare(`UPDATE orders SET refund_status = ?, refund_id = ?, updated_at = ?
        WHERE id = ? AND refund_status = 'pending'`).run(
        refundStatus, complete ? order.refund_id : processedTotal > 0 ? order.refund_id : null,
        new Date().toISOString(), order.id
      );
    }

    return { outcome: "applied", refund: updated };
  });
}
