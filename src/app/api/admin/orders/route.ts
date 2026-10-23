import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth/admin-auth";
import { getDb } from "@/lib/db/index";
import { listAdminOrders, isValidOrderListDate } from "@/services/admin-orders-list";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/orders
 * Query params: q, status, payment_status, from_date, to_date, page, limit
 */
export async function GET(req: NextRequest) {
  let stage: "authentication" | "query" = "authentication";
  try {
    const admin = await requireAdminAuth(req);
    if (!admin) return NextResponse.json({ error: "Your admin session is invalid or has expired. Sign in again.", code: "UNAUTHORIZED" }, { status: 401 });

    const url = new URL(req.url);
    const query = url.searchParams.get("q") ?? "";
    const status = url.searchParams.get("status") ?? "";
    const paymentStatus = url.searchParams.get("payment_status") ?? "";
    const fromDate = url.searchParams.get("from_date") ?? "";
    const toDate = url.searchParams.get("to_date") ?? "";
    if (!isValidOrderListDate(fromDate) || !isValidOrderListDate(toDate)) {
      return NextResponse.json({ error: "Use valid calendar dates for the order date filters.", code: "INVALID_DATE_FILTER" }, { status: 400 });
    }
    const parseBoundedInt = (value: string | null, fallback: number, max: number) => {
      const parsed = Number.parseInt(value ?? "", 10);
      return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
    };
    const page = parseBoundedInt(url.searchParams.get("page"), 1, 1_000_000);
    const limit = parseBoundedInt(url.searchParams.get("limit"), 25, 100);

    stage = "query";
    const result = await listAdminOrders(getDb(), {
      query, status, paymentStatus, fromDate, toDate, page, limit,
    });
    return NextResponse.json(result);
  } catch (err) {
    const record = err && typeof err === "object"
      ? err as { code?: unknown; column?: unknown; message?: unknown }
      : {};
    const dbCode = typeof record.code === "string" ? record.code : undefined;
    const column = typeof record.column === "string" ? record.column : undefined;
    const missingDatabaseUrl = typeof record.message === "string" && record.message.includes("DATABASE_URL is required");
    const unavailable = missingDatabaseUrl || Boolean(dbCode?.startsWith("08") || dbCode === "ECONNREFUSED" || dbCode === "ETIMEDOUT" || dbCode === "57P03" || dbCode === "53300");
    console.error("[admin/orders GET] Request failed.", {
      stage,
      reason: missingDatabaseUrl ? "database_configuration_missing" : unavailable ? "database_unavailable" : "query_or_schema_error",
      databaseCode: dbCode,
      column,
    });
    return unavailable
      ? NextResponse.json({ error: "Orders are temporarily unavailable. Please retry shortly.", code: "ORDERS_UNAVAILABLE" }, { status: 503 })
      : NextResponse.json({ error: "Orders could not be loaded. Contact support if the problem continues.", code: "ORDERS_QUERY_FAILED" }, { status: 500 });
  }
}
