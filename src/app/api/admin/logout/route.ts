import { NextRequest, NextResponse } from "next/server";
import { validateSession, revokeSession, ADMIN_COOKIE_NAME } from "@/lib/auth/admin-auth";
import { writeAuditLog } from "@/lib/db/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const admin = await validateSession(req);
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;

  if (admin && token) {
    await revokeSession(token);
    await writeAuditLog({
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

// Also respond to GET for simple redirect-based logout links, redirecting to homepage
export async function GET(req: NextRequest) {
  const admin = await validateSession(req);
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;

  if (admin && token) {
    await revokeSession(token);
    await writeAuditLog({
      actor: admin.email,
      action: "admin_logout",
      entityType: "admin_session",
      entityId: admin.id,
    });
  }

  const response = NextResponse.redirect(new URL("/", req.url));
  response.cookies.set(ADMIN_COOKIE_NAME, "", { maxAge: 0, path: "/" });
  return response;
}
