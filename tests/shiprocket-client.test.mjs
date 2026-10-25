import test from "node:test";
import assert from "node:assert/strict";
import { ShiprocketError, shiprocketRequest } from "../src/lib/shiprocket/client.ts";

const originalFetch = globalThis.fetch;
const cacheKey = "rightnowlifeShiprocketToken";
async function captureDiagnostics(callback) {
  const originalError = console.error;
  const lines = [];
  console.error = (...values) => lines.push(values.map(value => String(value)).join(" "));
  try {
    return { value: await callback(), lines };
  } finally {
    console.error = originalError;
  }
}

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
  const captured = await captureDiagnostics(() => assert.rejects(shiprocketRequest("/orders/show/1", "GET"), error => {
      assert.ok(error instanceof ShiprocketError);
      assert.equal(error.status, 503);
      assert.match(error.message, /SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD/);
      return true;
    }));
  assert.deepEqual(captured.lines, ["[shiprocket] stage=authentication configuration=missing_api_user_credentials"]);
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
  const captured = await captureDiagnostics(() => shiprocketRequest("/courier/serviceability/?delivery_postcode=123456", "GET"));
  assert.deepEqual(captured.value, { ok: true });
  assert.deepEqual(captured.lines, ["[shiprocket] stage=serviceability upstream_status=401"]);
  assert.equal(loginCount, 2);
  assert.equal(apiCount, 2);
  clearState();
});

test("successful API-user login calls the documented endpoint and sends its token to serviceability", async () => {
  clearState();
  process.env.SHIPROCKET_EMAIL = "api-user@example.test";
  process.env.SHIPROCKET_PASSWORD = "test-api-password";
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init.method, headers: new Headers(init.headers), body: init.body });
    if (String(url).endsWith("/auth/login")) {
      return Response.json({ token: "mock-access-token", expires_in: 86400 });
    }
    return Response.json({ data: { available_courier_companies: [] } });
  };

  const result = await shiprocketRequest("/courier/serviceability/?delivery_postcode=123456", "GET");
  assert.deepEqual(result, { data: { available_courier_companies: [] } });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "https://apiv2.shiprocket.in/v1/external/auth/login");
  assert.equal(calls[0].method, "POST");
  assert.deepEqual(JSON.parse(calls[0].body), { email: "api-user@example.test", password: "test-api-password" });
  assert.equal(calls[1].url, "https://apiv2.shiprocket.in/v1/external/courier/serviceability/?delivery_postcode=123456");
  assert.equal(calls[1].method, "GET");
  assert.equal(calls[1].headers.get("authorization"), "Bearer mock-access-token");
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

test("rejected API-user credentials preserve the upstream login status and log only safe stage metadata", async () => {
  clearState();
  process.env.SHIPROCKET_EMAIL = "api-user@example.test";
  process.env.SHIPROCKET_PASSWORD = "test-api-password";
  globalThis.fetch = async url => {
    assert.equal(String(url), "https://apiv2.shiprocket.in/v1/external/auth/login");
    return Response.json({ message: "private rejection detail", token: "must-not-be-logged" }, { status: 403 });
  };
  const captured = await captureDiagnostics(() => assert.rejects(shiprocketRequest("/courier/serviceability/?delivery_postcode=123456", "GET"), error => {
    assert.equal(error.status, 403);
    assert.equal(error.message, "Shiprocket authentication failed.");
    assert.equal(error.message.includes("private rejection detail"), false);
    assert.equal(error.message.includes("must-not-be-logged"), false);
    return true;
  }));
  assert.deepEqual(captured.lines, ["[shiprocket] stage=authentication upstream_status=403"]);
  clearState();
});

test("successful HTTP login without a token maps to a gateway error, not HTTP 200", async () => {
  clearState();
  process.env.SHIPROCKET_EMAIL = "api-user@example.test";
  process.env.SHIPROCKET_PASSWORD = "test-api-password";
  globalThis.fetch = async () => Response.json({ message: "token omitted" }, { status: 200 });
  const captured = await captureDiagnostics(() => assert.rejects(shiprocketRequest("/courier/serviceability/?delivery_postcode=123456", "GET"), error => {
    assert.equal(error.status, 502);
    assert.equal(error.message, "Shiprocket authentication response was invalid.");
    return true;
  }));
  assert.deepEqual(captured.lines, ["[shiprocket] stage=authentication upstream_status=200"]);
  clearState();
});

test("serviceability endpoint 403 is distinguished from login rejection and is not retried", async () => {
  clearState();
  process.env.SHIPROCKET_EMAIL = "api-user@example.test";
  process.env.SHIPROCKET_PASSWORD = "test-api-password";
  let serviceabilityCalls = 0;
  globalThis.fetch = async url => {
    if (String(url).endsWith("/auth/login")) return Response.json({ token: "mock-access-token" });
    serviceabilityCalls += 1;
    return Response.json({ message: "private serviceability rejection" }, { status: 403 });
  };
  const captured = await captureDiagnostics(() => assert.rejects(shiprocketRequest("/courier/serviceability/?delivery_postcode=123456", "GET"), error => {
    assert.equal(error.status, 403);
    assert.equal(error.message, "Shiprocket request failed (403).");
    return true;
  }));
  assert.equal(serviceabilityCalls, 1);
  assert.deepEqual(captured.lines, ["[shiprocket] stage=serviceability upstream_status=403"]);
  clearState();
});
