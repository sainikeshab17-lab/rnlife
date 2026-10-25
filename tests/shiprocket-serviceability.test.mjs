import test from "node:test";
import assert from "node:assert/strict";
import { checkShiprocketServiceability } from "../src/services/shiprocket/serviceability-service.ts";
import { ShiprocketError } from "../src/lib/shiprocket/client.ts";

const env = {
  SHIPROCKET_PICKUP_LOCATION: "Configured pickup",
  SHIPROCKET_PICKUP_POSTCODE: "560001",
  SHIPROCKET_PACKAGE_WEIGHT_KG: "0.5",
};

function setup({ response, error, envOverrides = {} } = {}) {
  const calls = [];
  const deps = {
    env: { ...env, ...envOverrides },
    request: async (path, method) => {
      calls.push({ path, method });
      if (error) throw error;
      return response ?? { data: { available_courier_companies: [] } };
    },
  };
  return { calls, deps };
}

test("serviceability requests courier options and returns only validated provider estimates", async () => {
  const h = setup({ response: { data: { available_courier_companies: [
    { courier_company_id: 43, courier_name: "Delhivery Surface", rate: 54, estimated_delivery_days: "4", etd: "Jul 01, 2024", rating: 4.9, private_provider_field: "not returned" },
  ] } } });
  const result = await checkShiprocketServiceability({ deliveryPostcode: "122002", cod: true }, h.deps);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].method, "GET");
  const url = new URL(`https://api.test${h.calls[0].path}`);
  assert.equal(url.pathname, "/courier/serviceability/");
  assert.equal(url.searchParams.get("pickup_postcode"), "560001");
  assert.equal(url.searchParams.get("delivery_postcode"), "122002");
  assert.equal(url.searchParams.get("cod"), "1");
  assert.equal(url.searchParams.get("weight"), "0.5");
  assert.deepEqual(result, { serviceable: true, couriers: [{
    courierId: 43, courierName: "Delhivery Surface", rate: 54,
    estimatedDeliveryDays: 4, estimatedDeliveryDate: "Jul 01, 2024", rating: 4.9,
  }] });
});

test("unavailable delivery postcode returns an empty non-serviceable result", async () => {
  const h = setup();
  assert.deepEqual(await checkShiprocketServiceability({ deliveryPostcode: "999999", cod: false }, h.deps), {
    serviceable: false, couriers: [],
  });
  assert.equal(new URL(`https://api.test${h.calls[0].path}`).searchParams.get("cod"), "0");
});

test("invalid input and missing pickup/parcel configuration fail before the provider request", async () => {
  const cases = [
    [{ deliveryPostcode: "12A456", cod: false }, {}, /six-digit delivery postcode/],
    [{ deliveryPostcode: "123456", cod: "false" }, {}, /six-digit delivery postcode/],
    [{ deliveryPostcode: "123456", cod: false }, { SHIPROCKET_PICKUP_LOCATION: "" }, /PICKUP_LOCATION/],
    [{ deliveryPostcode: "123456", cod: false }, { SHIPROCKET_PICKUP_POSTCODE: "12345" }, /PICKUP_POSTCODE/],
    [{ deliveryPostcode: "123456", cod: false }, { SHIPROCKET_PACKAGE_WEIGHT_KG: "0" }, /WEIGHT_KG/],
    [{ deliveryPostcode: "123456", cod: false }, { SHIPROCKET_PACKAGE_LENGTH_CM: "10" }, /all three package dimensions/],
  ];
  for (const [input, envOverrides, expected] of cases) {
    const h = setup({ envOverrides });
    await assert.rejects(checkShiprocketServiceability(input, h.deps), expected);
    assert.deepEqual(h.calls, []);
  }
});

test("authentication failures are surfaced without exposing token or provider data", async () => {
  const h = setup({ error: new ShiprocketError("Shiprocket authentication failed.", 401) });
  await assert.rejects(checkShiprocketServiceability({ deliveryPostcode: "122002", cod: false }, h.deps), error => {
    assert.equal(error.status, 401);
    assert.equal(error.message, "Shiprocket authentication failed.");
    return true;
  });
});

test("provider errors and timeouts remain sanitized and are not retried", async () => {
  for (const error of [
    new ShiprocketError("Shiprocket request failed (429).", 429),
    new ShiprocketError("Shiprocket read-only request timed out or failed.", 504, true),
  ]) {
    const h = setup({ error });
    await assert.rejects(checkShiprocketServiceability({ deliveryPostcode: "122002", cod: false }, h.deps), actual => {
      assert.equal(actual.status, error.status);
      assert.equal(actual.message, error.message);
      return true;
    });
    assert.equal(h.calls.length, 1);
  }
});

test("malformed provider responses are rejected rather than returned to the browser", async () => {
  const h = setup({ response: { data: { available_courier_companies: [{ courier_company_id: "invalid", courier_name: "" }] } } });
  await assert.rejects(checkShiprocketServiceability({ deliveryPostcode: "122002", cod: false }, h.deps), /invalid serviceability response/);
});
