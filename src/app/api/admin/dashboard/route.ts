import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth/admin-auth";
import { getDb } from "@/lib/db/index";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/dashboard
 * Returns real metrics computed from the PostgreSQL database.
 *
 * Definitions:
 *   Gross Sales = SUM of `total` for all orders with payment_status = 'paid' or 'refund_pending'
 *                 (money actually collected, before any refunds).
 *   Net Sales   = Gross Sales - SUM of `total` for refunded orders
 *                 (money actually retained after refunds).
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdminAuth(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = getDb();

    // Order counts by status
    const orderStats = await db.prepare(`
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
    `).get<Record<string, string | number>>();

    // Gross sales (all collected payments)
    const grossRow = await db.prepare(`
      SELECT COALESCE(SUM(total), 0) as gross
      FROM orders
      WHERE payment_status IN ('paid', 'refund_pending')
    `).get<{ gross: string | number }>();

    // Refunded amount
    const refundRow = await db.prepare(`
      SELECT COALESCE(SUM(total), 0) as refunded
      FROM orders
      WHERE order_status = 'refunded'
    `).get<{ refunded: string | number }>();

    const grossSales = Number(grossRow?.gross ?? 0);
    const refundedSales = Number(refundRow?.refunded ?? 0);
    const netSales = grossSales - refundedSales;

    // Sales by day (last 30 days)
    const dailySales = await db.prepare(`
      SELECT
      created_at::date as date,
        COUNT(*) as order_count,
        COALESCE(SUM(total), 0) as revenue
      FROM orders
      WHERE payment_status = 'paid'
      AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY created_at::date
      ORDER BY date ASC
    `).all<{ date: string; order_count: string | number; revenue: string | number }>();

    // Recent 10 orders
    const recentOrders = await db.prepare(`
      SELECT id, order_number, customer_name, customer_email, total, order_status, payment_status, created_at
      FROM orders
      ORDER BY created_at DESC
      LIMIT 10
    `).all<{
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
    const inventoryWarnings = await db.prepare(`
      SELECT product_id, size, stock, reserved,
             (stock - reserved) as available
      FROM inventory
      WHERE (stock - reserved) <= 5
      ORDER BY available ASC
    `).all<{ product_id: string; size: string; stock: number; reserved: number; available: number }>();

    // Enrich inventory warnings with product names
    const supabase = createAdminSupabaseClient();
    const { data: products, error: productsError } = await supabase
      .from("products").select("id,name");
    if (productsError) throw new Error(`Unable to load product labels: ${productsError.message}`);
    const productNames: Record<string, string> = {};
    for (const p of products ?? []) productNames[p.id] = p.name;

    const enrichedWarnings = inventoryWarnings.map((w) => ({
      ...w,
      product_name: productNames[w.product_id] ?? `Unknown product (${w.product_id})`,
    }));

    return NextResponse.json({
      orders: {
        total: Number(orderStats?.total_orders ?? 0),
        pending: Number(orderStats?.pending ?? 0),
        paid: Number(orderStats?.paid ?? 0),
        processing: Number(orderStats?.processing ?? 0),
        shipped: Number(orderStats?.shipped ?? 0),
        delivered: Number(orderStats?.delivered ?? 0),
        cancelled: Number(orderStats?.cancelled ?? 0),
        payment_failed: Number(orderStats?.payment_failed ?? 0),
        refund_pending: Number(orderStats?.refund_pending ?? 0),
        refunded: Number(orderStats?.refunded ?? 0),
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
        refunded: refundedSales,
      },
      dailySales: dailySales.map((row) => ({
        ...row,
        order_count: Number(row.order_count),
        revenue: Number(row.revenue),
      })),
      recentOrders,
      inventoryWarnings: enrichedWarnings,
    });
  } catch (err) {
    console.error("[admin/dashboard]", err);
    return NextResponse.json({ error: "Failed to load dashboard metrics." }, { status: 500 });
  }
}
