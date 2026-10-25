import test from "node:test";
import assert from "node:assert/strict";
import { ShiprocketError, shiprocketRequest } from "../src/lib/shiprocket/client.ts";

const originalFetch = globalThis.fetch;
const cacheKey = "rightnowlifeShiprocketToken";
function clearState() {
  delete globalThis[cacheKey];
  delete process.env.SHIPROCKET_EMAIL;
  delete process.env.SHIPROCKET_PASSWORD;
  globalThis.fetch = originalFetch;
}

test("Shiprocket client requires credentials and never makes a request without them", async () => {
  clearState();
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error("must not call"); };
  await assert.rejects(shiprocketRequest("/orders/show/1", "GET"), error => {
    assert.ok(error instanceof ShiprocketError);
    assert.match(error.message, /SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD/);
    return true;
  });
  assert.equal(calls, 0);
  clearState();
});

test("expired token reauthenticates and 401 retries once with a fresh token", async () => {
  clearState();
  process.env.SHIPROCKET_EMAIL = "test@example.test";
  process.env.SHIPROCKET_PASSWORD = "mock-password";
  globalThis[cacheKey] = { token: "expired", expiresAt: Date.now() - 1 };
  let loginCount = 0;
  let apiCount = 0;
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith("/auth/login")) {
      loginCount += 1;
      assert.equal(JSON.parse(init.body).password, "mock-password");
      return Response.json({ token: `token-${loginCount}` });
    }
    apiCount += 1;
    if (apiCount === 1) return new Response("", { status: 401 });
    assert.equal(new Headers(init.headers).get("authorization"), "Bearer token-2");
    return Response.json({ ok: true });
  };
  assert.deepEqual(await shiprocketRequest("/orders/show/1", "GET"), { ok: true });
  assert.equal(loginCount, 2);
  assert.equal(apiCount, 2);
  clearState();
});

test("ambiguous network failures are marked and are not retried", async () => {
  clearState();
  process.env.SHIPROCKET_EMAIL = "test@example.test";
  process.env.SHIPROCKET_PASSWORD = "mock-password";
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls += 1;
    if (String(url).endsWith("/auth/login")) return Response.json({ token: "mock-token" });
    throw new Error("network timeout");
  };
  await assert.rejects(shiprocketRequest("/orders/create/adhoc", "POST", { order_id: "local-1" }), error => {
    assert.equal(error.ambiguous, true);
    return true;
  });
  assert.equal(calls, 2);
  clearState();
});

test("read-only request timeouts return a sanitized gateway timeout without retry", async () => {
  clearState();
  process.env.SHIPROCKET_EMAIL = "test@example.test";
  process.env.SHIPROCKET_PASSWORD = "mock-password";
  let calls = 0;
  globalThis.fetch = async url => {
    calls += 1;
    if (String(url).endsWith("/auth/login")) return Response.json({ token: "mock-token" });
    throw new Error("mock timeout");
  };
  await assert.rejects(shiprocketRequest("/courier/serviceability/?delivery_postcode=122002", "GET"), error => {
    assert.equal(error.status, 504);
    assert.equal(error.message, "Shiprocket read-only request timed out or failed.");
    assert.equal(error.message.includes("mock timeout"), false);
    return true;
  });
  assert.equal(calls, 2);
  clearState();
});

test("rate limits are reported without provider response details or automatic retries", async () => {
  clearState();
  process.env.SHIPROCKET_EMAIL = "test@example.test";
  process.env.SHIPROCKET_PASSWORD = "mock-password";
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls += 1;
    if (String(url).endsWith("/auth/login")) return Response.json({ token: "mock-token" });
    return Response.json({ message: "sensitive-provider-detail" }, { status: 429 });
  };
  await assert.rejects(shiprocketRequest("/courier/track/shipment/123", "GET"), error => {
    assert.equal(error.status, 429);
    assert.equal(error.message, "Shiprocket request failed (429).");
    assert.equal(error.message.includes("sensitive-provider-detail"), false);
    return true;
  });
  assert.equal(calls, 2);
  clearState();
});

test("provider server errors are marked ambiguous and are not retried", async () => {
  clearState();
  process.env.SHIPROCKET_EMAIL = "test@example.test";
  process.env.SHIPROCKET_PASSWORD = "mock-password";
  let calls = 0;
  globalThis.fetch = async url => {
    calls += 1;
    if (String(url).endsWith("/auth/login")) return Response.json({ token: "mock-token" });
    return Response.json({ message: "mock server detail" }, { status: 503 });
  };
  await assert.rejects(shiprocketRequest("/orders/create/adhoc", "POST", { order_id: "local-test" }), error => {
    assert.equal(error.status, 503);
    assert.equal(error.ambiguous, true);
    assert.equal(error.message, "Shiprocket request failed (503).");
    return true;
  });
  assert.equal(calls, 2);
  clearState();
});

test("rejected login responses do not disclose provider bodies or credentials", async () => {
  clearState();
  process.env.SHIPROCKET_EMAIL = "test@example.test";
  process.env.SHIPROCKET_PASSWORD = "mock-password";
  globalThis.fetch = async () => Response.json({ message: "mock-password leaked", token: "secret-token" }, { status: 401 });
  await assert.rejects(shiprocketRequest("/courier/track/shipment/123", "GET"), error => {
    assert.equal(error.status, 401);
    assert.equal(error.message, "Shiprocket authentication failed.");
    assert.equal(error.message.includes("mock-password"), false);
    assert.equal(error.message.includes("secret-token"), false);
    return true;
  });
  clearState();
});
