import { test } from "node:test";
import assert from "node:assert/strict";
import { respondWithCustomerOrders } from "../src/services/customer-orders-api.ts";

test("customer orders API returns a successful empty history", async () => {
  const response = await respondWithCustomerOrders(async () => []);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { orders: [] });
});

test("customer orders API returns a generic 500 and safe database diagnostic", async () => {
  const diagnostics = [];
  const response = await respondWithCustomerOrders(
    async () => { throw Object.assign(new Error('relation "razorpay_payment_attempts" does not exist'), { code: "42P01" }); },
    (...args) => diagnostics.push(args)
  );
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "Failed to fetch orders." });
  assert.equal(diagnostics[0][1].code, "42P01");
  assert.equal(diagnostics[0][1].missingRelation, "razorpay_payment_attempts");
  assert.doesNotMatch(JSON.stringify(diagnostics), /does not exist/);
});
