import { randomUUID } from "crypto";
import { getDb, DbOrder, DbOrderItem, DbOrderAddress, OrderWithDetails } from "./index";

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

export function getOrderById(orderId: string): OrderWithDetails | null {
  const db = getDb();
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as DbOrder | undefined;
  if (!order) return null;

  const items = db
    .prepare("SELECT * FROM order_items WHERE order_id = ?")
    .all(orderId) as DbOrderItem[];
  const address = (db
    .prepare("SELECT * FROM order_addresses WHERE order_id = ?")
    .get(orderId) || null) as DbOrderAddress | null;

  return { ...order, items, address };
}

export function getOrderByRazorpayOrderId(rzpOrderId: string): OrderWithDetails | null {
  const db = getDb();
  const order = db
    .prepare("SELECT * FROM orders WHERE razorpay_order_id = ?")
    .get(rzpOrderId) as DbOrder | undefined;
  if (!order) return null;

  const items = db
    .prepare("SELECT * FROM order_items WHERE order_id = ?")
    .all(order.id) as DbOrderItem[];
  const address = (db
    .prepare("SELECT * FROM order_addresses WHERE order_id = ?")
    .get(order.id) || null) as DbOrderAddress | null;

  return { ...order, items, address };
}

export function getOrderByNumber(orderNumber: string): OrderWithDetails | null {
  const db = getDb();
  const order = db
    .prepare("SELECT * FROM orders WHERE order_number = ?")
    .get(orderNumber) as DbOrder | undefined;
  if (!order) return null;

  const items = db
    .prepare("SELECT * FROM order_items WHERE order_id = ?")
    .all(order.id) as DbOrderItem[];
  const address = (db
    .prepare("SELECT * FROM order_addresses WHERE order_id = ?")
    .get(order.id) || null) as DbOrderAddress | null;

  return { ...order, items, address };
}

export function getOrdersByEmail(email: string): OrderWithDetails[] {
  const db = getDb();
  const orders = db
    .prepare("SELECT * FROM orders WHERE customer_email = ? ORDER BY created_at DESC")
    .all(email.toLowerCase().trim()) as DbOrder[];

  return orders.map((order) => {
    const items = db
      .prepare("SELECT * FROM order_items WHERE order_id = ?")
      .all(order.id) as DbOrderItem[];
    const address = (db
      .prepare("SELECT * FROM order_addresses WHERE order_id = ?")
      .get(order.id) || null) as DbOrderAddress | null;
    return { ...order, items, address };
  });
}

export function getAllOrders(): OrderWithDetails[] {
  const db = getDb();
  const orders = db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all() as DbOrder[];

  return orders.map((order) => {
    const items = db
      .prepare("SELECT * FROM order_items WHERE order_id = ?")
      .all(order.id) as DbOrderItem[];
    const address = (db
      .prepare("SELECT * FROM order_addresses WHERE order_id = ?")
      .get(order.id) || null) as DbOrderAddress | null;
    return { ...order, items, address };
  });
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
