import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth/admin-auth";
import { getDb } from "@/lib/db/index";

export const dynamic = "force-dynamic";

/** GET /api/admin/me — returns current admin info from valid session */
export async function GET(req: NextRequest) {
  const admin = await requireAdminAuth(req);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
  });
}

/** GET /api/admin/dashboard — real metrics from SQLite */
export async function HEAD(req: NextRequest) {
  return GET(req);
}
