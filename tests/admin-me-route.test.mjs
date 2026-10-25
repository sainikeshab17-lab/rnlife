import test from "node:test";
import assert from "node:assert/strict";
import { createAdminMeGet } from "../src/services/admin-me-route.ts";

const request = (sessionCookie) => {
  const req = new Request("http://localhost/api/admin/me");
  req.cookies = { get: name => name === "rnl_admin_session" && sessionCookie ? { value: sessionCookie } : undefined };
  return req;
};

test("admin me returns safe identity fields for a validated session", async () => {
  const handler = createAdminMeGet({
    requireAdminAuth: async () => ({
      id: "adm_test", email: "admin@example.test", name: "Test Admin", role: "admin",
      password_hash: "must-not-be-returned", is_active: 1, created_at: "now", updated_at: "now",
    }),
  });
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    admin: { id: "adm_test", email: "admin@example.test", name: "Test Admin", role: "admin" },
  });
});

test("admin me returns 401 when canonical session validation rejects the request", async () => {
  const handler = createAdminMeGet({ requireAdminAuth: async () => null });
  const response = await handler(request());
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Unauthorized" });
});

test("admin me reports session configuration and database failures as unavailable, not unauthorized", async () => {
  const handler = createAdminMeGet({ requireAdminAuth: async () => { throw new Error("session database unavailable"); } });
  const response = await handler(request());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Administrator session is temporarily unavailable." });
});

test("admin me reports a rejected but present cookie without revealing its value", async () => {
  const handler = createAdminMeGet({ requireAdminAuth: async () => null });
  const response = await handler(request("invalid-secret-cookie-value"));
  assert.equal(response.status, 401);
});
