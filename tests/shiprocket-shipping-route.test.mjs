import test from "node:test";
import assert from "node:assert/strict";
import { createShippingPost } from "../src/services/shiprocket/shipping-route-handler.ts";

function setup({ admin = { role: "admin" }, enabled = true } = {}) {
  const calls = [];
  const handler = createShippingPost({
    requireAdminAuth: async () => admin,
    enabled: () => enabled,
    create: async id => { calls.push(["create", id]); return { id }; },
    assignAwb: async id => { calls.push(["assign_awb", id]); return { id }; },
    pickup: async id => { calls.push(["pickup", id]); return { id }; },
    label: async id => { calls.push(["label", id]); return "https://labels.example/label.pdf"; },
  });
  const invoke = (body, id = "ord_test_123") => handler(new Request("http://localhost/api/admin/orders/x/shipping", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }), { params: Promise.resolve({ id }) });
  return { calls, invoke };
}

test("unauthenticated and non-admin requests are rejected before any operation", async () => {
  for (const [admin, status] of [[null, 401], [{ role: "staff" }, 403], [{ role: undefined }, 403]]) {
    const h = setup({ admin });
    const response = await h.invoke({ action: "create", confirmed: true });
    assert.equal(response.status, status);
    assert.deepEqual(h.calls, []);
  }
});

test("disabled integration, missing confirmation, invalid ID, and bad body fail closed", async () => {
  const disabled = setup({ enabled: false });
  assert.equal((await disabled.invoke({ action: "create", confirmed: true })).status, 503);
  assert.deepEqual(disabled.calls, []);

  const h = setup();
  assert.equal((await h.invoke({ action: "create", confirmed: false })).status, 400);
  assert.equal((await h.invoke({ action: "create", confirmed: true }, "bad/id")).status, 400);
  assert.deepEqual(h.calls, []);
});

test("authorized actions are dispatched separately", async () => {
  const h = setup();
  for (const action of ["create", "assign_awb", "pickup", "label"]) {
    const response = await h.invoke({ action, confirmed: true });
    assert.equal(response.status, 200);
  }
  assert.deepEqual(h.calls, [
    ["create", "ord_test_123"], ["assign_awb", "ord_test_123"],
    ["pickup", "ord_test_123"], ["label", "ord_test_123"],
  ]);
});
