import { NextRequest, NextResponse } from "next/server";
import { getAdminByEmail, verifyPassword, createSession, getSessionCookieOptions, ADMIN_COOKIE_NAME } from "@/lib/auth/admin-auth";
import { writeAuditLog } from "@/lib/db/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body ?? {};

    if (typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    // Retrieve admin by email
    const admin = await getAdminByEmail(email);

    // Always run verifyPassword even if admin not found, to prevent timing attacks
    const dummyHash = "pbkdf2$100000$0000000000000000$0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
    const passwordValid = verifyPassword(password, admin?.password_hash ?? dummyHash);

    if (!admin || !passwordValid) {
      await writeAuditLog({
        actor: email,
        action: "admin_login_failed",
        entityType: "admin_session",
        ipAddress: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip"),
      });
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    // Create session
    const rawToken = await createSession(
      admin.id,
      req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? undefined,
      req.headers.get("user-agent") ?? undefined
    );

    await writeAuditLog({
      actor: admin.email,
      action: "admin_login_success",
      entityType: "admin_session",
      entityId: admin.id,
      ipAddress: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip"),
    });

    const response = NextResponse.json({
      success: true,
      admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
    });

    response.cookies.set(ADMIN_COOKIE_NAME, rawToken, getSessionCookieOptions());
    return response;
  } catch (err) {
    console.error("[admin/login]", err);
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}
