import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth/admin-auth";
import { getDb, DbOrder, DbOrderItem, DbOrderAddress, DbOrderStatusHistory } from "@/lib/db/index";
import { writeAuditLog } from "@/lib/db/audit";

export const dynamic = "force-dynamic";

function fetchOrderWithDetails(orderId: string) {
  const db = getDb();
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as DbOrder | undefined;
  if (!order) return null;
  const items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(orderId) as DbOrderItem[];
  const address = db.prepare("SELECT * FROM order_addresses WHERE order_id = ?").get(orderId) as DbOrderAddress | null;
  const history = db.prepare("SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC").all(orderId) as DbOrderStatusHistory[];
  return { ...order, items, address, history };
}

/** GET /api/admin/orders/[id] */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = requireAdminAuth(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const order = fetchOrderWithDetails(id);
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  return NextResponse.json({ order });
}

/** PATCH /api/admin/orders/[id] — update tracking info, dates, and/or notes */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = requireAdminAuth(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const existing = db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as DbOrder | undefined;
  if (!existing) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  const body = await req.json();
  const {
    courier_name,
    tracking_number,
    tracking_url,
    dispatch_date,
    estimated_delivery_date,
    actual_delivery_date,
    notes,
  } = body;

  const { isValidTrackingUrl } = await import("@/lib/policies");
  if (tracking_url && !isValidTrackingUrl(tracking_url)) {
    return NextResponse.json(
      { error: "Invalid tracking URL: Only secure http:// and https:// links are permitted." },
      { status: 400 }
    );
  }

  const updates: string[] = [];
  const args: (string | null)[] = [];

  if (courier_name !== undefined) { updates.push("courier_name = ?"); args.push(courier_name ?? null); }
  if (tracking_number !== undefined) { updates.push("tracking_number = ?"); args.push(tracking_number ?? null); }
  if (tracking_url !== undefined) { updates.push("tracking_url = ?"); args.push(tracking_url ?? null); }
  if (dispatch_date !== undefined) { updates.push("dispatch_date = ?"); args.push(dispatch_date ?? null); }
  if (estimated_delivery_date !== undefined) { updates.push("estimated_delivery_date = ?"); args.push(estimated_delivery_date ?? null); }
  if (actual_delivery_date !== undefined) { updates.push("actual_delivery_date = ?"); args.push(actual_delivery_date ?? null); }
  if (notes !== undefined) { updates.push("notes = ?"); args.push(notes ?? null); }

  if (updates.length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  updates.push("updated_at = ?");
  args.push(new Date().toISOString());
  args.push(id);

  db.prepare(`UPDATE orders SET ${updates.join(", ")} WHERE id = ?`).run(...args);

  // If tracking number was newly added or changed, add a shipping event and queue notification
  if (tracking_number && tracking_number !== existing.tracking_number) {
    const { addShippingEvent } = await import("@/lib/db/orders");
    const { sendShippingUpdateEmail } = await import("@/services/notification-service");

    addShippingEvent({
      orderId: id,
      status: "Dispatched",
      location: "Fulfillment Centre",
      description: `Dispatched with ${courier_name || "Air Courier"}. AWB: ${tracking_number}`,
      occurredAt: dispatch_date || new Date().toISOString(),
    });

    const updatedOrder = fetchOrderWithDetails(id);
    if (updatedOrder) {
      sendShippingUpdateEmail(
        updatedOrder,
        courier_name || "Express Courier",
        tracking_number,
        tracking_url
      ).catch(console.error);
    }
  }

  writeAuditLog({
    actor: admin.email,
    action: "order_fulfilment_updated",
    entityType: "order",
    entityId: id,
    before: {
      courier_name: existing.courier_name,
      tracking_number: existing.tracking_number,
      tracking_url: existing.tracking_url,
      dispatch_date: existing.dispatch_date,
    },
    after: { courier_name, tracking_number, tracking_url, dispatch_date },
    ipAddress: req.headers.get("x-forwarded-for"),
  });

  const updated = fetchOrderWithDetails(id);
  return NextResponse.json({ order: updated });
}
