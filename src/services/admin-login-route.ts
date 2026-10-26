import { NextRequest, NextResponse } from "next/server";
import { getAdminByEmail, verifyPassword, createSession, getSessionCookieOptions, ADMIN_COOKIE_NAME } from "@/lib/auth/admin-auth";
import { claimAdminLoginAttempt, getAdminLoginRateLimitDiagnostic, resolveTrustedAdminLoginClientIp, type AdminLoginAttempt } from "@/lib/auth/admin-login-rate-limit";
import { writeAuditLog } from "@/lib/db/audit";

type Dependencies = {
  getAdminByEmail: typeof getAdminByEmail;
  verifyPassword: typeof verifyPassword;
  createSession: typeof createSession;
  getSessionCookieOptions: typeof getSessionCookieOptions;
  cookieName: typeof ADMIN_COOKIE_NAME;
  claimAttempt: typeof claimAdminLoginAttempt;
  getRateLimitDiagnostic: typeof getAdminLoginRateLimitDiagnostic;
  resolveClientIp: typeof resolveTrustedAdminLoginClientIp;
  writeAuditLog: typeof writeAuditLog;
};

const runtimeDependencies = (): Dependencies => ({
  getAdminByEmail, verifyPassword, createSession, getSessionCookieOptions,
  cookieName: ADMIN_COOKIE_NAME, claimAttempt: claimAdminLoginAttempt,
  getRateLimitDiagnostic: getAdminLoginRateLimitDiagnostic,
  resolveClientIp: resolveTrustedAdminLoginClientIp, writeAuditLog,
});

export function createAdminLoginPost(deps: Dependencies = runtimeDependencies()) {
  return async function POST(req: NextRequest) {
    try {
      const ipResolution = deps.resolveClientIp(req.headers);
      if (ipResolution.clientIp === null) {
        if (ipResolution.reason === "development_proxy_missing") {
          console.error("[admin/login] Local client IP injection is missing; start the loopback-only server with npm run dev.");
        } else if (ipResolution.reason === "header_unconfigured") {
          console.error("[admin/login] ADMIN_LOGIN_TRUSTED_IP_HEADER is unset; configure a custom header overwritten by the trusted production ingress.");
        } else if (ipResolution.reason === "header_invalid") {
          console.error("[admin/login] ADMIN_LOGIN_TRUSTED_IP_HEADER must name a custom x-* header other than X-Forwarded-For or X-Real-IP.");
        } else {
          console.error("[admin/login] The configured trusted ingress IP header is missing, malformed, or contains multiple addresses.");
        }
        return NextResponse.json({ error: "Admin login is temporarily unavailable." }, { status: 503 });
      }
      const clientIp = ipResolution.clientIp;
      const contentLength = Number(req.headers.get("content-length") ?? 0);
      if (Number.isFinite(contentLength) && contentLength > 8192) return NextResponse.json({ error: "Login request is too large." }, { status: 413 });
      const rawBody = await req.text();
      if (Buffer.byteLength(rawBody, "utf8") > 8192) return NextResponse.json({ error: "Login request is too large." }, { status: 413 });

      let body: unknown;
      try { body = JSON.parse(rawBody); } catch { body = null; }
      const credentials = body && typeof body === "object" ? body as { email?: unknown; password?: unknown } : {};
      const email = typeof credentials.email === "string" ? credentials.email.trim() : null;
      const password = typeof credentials.password === "string" ? credentials.password : null;

      let attempt: AdminLoginAttempt;
      try {
        attempt = await deps.claimAttempt(email && email.length <= 254 ? email : null, clientIp);
      } catch (error) {
        console.error(`[admin/login] ${deps.getRateLimitDiagnostic(error)}`);
        return NextResponse.json({ error: "Admin login is temporarily unavailable." }, { status: 503 });
      }
      if (!attempt.allowed) {
        console.warn(`[admin/login] Login rate limit reached (identity bucket; retry after ${attempt.retryAfterSeconds}s).`);
        return NextResponse.json({ error: "Too many login attempts. Try again later." }, {
          status: 429, headers: { "Retry-After": String(attempt.retryAfterSeconds) },
        });
      }
      if (!email || email.length > 254 || !password || Buffer.byteLength(password, "utf8") > 1024) {
        return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
      }

      let admin;
      try {
        admin = await deps.getAdminByEmail(email);
      } catch (error) {
        const databaseCode = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
        console.error(`[admin/login] Admin credential lookup failed (PostgreSQL code ${databaseCode}).`);
        return NextResponse.json({ error: "Admin login is temporarily unavailable." }, { status: 503 });
      }
      const dummyHash = "pbkdf2$100000$0000000000000000$0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
      const passwordValid = deps.verifyPassword(password, admin?.password_hash ?? dummyHash);
      if (!admin || !passwordValid) {
        await deps.writeAuditLog({ actor: email, action: "admin_login_failed", entityType: "admin_session", ipAddress: clientIp });
        return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
      }
      try {
        await attempt.complete();
      } catch (error) {
        console.error(`[admin/login] ${deps.getRateLimitDiagnostic(error)}`);
        return NextResponse.json({ error: "Admin login is temporarily unavailable." }, { status: 503 });
      }

      let rawToken: string;
      try {
        rawToken = await deps.createSession(admin.id, clientIp, req.headers.get("user-agent") ?? undefined);
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        const databaseCode = error && typeof error === "object" && "code" in error ? String(error.code) : null;
        const stage = message.startsWith("ADMIN_SESSION_SECRET") ? "configuration" : databaseCode ? `database code ${databaseCode}` : "unexpected";
        console.error(`[admin/login] Session persistence failed (${stage}).`);
        return NextResponse.json({ error: "Admin login is temporarily unavailable." }, { status: 503 });
      }
      try {
        await deps.writeAuditLog({ actor: admin.email, action: "admin_login_success", entityType: "admin_session", entityId: admin.id, ipAddress: clientIp });
      } catch (error) {
        const databaseCode = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
        console.error(`[admin/login] Successful login audit persistence failed (database code ${databaseCode}).`);
        return NextResponse.json({ error: "Admin login is temporarily unavailable." }, { status: 503 });
      }
      const response = NextResponse.json({ success: true, admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role } });
      response.cookies.set(deps.cookieName, rawToken, deps.getSessionCookieOptions());
      if (process.env.NODE_ENV === "development") {
        console.info("[admin/login] Session persisted; host-only HTTP-only session cookie added to the response.");
      }
      return response;
    } catch {
      console.error("[admin/login] Login processing failed.");
      return NextResponse.json({ error: "Login failed." }, { status: 500 });
    }
  };
}
