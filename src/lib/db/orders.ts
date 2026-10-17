import { randomUUID } from "crypto";
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
  OrderWithDetails,
} from "./index";

export function checkAndReserveInventory(
  items: Array<{ productId: string; size: string; quantity: number }>
): { ok: boolean; error?: string } {
  const db = getDb();
  for (const item of items) {
    const row = db
      .prepare("SELECT stock, reserved FROM inventory WHERE product_id = ? AND size = ?")
      .get(item.productId, item.size) as { stock: number; reserved: number } | undefined;

    if (!row) {
      // If product not explicitly in inventory, initialize with standard stock of 20
      db.prepare(
        "INSERT OR IGNORE INTO inventory (product_id, size, stock, reserved) VALUES (?, ?, 20, 0)"
      ).run(item.productId, item.size);
    } else {
      const available = row.stock - row.reserved;
      if (available < item.quantity) {
        return {
          ok: false,
          error: `Insufficient stock for product (${item.size}). Only ${Math.max(0, available)} available.`,
        };
      }
    }
  }

  // Reserve inventory for pending checkout
  for (const item of items) {
    db.prepare(`
      UPDATE inventory 
      SET reserved = reserved + ? 
      WHERE product_id = ? AND size = ?
    `).run(item.quantity, item.productId, item.size);
  }

  return { ok: true };
}

export function releaseInventoryReservation(
  items: Array<{ productId: string; size: string; quantity: number }>
) {
  const db = getDb();
  for (const item of items) {
    db.prepare(`
      UPDATE inventory 
      SET reserved = MAX(0, reserved - ?) 
      WHERE product_id = ? AND size = ?
    `).run(item.quantity, item.productId, item.size);
  }
}

export function commitInventoryDeduction(
  items: Array<{ productId: string; size: string; quantity: number }>
) {
  const db = getDb();
  for (const item of items) {
    db.prepare(`
      UPDATE inventory 
      SET stock = MAX(0, stock - ?), 
          reserved = MAX(0, reserved - ?) 
      WHERE product_id = ? AND size = ?
    `).run(item.quantity, item.quantity, item.productId, item.size);
  }
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
    size: string;
    price: number;
    quantity: number;
    image: string;
    sku: string;
    fit: string;
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

export function createPendingOrder(params: CreateOrderParams): {
  order: DbOrder;
  guestToken: string;
} {
  const db = getDb();
  const orderId = `ord_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const guestToken = randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO orders (
      id, order_number, customer_name, customer_email, customer_phone,
      subtotal, shipping, discount, total, payment_method, payment_status,
      order_status, razorpay_order_id, guest_token, user_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment', 'pending_payment', ?, ?, ?, ?, ?)
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
      color, size, price, quantity, image, sku, fit
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const item of params.items) {
    const itemId = `item_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    insertItem.run(
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
      item.fit
    );
  }

  // Insert delivery address
  const addrId = `addr_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  db.prepare(`
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

  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as DbOrder;
  return { order, guestToken };
}

export function updateOrderRazorpayId(orderId: string, razorpayOrderId: string) {
  const db = getDb();
  db.prepare("UPDATE orders SET razorpay_order_id = ?, updated_at = ? WHERE id = ?").run(
    razorpayOrderId,
    new Date().toISOString(),
    orderId
  );
}

function populateOrderRelations(order: DbOrder): OrderWithDetails {
  const db = getDb();
  const items = db
    .prepare("SELECT * FROM order_items WHERE order_id = ?")
    .all(order.id) as DbOrderItem[];
  const address = (db
    .prepare("SELECT * FROM order_addresses WHERE order_id = ?")
    .get(order.id) || null) as DbOrderAddress | null;
  const history = db
    .prepare("SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC")
    .all(order.id) as DbOrderStatusHistory[];
  const shipping_events = db
    .prepare("SELECT * FROM shipping_events WHERE order_id = ? ORDER BY occurred_at ASC")
    .all(order.id) as DbShippingEvent[];
  const refunds = db
    .prepare("SELECT * FROM refund_records WHERE order_id = ? ORDER BY created_at DESC")
    .all(order.id) as DbRefundRecord[];

  const returnRows = db
    .prepare("SELECT * FROM returns WHERE order_id = ? ORDER BY created_at DESC")
    .all(order.id) as DbReturn[];
  const returns = returnRows.map((ret) => {
    const returnItems = db
      .prepare("SELECT * FROM return_items WHERE return_id = ?")
      .all(ret.id) as DbReturnItem[];
    return { ...ret, items: returnItems };
  });

  return {
    ...order,
    items,
    address,
    history,
    shipping_events,
    returns,
    refunds,
  };
}

export function getOrderById(orderId: string): OrderWithDetails | null {
  const db = getDb();
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as DbOrder | undefined;
  if (!order) return null;
  return populateOrderRelations(order);
}

export function getOrderByRazorpayOrderId(rzpOrderId: string): OrderWithDetails | null {
  const db = getDb();
  const order = db
    .prepare("SELECT * FROM orders WHERE razorpay_order_id = ?")
    .get(rzpOrderId) as DbOrder | undefined;
  if (!order) return null;
  return populateOrderRelations(order);
}

export function getOrderByNumber(orderNumber: string): OrderWithDetails | null {
  const db = getDb();
  const order = db
    .prepare("SELECT * FROM orders WHERE order_number = ?")
    .get(orderNumber) as DbOrder | undefined;
  if (!order) return null;
  return populateOrderRelations(order);
}

export function getOrdersByEmail(email: string): OrderWithDetails[] {
  const db = getDb();
  const orders = db
    .prepare("SELECT * FROM orders WHERE customer_email = ? ORDER BY created_at DESC")
    .all(email.toLowerCase().trim()) as DbOrder[];

  return orders.map((order) => populateOrderRelations(order));
}

export function getAllOrders(): OrderWithDetails[] {
  const db = getDb();
  const orders = db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all() as DbOrder[];

  return orders.map((order) => populateOrderRelations(order));
}

/**
 * Idempotently mark order as paid.
 * Returns true if transition occurred, or true if already paid.
 */
export function markOrderAsPaid(
  orderId: string,
  razorpayPaymentId: string,
  razorpaySignature?: string
): { success: boolean; alreadyPaid: boolean } {
  const db = getDb();
  const current = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as DbOrder | undefined;
  if (!current) {
    return { success: false, alreadyPaid: false };
  }

  if (current.payment_status === "paid") {
    return { success: true, alreadyPaid: true };
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE orders 
    SET payment_status = 'paid',
        order_status = 'paid',
        razorpay_payment_id = ?,
        razorpay_signature = COALESCE(?, razorpay_signature),
        updated_at = ?
    WHERE id = ?
  `).run(razorpayPaymentId, razorpaySignature || null, now, orderId);

  // Deduct inventory
  const items = db
    .prepare("SELECT product_id, size, quantity FROM order_items WHERE order_id = ?")
    .all(orderId) as Array<{ product_id: string; size: string; quantity: number }>;

  commitInventoryDeduction(
    items.map((i) => ({ productId: i.product_id, size: i.size, quantity: i.quantity }))
  );

  return { success: true, alreadyPaid: false };
}

export function markOrderPaymentFailed(orderId: string, reason?: string) {
  const db = getDb();
  const current = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as DbOrder | undefined;
  if (!current || current.payment_status === "paid") return;

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE orders 
    SET payment_status = 'payment_failed',
        order_status = 'payment_failed',
        updated_at = ?
    WHERE id = ?
  `).run(now, orderId);

  // Release reserved inventory
  const items = db
    .prepare("SELECT product_id, size, quantity FROM order_items WHERE order_id = ?")
    .all(orderId) as Array<{ product_id: string; size: string; quantity: number }>;

  releaseInventoryReservation(
    items.map((i) => ({ productId: i.product_id, size: i.size, quantity: i.quantity }))
  );

  logPaymentAudit(orderId, "payment_failed", { reason: reason || "Payment failed or cancelled" });
}

export function logPaymentAudit(orderId: string | null, eventType: string, payload: unknown) {
  try {
    const db = getDb();
    const auditId = `aud_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    db.prepare(`
      INSERT INTO payment_audits (id, order_id, event_type, payload, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(auditId, orderId || null, eventType, JSON.stringify(payload), new Date().toISOString());
  } catch (err) {
    console.error("Failed to log payment audit:", err);
  }
}

/**
 * Record a shipping timeline event (e.g. Dispatched, Out for Delivery, Delivered)
 */
export function addShippingEvent(params: {
  orderId: string;
  status: string;
  location?: string | null;
  description: string;
  occurredAt?: string;
}): DbShippingEvent {
  const db = getDb();
  const id = `shpe_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const occurredAt = params.occurredAt || new Date().toISOString();
  const createdAt = new Date().toISOString();

  db.prepare(`
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
    occurred_at: occurredAt,
    created_at: createdAt,
  };
}

/**
 * Record a status change in order_status_history
 */
export function recordOrderStatusHistory(
  orderId: string,
  fromStatus: string | null,
  toStatus: string,
  actor: string,
  note?: string | null
) {
  const db = getDb();
  const id = `osh_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  db.prepare(`
    INSERT INTO order_status_history (id, order_id, from_status, to_status, actor, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, orderId, fromStatus, toStatus, actor, note || null, new Date().toISOString());
}

/**
 * Customer requests cancellation.
 * Allowed when order is pending_payment, paid, or processing (within policy).
 */
export function requestOrderCancellation(orderId: string, reason: string): { success: boolean; error?: string } {
  const db = getDb();
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as DbOrder | undefined;
  if (!order) {
    return { success: false, error: "Order not found." };
  }

  if (order.cancellation_requested) {
    return { success: false, error: "Cancellation has already been requested for this order." };
  }

  if (["shipped", "delivered", "cancelled", "refunded"].includes(order.order_status)) {
    return { success: false, error: `Order cannot be cancelled in '${order.order_status}' status.` };
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE orders
    SET cancellation_requested = 1,
        cancellation_requested_at = ?,
        cancellation_reason = ?,
        updated_at = ?
    WHERE id = ?
  `).run(now, reason, now, orderId);

  recordOrderStatusHistory(
    orderId,
    order.order_status,
    order.order_status,
    order.customer_email,
    `Customer requested cancellation: ${reason}`
  );

  return { success: true };
}

/**
 * Admin decides on cancellation request (approve or reject).
 * If approved:
 * - If unpaid: order marked cancelled, reserved inventory released.
 * - If paid: order marked cancelled, order_status becomes refund_pending, inventory returned to stock.
 */
export function decideOrderCancellation(
  orderId: string,
  approved: boolean,
  actorEmail: string,
  adminNote?: string
): { success: boolean; newStatus?: string; error?: string } {
  const db = getDb();
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as DbOrder | undefined;
  if (!order) {
    return { success: false, error: "Order not found." };
  }

  const now = new Date().toISOString();

  if (!approved) {
    db.prepare(`
      UPDATE orders
      SET cancellation_requested = 0,
          updated_at = ?
      WHERE id = ?
    `).run(now, orderId);

    recordOrderStatusHistory(
      orderId,
      order.order_status,
      order.order_status,
      actorEmail,
      `Cancellation rejected by admin. Note: ${adminNote || "None"}`
    );

    return { success: true, newStatus: order.order_status };
  }

  // Approved cancellation
  const isPaid = order.payment_status === "paid";
  const newStatus = isPaid ? "refund_pending" : "cancelled";

  db.prepare(`
    UPDATE orders
    SET order_status = ?,
        cancellation_requested = 0,
        cancelled_reason = ?,
        updated_at = ?
    WHERE id = ?
  `).run(newStatus, order.cancellation_reason || adminNote || "Approved cancellation", now, orderId);

  // Inventory handling
  const items = db
    .prepare("SELECT product_id, size, quantity FROM order_items WHERE order_id = ?")
    .all(orderId) as Array<{ product_id: string; size: string; quantity: number }>;

  if (isPaid) {
    // Inventory was committed on payment; restock items
    for (const item of items) {
      db.prepare(`
        UPDATE inventory
        SET stock = stock + ?
        WHERE product_id = ? AND size = ?
      `).run(item.quantity, item.product_id, item.size);
    }
  } else {
    // Release reservation
    releaseInventoryReservation(
      items.map((i) => ({ productId: i.product_id, size: i.size, quantity: i.quantity }))
    );
  }

  recordOrderStatusHistory(
    orderId,
    order.order_status,
    newStatus,
    actorEmail,
    `Cancellation approved by admin. ${adminNote ? "Note: " + adminNote : ""}`
  );

  return { success: true, newStatus };
}

/**
 * Customer submits return or exchange request.
 * Validates 7-day window and prevents returning more items than purchased.
 */
export function requestReturnOrExchange(params: {
  orderId: string;
  type: "return" | "exchange";
  reason: string;
  customerNote?: string;
  items: Array<{
    orderItemId: string;
    quantity: number;
    requestedExchangeSize?: string;
  }>;
}): { success: boolean; returnId?: string; error?: string } {
  const db = getDb();
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(params.orderId) as DbOrder | undefined;
  if (!order) {
    return { success: false, error: "Order not found." };
  }

  if (order.order_status !== "delivered") {
    return { success: false, error: "Returns and exchanges can only be requested for delivered orders." };
  }

  // Check 7-day window based on actual_delivery_date or updated_at
  const deliveryDateStr = order.actual_delivery_date || order.updated_at;
  const deliveryTime = new Date(deliveryDateStr).getTime();
  const nowMs = Date.now();
  const daysSinceDelivery = (nowMs - deliveryTime) / (1000 * 60 * 60 * 24);

  if (daysSinceDelivery > 7) {
    return { success: false, error: "Return window has expired (7 days policy)." };
  }

  if (!params.items || params.items.length === 0) {
    return { success: false, error: "Please select at least one item to return or exchange." };
  }

  // Check quantities against purchased and existing returns
  let totalRefundAmount = 0;

  for (const reqItem of params.items) {
    const orderItem = db
      .prepare("SELECT * FROM order_items WHERE id = ? AND order_id = ?")
      .get(reqItem.orderItemId, params.orderId) as DbOrderItem | undefined;

    if (!orderItem) {
      return { success: false, error: `Invalid order item ${reqItem.orderItemId}.` };
    }

    if (reqItem.quantity <= 0) {
      return { success: false, error: "Return quantity must be at least 1." };
    }

    // Sum already returned or active return quantities for this order item
    const existingReturnedRow = db
      .prepare(`
        SELECT COALESCE(SUM(ri.quantity), 0) as total_returned
        FROM return_items ri
        JOIN returns r ON ri.return_id = r.id
        WHERE ri.order_item_id = ? AND r.status NOT IN ('rejected', 'cancelled')
      `)
      .get(reqItem.orderItemId) as { total_returned: number };

    const remainingAvailable = orderItem.quantity - existingReturnedRow.total_returned;
    if (reqItem.quantity > remainingAvailable) {
      return {
        success: false,
        error: `Cannot return ${reqItem.quantity} units of ${orderItem.product_name} (${orderItem.size}). Only ${remainingAvailable} eligible units remaining.`,
      };
    }

    totalRefundAmount += orderItem.price * reqItem.quantity;
  }

  const returnId = `ret_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const returnNumber = `RET-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString();

  db.prepare(`
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

  const insertItemStmt = db.prepare(`
    INSERT INTO return_items (
      id, return_id, order_item_id, product_id, product_name, product_slug, color, size,
      quantity, price, requested_exchange_size, condition, restocked, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?)
  `);

  for (const reqItem of params.items) {
    const orderItem = db
      .prepare("SELECT * FROM order_items WHERE id = ?")
      .get(reqItem.orderItemId) as DbOrderItem;

    const returnItemId = `reti_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    insertItemStmt.run(
      returnItemId,
      returnId,
      reqItem.orderItemId,
      orderItem.product_id,
      orderItem.product_name,
      orderItem.product_slug,
      orderItem.color || "As pictured",
      orderItem.size,
      reqItem.quantity,
      orderItem.price,
      reqItem.requestedExchangeSize || null,
      now
    );
  }

  recordOrderStatusHistory(
    params.orderId,
    order.order_status,
    order.order_status,
    order.customer_email,
    `${params.type === "exchange" ? "Exchange" : "Return"} requested for order (${returnId}). Reason: ${params.reason}`
  );

  return { success: true, returnId };
}

/**
 * Admin inspects return items and decides restocking condition.
 */
export function inspectReturnItem(params: {
  returnItemId: string;
  condition: "resalable" | "damaged" | "unsuitable";
  actorEmail: string;
}): { success: boolean; error?: string } {
  const db = getDb();
  const item = db
    .prepare("SELECT * FROM return_items WHERE id = ?")
    .get(params.returnItemId) as DbReturnItem | undefined;

  if (!item) {
    return { success: false, error: "Return item not found." };
  }

  // Restock if resalable and not already restocked
  let restocked = item.restocked;
  if (params.condition === "resalable" && !item.restocked) {
    db.prepare(`
      UPDATE inventory
      SET stock = stock + ?
      WHERE product_id = ? AND size = ?
    `).run(item.quantity, item.product_id, item.size);
    restocked = 1;
  }

  db.prepare(`
    UPDATE return_items
    SET condition = ?, restocked = ?
    WHERE id = ?
  `).run(params.condition, restocked, params.returnItemId);

  return { success: true };
}

/**
 * Record a refund record in the database
 */
export function recordRefund(params: {
  orderId: string;
  returnId?: string | null;
  razorpayRefundId?: string | null;
  razorpayPaymentId?: string | null;
  amount: number;
  status: "pending" | "processed" | "failed";
  reason: string;
  initiatedBy: string;
  failureReason?: string | null;
}): DbRefundRecord {
  const db = getDb();
  const id = `ref_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const now = new Date().toISOString();
  const amountPaisa = Math.round(params.amount * 100);
  const paymentId = params.razorpayPaymentId || "manual_unpaid_reversal";
  const idempotencyKey = `idemp_${id}`;

  db.prepare(`
    INSERT INTO refund_records (
      id, order_id, return_id, razorpay_refund_id, razorpay_payment_id,
      amount, amount_paisa, currency, status, reason, idempotency_key, initiated_by, failure_reason,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'INR', ?, ?, ?, ?, ?, ?, ?)
  `).run(
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

  return {
    id,
    order_id: params.orderId,
    return_id: params.returnId || null,
    razorpay_refund_id: params.razorpayRefundId || null,
    razorpay_payment_id: params.razorpayPaymentId || null,
    amount: params.amount,
    currency: "INR",
    status: params.status,
    reason: params.reason,
    initiated_by: params.initiatedBy,
    failure_reason: params.failureReason || null,
    created_at: now,
    updated_at: now,
  };
}
