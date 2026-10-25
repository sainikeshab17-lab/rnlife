import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth/admin-auth";

type AdminMeDependencies = {
  requireAdminAuth: typeof requireAdminAuth;
};

const runtimeDependencies = (): AdminMeDependencies => ({ requireAdminAuth });

export function createAdminMeGet(deps: AdminMeDependencies = runtimeDependencies()) {
  return async function GET(request: NextRequest) {
    let admin;
    try {
      admin = await deps.requireAdminAuth(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const stage = message.startsWith("ADMIN_SESSION_SECRET")
        ? "configuration"
        : error && typeof error === "object" && "code" in error
          ? "database"
          : "unexpected";
      const databaseCode = error && typeof error === "object" && "code" in error ? String(error.code) : null;
      console.error(`[admin/me] Session validation failed (${stage}${stage === "database" ? `; code ${databaseCode ?? "unknown"}` : ""}).`);
      return NextResponse.json({ error: "Administrator session is temporarily unavailable." }, { status: 503 });
    }
    if (!admin) {
      if (process.env.NODE_ENV === "development") {
        const cookiePresent = Boolean(request.cookies.get("rnl_admin_session")?.value);
        console.info(`[admin/me] Session rejected (session cookie ${cookiePresent ? "present" : "missing"}).`);
      }
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (process.env.NODE_ENV === "development") {
      console.info("[admin/me] Session validated successfully.");
    }
    return NextResponse.json({
      admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
    }, { headers: { "Cache-Control": "no-store" } });
  };
}
