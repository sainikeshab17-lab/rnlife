import test from "node:test";
import assert from "node:assert/strict";
import { createAdminLoginPost } from "../src/services/admin-login-route.ts";
import { createAdminMeGet } from "../src/services/admin-me-route.ts";
import { createShippingPost } from "../src/services/shiprocket/shipping-route-handler.ts";

const admin = {
  id: "adm_test", email: "admin@example.test", name: "Test Admin", role: "admin",
  password_hash: "hash", is_active: 1, created_at: "now", updated_at: "now",
};

test("successful login cookie authenticates /me and an admin protected shipping endpoint", async () => {
  const sessions = new Map();
  const login = createAdminLoginPost({
    getAdminByEmail: async email => email === admin.email ? admin : null,
    verifyPassword: () => true,
    createSession: async id => { const token = "test-session-token-32-bytes-long"; sessions.set(token, id); return token; },
    getSessionCookieOptions: () => ({ httpOnly: true, secure: false, sameSite: "strict", path: "/", maxAge: 86400 }),
    cookieName: "rnl_admin_session",
    claimAttempt: async () => ({ allowed: true, complete: async () => {} }),
    getRateLimitDiagnostic: () => "rate limiter unavailable",
    resolveClientIp: () => ({ clientIp: "127.0.0.1", source: "development_proxy" }),
    writeAuditLog: async () => {},
  });

  const loginResponse = await login(new Request("http://127.0.0.1:3000/api/admin/login", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: admin.email, password: "correct-test-password" }),
  }));
  assert.equal(loginResponse.status, 200);
  assert.equal((await loginResponse.json()).success, true);
  const setCookie = loginResponse.headers.get("set-cookie");
  assert.ok(setCookie?.startsWith("rnl_admin_session=test-session-token-32-bytes-long;"));
  assert.match(setCookie, /Path=\//);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=strict/);
  assert.doesNotMatch(setCookie, /Domain=/i);

  const token = setCookie.split(";")[0].slice("rnl_admin_session=".length);
  const requireSession = async req => {
    const presented = req.cookies?.get("rnl_admin_session")?.value;
    return sessions.has(presented) ? admin : null;
  };
  const withCookie = (url, init = {}) => {
    const req = new Request(url, init);
    req.cookies = { get: name => name === "rnl_admin_session" ? { value: token } : undefined };
    return req;
  };

  const meResponse = await createAdminMeGet({ requireAdminAuth: requireSession })(withCookie("http://127.0.0.1:3000/api/admin/me"));
  assert.equal(meResponse.status, 200);
  assert.equal((await meResponse.json()).admin.id, admin.id);

  const created = [];
  const shipping = createShippingPost({
    requireAdminAuth: requireSession,
    enabled: () => true,
    create: async id => { created.push(id); return { id, shiprocket_state: "creating" }; },
    assignAwb: async () => ({}), pickup: async () => ({}), label: async () => "",
  });
  const shippingResponse = await shipping(withCookie("http://127.0.0.1:3000/api/admin/orders/order_1/shipping", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "create", confirmed: true }),
  }), { params: Promise.resolve({ id: "order_1" }) });
  assert.equal(shippingResponse.status, 200);
  assert.deepEqual(created, ["order_1"]);

  const unauthorizedResponse = await shipping(new Request("http://127.0.0.1:3000/api/admin/orders/order_2/shipping", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "create", confirmed: true }),
  }), { params: Promise.resolve({ id: "order_2" }) });
  assert.equal(unauthorizedResponse.status, 401);
  assert.deepEqual(created, ["order_1"]);
});

test("admin login returns the unavailable response and sanitized diagnostics for service failures", async () => {
  const common = {
    verifyPassword: () => true,
    getSessionCookieOptions: () => ({ httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 86400 }),
    cookieName: "rnl_admin_session",
    resolveClientIp: () => ({ clientIp: "192.0.2.5", source: "trusted_ingress" }),
    getRateLimitDiagnostic: () => "PostgreSQL rate-limit storage is unavailable (database code 08006).",
    getAdminByEmail: async () => admin,
    createSession: async () => "test-session-token-that-must-not-be-logged",
    writeAuditLog: async () => {},
    claimAttempt: async () => ({ allowed: true, complete: async () => {} }),
  };
  const request = () => new Request("https://admin.example.test/api/admin/login", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: admin.email, password: "test-password-never-log" }),
  });
  const cases = [
    {
      name: "rate-limit storage failure",
      deps: {
        ...common,
        resolveClientIp: () => ({ clientIp: null, reason: "ip_unavailable" }),
        claimAttempt: async () => { throw new Error("private database detail"); },
      },
      log: "PostgreSQL rate-limit storage is unavailable (database code 08006).",
    },
    {
      name: "admin lookup database failure",
      deps: { ...common, getAdminByEmail: async () => { throw Object.assign(new Error("private database detail"), { code: "42P01" }); } },
      log: "Admin credential lookup failed (PostgreSQL code 42P01).",
    },
    {
      name: "session secret configuration failure",
      deps: { ...common, createSession: async () => { throw new Error("ADMIN_SESSION_SECRET must be configured with at least 32 characters. secret-value"); } },
      log: "Session persistence failed (configuration).",
    },
    {
      name: "successful login audit persistence failure",
      deps: { ...common, writeAuditLog: async () => { throw Object.assign(new Error("private database detail"), { code: "08006" }); } },
      log: "Successful login audit persistence failed (database code 08006).",
    },
  ];

  for (const scenario of cases) {
    const logs = [];
    const originalError = console.error;
    console.error = (...args) => logs.push(args.join(" "));
    try {
      const response = await createAdminLoginPost(scenario.deps)(request());
      assert.equal(response.status, 503, scenario.name);
      assert.deepEqual(await response.json(), { error: "Admin login is temporarily unavailable." }, scenario.name);
      assert.ok(logs.some((line) => line.includes(scenario.log)), scenario.name);
      assert.doesNotMatch(logs.join(" "), /test-password-never-log|test-session-token-that-must-not-be-logged|secret-value|private database detail/);
      assert.equal(response.headers.has("set-cookie"), false, scenario.name);
    } finally {
      console.error = originalError;
    }
  }
});

test("production login succeeds without the optional IP header and still reserves an email bucket", async () => {
  let claimed;
  const login = createAdminLoginPost({
    getAdminByEmail: async email => email === admin.email ? admin : null,
    verifyPassword: () => true,
    createSession: async () => "production-test-session-token-32-bytes",
    getSessionCookieOptions: () => ({ httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 86400 }),
    cookieName: "rnl_admin_session",
    claimAttempt: async (email, ip) => {
      claimed = { email, ip };
      return { allowed: true, complete: async () => {} };
    },
    getRateLimitDiagnostic: () => "database unavailable",
    resolveClientIp: () => ({ clientIp: null, reason: "ip_unavailable" }),
    writeAuditLog: async () => {},
  });
  const response = await login(new Request("https://store.example/api/admin/login", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: admin.email, password: "correct-test-password" }),
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(claimed, { email: admin.email, ip: null });
  assert.match(response.headers.get("set-cookie"), /Secure/);
});

test("unknown emails cannot bypass account throttling by varying identities when IP is unavailable", async () => {
  const attempts = new Map();
  let passwordVerifications = 0;
  const login = createAdminLoginPost({
    getAdminByEmail: async () => null,
    verifyPassword: () => { passwordVerifications += 1; return false; },
    createSession: async () => "must-not-create-a-session",
    getSessionCookieOptions: () => ({ httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 86400 }),
    cookieName: "rnl_admin_session",
    claimAttempt: async email => {
      const key = email ?? "unknown-email-fallback";
      const count = (attempts.get(key) ?? 0) + 1;
      attempts.set(key, count);
      return count >= 10 ? { allowed: false, retryAfterSeconds: 900 } : { allowed: true, complete: async () => {} };
    },
    getRateLimitDiagnostic: () => "database unavailable",
    resolveClientIp: () => ({ clientIp: null, reason: "ip_unavailable" }),
    writeAuditLog: async () => {},
  });

  for (let index = 0; index < 9; index += 1) {
    const response = await login(new Request("https://store.example/api/admin/login", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: `unknown-${index}@example.test`, password: "incorrect-test-password" }),
    }));
    assert.equal(response.status, 401);
  }
  const blocked = await login(new Request("https://store.example/api/admin/login", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "another-unknown@example.test", password: "incorrect-test-password" }),
  }));
  assert.equal(blocked.status, 429);
  assert.equal(passwordVerifications, 9);
});

test("invalid credentials are audited and rejected without issuing a session cookie", async () => {
  const auditEvents = [];
  const handler = createAdminLoginPost({
    getAdminByEmail: async () => admin,
    verifyPassword: () => false,
    createSession: async () => { throw new Error("must not create a session"); },
    getSessionCookieOptions: () => ({ httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 86400 }),
    cookieName: "rnl_admin_session",
    claimAttempt: async () => ({ allowed: true, complete: async () => {} }),
    getRateLimitDiagnostic: () => "rate limiter unavailable",
    resolveClientIp: () => ({ clientIp: "192.0.2.5", source: "trusted_ingress" }),
    writeAuditLog: async event => { auditEvents.push(event); },
  });

  const response = await handler(new Request("https://admin.example.test/api/admin/login", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: admin.email, password: "incorrect-test-password" }),
  }));
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Invalid credentials." });
  assert.equal(response.headers.has("set-cookie"), false);
  assert.equal(auditEvents.length, 1);
  assert.equal(auditEvents[0].action, "admin_login_failed");
});

test("login rate limit returns 429 before admin lookup when an identity is blocked", async () => {
  let accountLookups = 0;
  const handler = createAdminLoginPost({
    getAdminByEmail: async () => { accountLookups += 1; return admin; },
    verifyPassword: () => true,
    createSession: async () => "must-not-create-a-session",
    getSessionCookieOptions: () => ({ httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 86400 }),
    cookieName: "rnl_admin_session",
    claimAttempt: async () => ({ allowed: false, retryAfterSeconds: 600 }),
    getRateLimitDiagnostic: () => "rate limiter unavailable",
    resolveClientIp: () => ({ clientIp: "192.0.2.5", source: "trusted_ingress" }),
    writeAuditLog: async () => {},
  });

  const response = await handler(new Request("https://admin.example.test/api/admin/login", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: admin.email, password: "any-test-password" }),
  }));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "600");
  assert.equal(accountLookups, 0);
});
