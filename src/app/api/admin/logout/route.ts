import { NextRequest, NextResponse } from "next/server";
import { validateSession, revokeSession, ADMIN_COOKIE_NAME } from "@/lib/auth/admin-auth";
import { writeAuditLog } from "@/lib/db/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const admin = validateSession(req);
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;

  if (admin && token) {
    revokeSession(token);
    writeAuditLog({
      actor: admin.email,
      action: "admin_logout",
      entityType: "admin_session",
      entityId: admin.id,
    });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_COOKIE_NAME, "", { maxAge: 0, path: "/" });
  return response;
}

// Also respond to GET for simple redirect-based logout links
export async function GET(req: NextRequest) {
  return POST(req);
}
