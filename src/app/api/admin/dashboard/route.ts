import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth/admin-auth";
import { getDb } from "@/lib/db/index";
import { PRODUCTS } from "@/data/mock-data";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/dashboard
 * Returns real metrics computed from the SQLite database.
 *
 * Definitions:
 *   Gross Sales = SUM of `total` for all orders with payment_status = 'paid' or 'refund_pending'
 *                 (money actually collected, before any refunds).
 *   Net Sales   = Gross Sales - SUM of `total` for refunded orders
 *                 (money actually retained after refunds).
 */
export async function GET(req: NextRequest) {
  const admin = requireAdminAuth(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = getDb();

    // Order counts by status
    const orderStats = db.prepare(`
      SELECT
        COUNT(*) as total_orders,
        SUM(CASE WHEN order_status = 'pending_payment' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN order_status = 'paid' THEN 1 ELSE 0 END) as paid,
        SUM(CASE WHEN order_status = 'processing' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN order_status = 'shipped' THEN 1 ELSE 0 END) as shipped,
        SUM(CASE WHEN order_status = 'delivered' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN order_status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN order_status = 'payment_failed' THEN 1 ELSE 0 END) as payment_failed,
        SUM(CASE WHEN order_status = 'refund_pending' THEN 1 ELSE 0 END) as refund_pending,
        SUM(CASE WHEN order_status = 'refunded' THEN 1 ELSE 0 END) as refunded
      FROM orders
    `).get() as Record<string, number>;

    // Gross sales (all collected payments)
    const grossRow = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as gross
      FROM orders
      WHERE payment_status IN ('paid', 'refund_pending')
    `).get() as { gross: number };

    // Refunded amount
    const refundRow = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as refunded
      FROM orders
      WHERE order_status = 'refunded'
    `).get() as { refunded: number };

    const grossSales = grossRow.gross;
    const netSales = grossSales - refundRow.refunded;

    // Sales by day (last 30 days)
    const dailySales = db.prepare(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as order_count,
        COALESCE(SUM(total), 0) as revenue
      FROM orders
      WHERE payment_status = 'paid'
        AND created_at >= DATE('now', '-30 days')
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `).all() as Array<{ date: string; order_count: number; revenue: number }>;

    // Recent 10 orders
    const recentOrders = db.prepare(`
      SELECT id, order_number, customer_name, customer_email, total, order_status, payment_status, created_at
      FROM orders
      ORDER BY created_at DESC
      LIMIT 10
    `).all() as Array<{
      id: string;
      order_number: string;
      customer_name: string;
      customer_email: string;
      total: number;
      order_status: string;
      payment_status: string;
      created_at: string;
    }>;

    // Inventory warnings — low stock (< 5) and out of stock
    const inventoryWarnings = db.prepare(`
      SELECT product_id, size, stock, reserved,
             (stock - reserved) as available
      FROM inventory
      WHERE (stock - reserved) <= 5
      ORDER BY available ASC
    `).all() as Array<{ product_id: string; size: string; stock: number; reserved: number; available: number }>;

    // Enrich inventory warnings with product names
    const productNames: Record<string, string> = {};
    for (const p of PRODUCTS) productNames[p.id] = p.name;

    const enrichedWarnings = inventoryWarnings.map((w) => ({
      ...w,
      product_name: productNames[w.product_id] ?? w.product_id,
    }));

    return NextResponse.json({
      orders: {
        total: orderStats.total_orders ?? 0,
        pending: orderStats.pending ?? 0,
        paid: orderStats.paid ?? 0,
        processing: orderStats.processing ?? 0,
        shipped: orderStats.shipped ?? 0,
        delivered: orderStats.delivered ?? 0,
        cancelled: orderStats.cancelled ?? 0,
        payment_failed: orderStats.payment_failed ?? 0,
        refund_pending: orderStats.refund_pending ?? 0,
        refunded: orderStats.refunded ?? 0,
      },
      sales: {
        /**
         * Gross Sales: Total money collected (paid + refund_pending orders).
         * Does not deduct refunds yet issued.
         */
        gross: grossSales,
        /**
         * Net Sales: Gross Sales minus money returned via confirmed refunds.
         * Net = Gross - SUM(total WHERE order_status = 'refunded')
         */
        net: netSales,
        refunded: refundRow.refunded,
      },
      dailySales,
      recentOrders,
      inventoryWarnings: enrichedWarnings,
    });
  } catch (err) {
    console.error("[admin/dashboard]", err);
    return NextResponse.json({ error: "Failed to load dashboard metrics." }, { status: 500 });
  }
}
