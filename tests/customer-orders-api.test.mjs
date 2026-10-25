import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { respondWithCustomerOrders } from "../src/services/customer-orders-api.ts";

test("customer orders API returns a successful empty history", async () => {
  const response = await respondWithCustomerOrders(async () => []);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { orders: [] });
});

test("customer order history omits the private Shiprocket label URL", async () => {
  const response = await respondWithCustomerOrders(async () => [{
    id: "order_1",
    shiprocket_label_url: "https://labels.example.test/private-order.pdf",
    order_status: "processing",
  }]);
  assert.deepEqual(await response.json(), { orders: [{ id: "order_1", order_status: "processing" }] });
});

test("single customer order details omit the private Shiprocket label URL", async () => {
  const source = await readFile("src/app/api/orders/[id]/route.ts", "utf8");
  assert.match(source, /delete customerOrder\.shiprocket_label_url/);
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
