import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth/admin-auth";
import { getDb, DbOrder, DbOrderItem, DbOrderAddress, DbOrderStatusHistory } from "@/lib/db/index";
import { isValidAdminTransition, requiresRefund } from "@/lib/order-status-machine";
import { writeAuditLog } from "@/lib/db/audit";
import { randomBytes } from "crypto";
import { releaseInventoryReservation } from "@/lib/db/orders";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/orders
 * Query params: q, status, payment_status, from_date, to_date, page, limit
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdminAuth(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") ?? "";
    const status = url.searchParams.get("status") ?? "";
    const paymentStatus = url.searchParams.get("payment_status") ?? "";
    const fromDate = url.searchParams.get("from_date") ?? "";
    const toDate = url.searchParams.get("to_date") ?? "";
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "25", 10)));
    const offset = (page - 1) * limit;

    const db = getDb();
    const conditions: string[] = [];
    const args: (string | number)[] = [];

    if (q) {
      conditions.push("(order_number ILIKE ? OR customer_name ILIKE ? OR customer_email ILIKE ? OR tracking_number ILIKE ?)");
      const like = `%${q}%`;
      args.push(like, like, like, like);
    }
    if (status) { conditions.push("order_status = ?"); args.push(status); }
    if (paymentStatus) { conditions.push("payment_status = ?"); args.push(paymentStatus); }
    if (fromDate) { conditions.push("created_at::date >= ?::date"); args.push(fromDate); }
    if (toDate) { conditions.push("created_at::date <= ?::date"); args.push(toDate); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const totalRow = await db.prepare(`SELECT COUNT(*) as count FROM orders ${where}`).get<{ count: string | number }>(...args);
    const total = Number(totalRow?.count ?? 0);
    const orders = await db.prepare(`SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all<DbOrder>(...args, limit, offset);

    return NextResponse.json({ orders, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("[admin/orders GET]", err);
    return NextResponse.json({ error: "Failed to list orders." }, { status: 500 });
  }
}
