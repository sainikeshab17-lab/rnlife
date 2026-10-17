import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth/admin-auth";
import { getAuditLogs } from "@/lib/db/audit";

export const dynamic = "force-dynamic";

/** GET /api/admin/audit-logs */
export async function GET(req: NextRequest) {
  const admin = requireAdminAuth(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const entityType = url.searchParams.get("entity_type") ?? undefined;
  const entityId = url.searchParams.get("entity_id") ?? undefined;
  const actor = url.searchParams.get("actor") ?? undefined;
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0", 10));

  const result = getAuditLogs({ entityType, entityId, actor, limit, offset });
  return NextResponse.json(result);
}
