import { NextRequest } from "next/server";
import { createAdminMeGet } from "@/services/admin-me-route";

export const dynamic = "force-dynamic";

/** GET /api/admin/me — returns current admin info from valid session */
export const GET = createAdminMeGet();

/** GET /api/admin/dashboard — real metrics from SQLite */
export async function HEAD(req: NextRequest) {
  return GET(req);
}
