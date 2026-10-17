import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth/admin-auth";
import { getDb, DbReturn, DbReturnItem } from "@/lib/db/index";
import { inspectReturnItem } from "@/lib/db/orders";
import { writeAuditLog } from "@/lib/db/audit";
import { sendReturnStatusEmail } from "@/services/notification-service";
import { getOrderById } from "@/lib/db/orders";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/returns
 * List all return and exchange requests.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdminAuth(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const returnRows = await db
    .prepare(`
      SELECT r.*, o.order_number, o.customer_name, o.customer_email
      FROM returns r
      JOIN orders o ON r.order_id = o.id
      ORDER BY r.created_at DESC
    `)
    .all<Record<string, unknown>>();

  const returns = await Promise.all(returnRows.map(async (ret) => {
    const items = await db
      .prepare(`
        SELECT ri.*, oi.product_name, oi.price
        FROM return_items ri
        JOIN order_items oi ON ri.order_item_id = oi.id
        WHERE ri.return_id = ?
      `)
      .all<DbReturnItem>(String(ret.id));
    return { ...ret, items };
  }));

  return NextResponse.json({ returns });
}

/**
 * PATCH /api/admin/returns
 * Update return request status or record inspection condition for items.
 */
export async function PATCH(req: NextRequest) {
  const admin = await requireAdminAuth(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const body = await req.json();
  const { returnId, status, adminNote, inspections } = body;

  if (!returnId) {
    return NextResponse.json({ error: "Missing returnId." }, { status: 400 });
  }

  const existing = await db.prepare("SELECT * FROM returns WHERE id = ?").get<DbReturn>(returnId);
  if (!existing) {
    return NextResponse.json({ error: "Return request not found." }, { status: 404 });
  }

  const now = new Date().toISOString();

  // Handle item inspections if provided
  if (Array.isArray(inspections)) {
    for (const insp of inspections) {
      if (insp.returnItemId && insp.condition) {
        await inspectReturnItem({
          returnItemId: insp.returnItemId,
          condition: insp.condition,
          actorEmail: admin.email,
        });
      }
    }
  }

  // Update return status if provided
  if (status && status !== existing.status) {
    await db.prepare(`
      UPDATE returns
      SET status = ?, admin_note = COALESCE(?, admin_note), updated_at = ?
      WHERE id = ?
    `).run(status, adminNote || null, now, returnId);

    const order = await getOrderById(existing.order_id);
    if (order) {
      sendReturnStatusEmail(order, existing.type, status, adminNote).catch(console.error);
    }
  } else if (adminNote) {
    await db.prepare(`
      UPDATE returns
      SET admin_note = ?, updated_at = ?
      WHERE id = ?
    `).run(adminNote, now, returnId);
  }

  await writeAuditLog({
    actor: admin.email,
    action: "return_request_updated",
    entityType: "return",
    entityId: returnId,
    before: { status: existing.status, admin_note: existing.admin_note },
    after: { status: status || existing.status, admin_note: adminNote || existing.admin_note },
    ipAddress: req.headers.get("x-forwarded-for"),
  });

  const updatedReturn = await db.prepare("SELECT * FROM returns WHERE id = ?").get<DbReturn>(returnId);
  if (!updatedReturn) throw new Error("Updated return could not be retrieved.");
  const items = await db.prepare("SELECT * FROM return_items WHERE return_id = ?").all(returnId);

  return NextResponse.json({ success: true, return: { ...updatedReturn, items } });
}
