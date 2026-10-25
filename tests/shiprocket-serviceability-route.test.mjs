import test from "node:test";
import assert from "node:assert/strict";
import { createShiprocketServiceabilityPost } from "../src/services/shiprocket/serviceability-route-handler.ts";

function setup({ admin = { role: "admin" }, enabled = true, error } = {}) {
  const calls = [];
  const handler = createShiprocketServiceabilityPost({
    requireAdminAuth: async () => admin,
    enabled: () => enabled,
    check: async input => {
      calls.push(input);
      if (error) throw error;
      return { serviceable: true, couriers: [{ courierId: 10, courierName: "Mock Courier", rate: 40 }] };
    },
  });
  const invoke = body => handler(new Request("http://localhost/api/admin/shipping/serviceability", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }));
  return { calls, invoke };
}

test("serviceability route requires authenticated admin before the provider call", async () => {
  for (const [admin, status] of [[null, 401], [{ role: "staff" }, 403]]) {
    const h = setup({ admin });
    assert.equal((await h.invoke({ confirmed: true, deliveryPostcode: "122002", cod: false })).status, status);
    assert.deepEqual(h.calls, []);
  }
});

test("serviceability route is independently gated while shipment lifecycle flag remains off", async () => {
  const h = setup({ enabled: false });
  assert.equal((await h.invoke({ confirmed: true, deliveryPostcode: "122002", cod: false })).status, 503);
  assert.deepEqual(h.calls, []);
});

test("serviceability route requires explicit confirmation and dispatches only the read-only lookup", async () => {
  const h = setup();
  assert.equal((await h.invoke({ confirmed: false, deliveryPostcode: "122002", cod: false })).status, 400);
  assert.equal((await h.invoke({ confirmed: true, deliveryPostcode: "122002", cod: "false" })).status, 400);
  const response = await h.invoke({ confirmed: true, deliveryPostcode: "122002", cod: false });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { serviceable: true, couriers: [{ courierId: 10, courierName: "Mock Courier", rate: 40 }] });
  assert.deepEqual(h.calls, [{ deliveryPostcode: "122002", cod: false }]);
});

test("serviceability route hides unknown provider error details", async () => {
  const h = setup({ error: new Error("sensitive provider error") });
  const response = await h.invoke({ confirmed: true, deliveryPostcode: "122002", cod: false });
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: "Shiprocket serviceability is temporarily unavailable." });
});
