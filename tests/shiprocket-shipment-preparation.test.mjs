import test from "node:test";
import assert from "node:assert/strict";
import { prepareShiprocketShipment } from "../src/services/shiprocket/shipment-preparation.ts";
import { createShipmentPreparationPost } from "../src/services/shiprocket/shipment-preparation-route-handler.ts";
import { ShiprocketError } from "../src/lib/shiprocket/client.ts";

const order = {
  id: "ord_test_123", customer_email: "buyer@example.test", customer_phone: "9876543210",
  payment_method: "Razorpay (UPI / Cards / NetBanking)", payment_status: "paid", order_status: "processing",
  is_confirmed: true, cancellation_requested: 0, refund_status: null, shiprocket_order_id: null,
  shiprocket_shipment_id: null, shiprocket_state: "not_created", tracking_number: null,
};
const address = {
  order_id: order.id, full_name: "Buyer Example", phone: "9876543210", address_line1: "1 Test Street",
  address_line2: null, landmark: null, city: "Bengaluru", state: "Karnataka", pin_code: "560001", country: "India",
};
const items = [{ product_id: "product_1", product_name: "Test Shirt", sku: "RNL-SKU-1", quantity: 2, price: 999 }];
const env = {
  SHIPROCKET_PICKUP_LOCATION: "Configured Warehouse", SHIPROCKET_PICKUP_POSTCODE: "560001",
  SHIPROCKET_ITEM_WEIGHT_KG: "0.25", SHIPROCKET_PACKAGE_LENGTH_CM: "20",
  SHIPROCKET_PACKAGE_BREADTH_CM: "15", SHIPROCKET_PACKAGE_HEIGHT_CM: "5",
};

function setup({ orderChanges = {}, addressChanges = {}, itemChanges = [], envChanges = {} } = {}) {
  const writes = [];
  const db = { prepare(sql) { return {
    get: async () => sql.includes("FROM orders") ? { ...order, ...orderChanges } : { ...address, ...addressChanges },
    all: async () => items.map((item, index) => ({ ...item, ...(itemChanges[index] ?? {}) })),
    run: async (...args) => { writes.push({ sql, args }); return { rowCount: 1 }; },
  }; } };
  return { deps: { db, env: { ...env, ...envChanges } }, writes };
}

test("eligible order preparation derives parcel weight from persisted item quantities and performs no writes", async () => {
  const h = setup();
  const result = await prepareShiprocketShipment(order.id, h.deps);
  assert.equal(result.totalUnits, 2);
  assert.equal(result.weightKg, 0.5);
  assert.equal(result.deliveryPostcode, "560001");
  assert.deepEqual(result.dimensions, { lengthCm: 20, breadthCm: 15, heightCm: 5 });
  assert.equal(h.writes.length, 0);
});

test("preparation rejects unpaid prepaid orders and cancelled orders", async () => {
  for (const orderChanges of [{ payment_status: "pending_payment" }, { order_status: "cancelled" }]) {
    const h = setup({ orderChanges });
    await assert.rejects(prepareShiprocketShipment(order.id, h.deps), ShiprocketError);
    assert.equal(h.writes.length, 0);
  }
});

test("preparation rejects invalid delivery address and Indian PIN", async () => {
  for (const addressChanges of [{ address_line1: " " }, { pin_code: "012345" }, { pin_code: "56000" }, { country: "US" }]) {
    const h = setup({ addressChanges });
    await assert.rejects(prepareShiprocketShipment(order.id, h.deps), /address or recipient details are invalid/);
  }
});

test("preparation rejects invalid persisted quantities and missing or invalid parcel measurements", async () => {
  const badItem = setup({ itemChanges: [{ quantity: 0 }] });
  await assert.rejects(prepareShiprocketShipment(order.id, badItem.deps), /invalid shipment data/);
  for (const envChanges of [
    { SHIPROCKET_ITEM_WEIGHT_KG: "" }, { SHIPROCKET_ITEM_WEIGHT_KG: "-1" },
    { SHIPROCKET_PACKAGE_LENGTH_CM: "0" }, { SHIPROCKET_PACKAGE_BREADTH_CM: "NaN" },
    { SHIPROCKET_PACKAGE_HEIGHT_CM: "" }, { SHIPROCKET_PICKUP_LOCATION: "" },
    { SHIPROCKET_PICKUP_POSTCODE: "000000" },
  ]) {
    const h = setup({ envChanges });
    await assert.rejects(prepareShiprocketShipment(order.id, h.deps), ShiprocketError);
  }
});

test("preparation rejects existing or uncertain shipment attempts", async () => {
  for (const orderChanges of [
    { shiprocket_state: "creating" }, { shiprocket_state: "order_created", shiprocket_order_id: 10 },
    { shiprocket_shipment_id: 11 }, { tracking_number: "AWB12345" }, { order_status: "shipped" },
  ]) {
    const h = setup({ orderChanges });
    await assert.rejects(prepareShiprocketShipment(order.id, h.deps), /shipment|Shipment/);
    assert.equal(h.writes.length, 0);
  }
});

test("admin preparation route enforces admin authorization and does not require lifecycle enablement", async () => {
  let prepared = 0;
  const handler = admin => createShipmentPreparationPost({
    requireAdminAuth: async () => admin,
    prepare: async () => { prepared += 1; return { orderId: order.id, totalUnits: 2 }; },
  });
  const request = new Request("http://localhost/api/admin/orders/ord_test_123/shipping-preparation", { method: "POST" });
  const invoke = route => route(request, { params: Promise.resolve({ id: order.id }) });
  assert.equal((await invoke(handler(null))).status, 401);
  assert.equal((await invoke(handler({ role: "staff" }))).status, 403);
  const response = await invoke(handler({ role: "admin" }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { orderId: order.id, totalUnits: 2 });
  assert.equal(prepared, 1);
});
