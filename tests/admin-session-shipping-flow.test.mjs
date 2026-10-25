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
