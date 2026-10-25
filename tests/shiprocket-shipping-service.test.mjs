import test from "node:test";
import assert from "node:assert/strict";
import {
  assignShipmentAwb,
  createOrResumeShipment,
  generateShipmentLabel,
  scheduleShipmentPickup,
} from "../src/services/shiprocket/shipping-service.ts";
import { ShiprocketError } from "../src/lib/shiprocket/client.ts";
import { prepareShiprocketShipment } from "../src/services/shiprocket/shipment-preparation.ts";

const baseOrder = {
  id: "ord_test_123", order_number: "RNL-123", customer_name: "Buyer Example",
  customer_email: "buyer@example.test", customer_phone: "9876543210", subtotal: 999,
  shipping: 0, discount: 0, total: 999, payment_method: "Razorpay", payment_status: "paid",
  order_status: "processing", is_confirmed: true, created_at: "2026-10-24T00:00:00.000Z",
  tracking_number: null, courier_name: null, tracking_url: null,
  shiprocket_order_id: null, shiprocket_shipment_id: null, shiprocket_state: "not_created",
  shiprocket_last_error: null,
};
const address = {
  id: "address_1", order_id: baseOrder.id, full_name: "Buyer Example", phone: "9876543210",
  address_line1: "1 Test Street", address_line2: null, landmark: null, city: "Bengaluru",
  state: "Karnataka", pin_code: "560001", country: "India",
};
const items = [{ id: "item_1", order_id: baseOrder.id, product_id: "product_1", product_name: "Test Shirt", sku: "RNL-SKU-1", quantity: 1, price: 999 }];
const env = {
  SHIPROCKET_PICKUP_LOCATION: "RIGHTNOWLIFE WAREHOUSE",
  SHIPROCKET_PICKUP_POSTCODE: "560001", SHIPROCKET_ITEM_WEIGHT_KG: "0.5",
  SHIPROCKET_LABEL_ALLOWED_HOSTS: "labels.example.test",
  SHIPROCKET_PACKAGE_WEIGHT_KG: "0.5", SHIPROCKET_PACKAGE_LENGTH_CM: "20",
  SHIPROCKET_PACKAGE_BREADTH_CM: "15", SHIPROCKET_PACKAGE_HEIGHT_CM: "5",
};

class MockDb {
  constructor({ order = {}, failOn = null, beforeLockedRead = null, addressRecord = address } = {}) {
    this.order = { ...baseOrder, ...order };
    this.failOn = failOn;
    this.writes = [];
    this.beforeLockedRead = beforeLockedRead;
    this.addressRecord = addressRecord;
  }

  prepare(sql) {
    const normalized = sql.replace(/\s+/g, " ").trim();
    return {
      get: async () => {
        if (normalized.includes("FOR UPDATE") && this.beforeLockedRead) {
          const hook = this.beforeLockedRead;
          this.beforeLockedRead = null;
          await hook(this.order);
        }
        if (normalized.includes("FROM order_addresses")) return this.addressRecord ? { ...this.addressRecord } : undefined;
        if (normalized.includes("FROM order_items")) return undefined;
        if (normalized.includes("shiprocket_state, shiprocket_order_id, shiprocket_shipment_id")) {
          return { shiprocket_state: this.order.shiprocket_state, shiprocket_order_id: this.order.shiprocket_order_id, shiprocket_shipment_id: this.order.shiprocket_shipment_id };
        }
        if (normalized.includes("shiprocket_shipment_id, tracking_number, shiprocket_state")) {
          return { shiprocket_shipment_id: this.order.shiprocket_shipment_id, tracking_number: this.order.tracking_number, shiprocket_state: this.order.shiprocket_state };
        }
        if (normalized.includes("FROM orders")) return { ...this.order };
        return undefined;
      },
      all: async () => normalized.includes("FROM order_items") ? items.map(item => ({ ...item })) : [],
      run: async (...args) => this.run(normalized, args),
    };
  }

  async run(sql, args) {
    this.writes.push({ sql, args });
    if (this.failOn && sql.includes(this.failOn)) {
      this.failOn = null;
      throw new Error("mock database write failed");
    }
    if (sql.includes("SET shiprocket_state = ?, shiprocket_last_error = NULL")) {
      const [nextState, , prior] = args;
      const allowed = { creating: ["not_created", "failed"], assigning_awb: ["order_created"], pickup_requesting: ["awb_assigned"], generating_label: ["awb_assigned", "pickup_requested"] };
      if (this.order.shiprocket_state !== prior || !allowed[nextState]?.includes(prior)) return { rowCount: 0 };
      this.order.shiprocket_state = nextState;
      return { rowCount: 1 };
    }
    if (sql.includes("SET shiprocket_state = 'creating'")) {
      if (!["not_created", "failed"].includes(this.order.shiprocket_state)) return { rowCount: 0 };
      this.order.shiprocket_state = "creating";
      return { rowCount: 1 };
    }
    if (sql.includes("shiprocket_order_id = ?") && sql.includes("shiprocket_state = 'order_created'")) {
      if (this.order.shiprocket_state !== "creating" || this.order.shiprocket_order_id != null) return { rowCount: 0 };
      [this.order.shiprocket_order_id, this.order.shiprocket_shipment_id] = args;
      this.order.shiprocket_state = "order_created";
      return { rowCount: 1 };
    }
    if (sql.includes("SET shiprocket_state = 'assigning_awb'")) {
      if (this.order.shiprocket_state !== "order_created") return { rowCount: 0 };
      this.order.shiprocket_state = "assigning_awb";
      return { rowCount: 1 };
    }
    if (sql.includes("SET tracking_number = ?")) {
      if (this.order.shiprocket_state !== "assigning_awb" || this.order.tracking_number !== null) return { rowCount: 0 };
      [this.order.tracking_number, this.order.courier_name] = args;
      this.order.tracking_url = "https://www.shiprocket.in/shipment-tracking/";
      this.order.shiprocket_state = "awb_assigned";
      return { rowCount: 1 };
    }
    if (sql.includes("SET shiprocket_state = 'order_created', shiprocket_last_error")) {
      if (this.order.shiprocket_state !== "assigning_awb") return { rowCount: 0 };
      this.order.shiprocket_state = "order_created";
      this.order.shiprocket_last_error = args[0];
      return { rowCount: 1 };
    }
    if (sql.includes("SET shiprocket_state = 'pickup_requesting'")) {
      if (this.order.shiprocket_state !== "awb_assigned") return { rowCount: 0 };
      this.order.shiprocket_state = "pickup_requesting";
      return { rowCount: 1 };
    }
    if (sql.includes("SET shiprocket_state = 'pickup_requested'")) {
      if (this.order.shiprocket_state !== "pickup_requesting") return { rowCount: 0 };
      this.order.shiprocket_state = "pickup_requested";
      return { rowCount: 1 };
    }
    if (sql.includes("SET shiprocket_state = 'generating_label'")) {
      if (!["awb_assigned", "pickup_requested"].includes(this.order.shiprocket_state)) return { rowCount: 0 };
      this.order.shiprocket_state = "generating_label";
      return { rowCount: 1 };
    }
    if (sql.includes("SET shiprocket_label_url = ?")) {
      if (this.order.shiprocket_state !== "generating_label") return { rowCount: 0 };
      [this.order.shiprocket_label_url] = args;
      this.order.shiprocket_state = "label_ready";
      return { rowCount: 1 };
    }
    if (sql.includes("SET shiprocket_state = ?, shiprocket_last_error")) {
      const [state, error] = args;
      this.order.shiprocket_state = state;
      this.order.shiprocket_last_error = error;
      return { rowCount: 1 };
    }
    return { rowCount: 1 };
  }
}

function setup({ order, failOn, response, envOverrides, beforeLockedRead, addressRecord, enabled = true } = {}) {
  const db = new MockDb({ order, failOn, beforeLockedRead, addressRecord });
  const calls = [];
  const serviceEnv = { ...env, ...envOverrides };
  const deps = {
    db, enabled: () => enabled, env: serviceEnv,
    transaction: async callback => callback(db),
    prepare: orderId => prepareShiprocketShipment(orderId, { db, env: serviceEnv }),
    request: async (path, method, body) => {
      calls.push({ path, method, body });
      if (response instanceof Error) throw response;
      return response ?? (path === "/orders/create/adhoc"
        ? { order_id: 7001, shipment_id: 8001 }
        : path === "/courier/assign/awb"
          ? { awb_assign_status: 1, response: { data: { shipment_id: 8001, awb_code: "SR123456789", courier_name: "Test Courier" } } }
        : path === "/courier/generate/label"
          ? { label_url: "https://labels.example.test/label.pdf" }
        : { pickup_status: 1, response: {
          pickup_scheduled_date: "2026-10-25 12:39:54",
          pickup_token_number: "Reference No: TEST_PICKUP_TOKEN",
          status: 3,
        } });
    },
  };
  return { db, calls, deps };
}

test("provider order success persists IDs and does not assign an AWB", async () => {
  const h = setup();
  const order = await createOrResumeShipment(baseOrder.id, h.deps);
  assert.deepEqual(h.calls.map(call => call.path), ["/orders/create/adhoc"]);
  assert.equal(order.shiprocket_order_id, 7001);
  assert.equal(order.shiprocket_shipment_id, 8001);
  assert.equal(order.shiprocket_state, "order_created");
  assert.ok(h.db.writes.some(write => write.sql.includes("shiprocket_order_id = ?")));
  assert.equal(order.tracking_number, null);
  assert.equal(h.calls[0].body.weight, 0.5);
});

test("provider order creation requires a successful preparation result", async () => {
  const h = setup();
  h.deps.prepare = async () => { throw new ShiprocketError("preparation blocked", 409); };
  await assert.rejects(createOrResumeShipment(baseOrder.id, h.deps), /preparation blocked/);
  assert.deepEqual(h.calls, []);
  assert.equal(h.db.order.shiprocket_state, "not_created");
});

test("disabled integration blocks every lifecycle operation before database or provider access", async () => {
  const h = setup({ enabled: false });
  const actions = [
    () => createOrResumeShipment(baseOrder.id, h.deps),
    () => assignShipmentAwb(baseOrder.id, h.deps),
    () => scheduleShipmentPickup(baseOrder.id, h.deps),
    () => generateShipmentLabel(baseOrder.id, h.deps),
  ];
  for (const action of actions) await assert.rejects(action, /Shiprocket shipping is disabled/);
  assert.deepEqual(h.calls, []);
  assert.deepEqual(h.db.writes, []);
});

test("invalid shipping postcodes and missing addresses are rejected before provider calls", async () => {
  for (const postcode of ["12345", "1234567", "12A456", "560001,560002", ""]) {
    const h = setup({ addressRecord: { ...address, pin_code: postcode } });
    await assert.rejects(createOrResumeShipment(baseOrder.id, h.deps), /address or recipient details are invalid/);
    assert.deepEqual(h.calls, []);
    assert.equal(h.db.order.shiprocket_state, "not_created");
  }
  const missing = setup({ addressRecord: null });
  await assert.rejects(createOrResumeShipment(baseOrder.id, missing.deps), /Order address or items are missing/);
  assert.deepEqual(missing.calls, []);
});

test("invalid package configuration is rejected before claiming order creation", async () => {
  const h = setup({ envOverrides: { SHIPROCKET_ITEM_WEIGHT_KG: "0" } });
  await assert.rejects(createOrResumeShipment(baseOrder.id, h.deps), /SHIPROCKET_ITEM_WEIGHT_KG/);
  assert.equal(h.db.order.shiprocket_state, "not_created");
  assert.equal(h.db.writes.length, 0);
  assert.equal(h.calls.length, 0);
});

test("malformed provider order response becomes unknown and is not retried", async () => {
  const h = setup({ response: { order_id: 7001, shipment_id: "bad" } });
  await assert.rejects(createOrResumeShipment(baseOrder.id, h.deps), error => error.ambiguous === true);
  assert.equal(h.db.order.shiprocket_state, "unknown");
  await assert.rejects(createOrResumeShipment(baseOrder.id, h.deps), /uncertain outcome/);
  assert.equal(h.calls.filter(call => call.path === "/orders/create/adhoc").length, 1);
});

test("provider acceptance followed by failed local persistence becomes blocked unknown", async () => {
  const h = setup({ failOn: "shiprocket_order_id = ?" });
  await assert.rejects(createOrResumeShipment(baseOrder.id, h.deps), /mock database write failed/);
  assert.equal(h.calls.length, 1);
  assert.equal(h.db.order.shiprocket_state, "unknown");
  await assert.rejects(createOrResumeShipment(baseOrder.id, h.deps), /uncertain outcome/);
  assert.equal(h.calls.length, 1);
});

test("database claim failure prevents any provider operation", async () => {
  const h = setup({ failOn: "SET shiprocket_state = ?, shiprocket_last_error = NULL" });
  await assert.rejects(createOrResumeShipment(baseOrder.id, h.deps), /mock database write failed/);
  assert.equal(h.calls.length, 0);
  assert.equal(h.db.order.shiprocket_state, "not_created");
});

test("timeout after possible provider acceptance blocks blind retries", async () => {
  const h = setup({ response: new ShiprocketError("outcome unknown", undefined, true) });
  await assert.rejects(createOrResumeShipment(baseOrder.id, h.deps), error => error.ambiguous === true);
  assert.equal(h.db.order.shiprocket_state, "unknown");
  await assert.rejects(createOrResumeShipment(baseOrder.id, h.deps), /uncertain outcome/);
  assert.equal(h.calls.length, 1);
});

test("duplicate requests reuse existing provider references without creating another provider order", async () => {
  const h = setup();
  await createOrResumeShipment(baseOrder.id, h.deps);
  const result = await createOrResumeShipment(baseOrder.id, h.deps);
  assert.equal(h.calls.length, 1);
  assert.equal(result.shiprocket_order_id, 7001);
  assert.equal(result.shiprocket_shipment_id, 8001);
});

test("concurrent create requests claim the database state once", async () => {
  const h = setup();
  const results = await Promise.allSettled([
    createOrResumeShipment(baseOrder.id, h.deps),
    createOrResumeShipment(baseOrder.id, h.deps),
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(h.calls.filter(call => call.path === "/orders/create/adhoc").length, 1);
  assert.equal(h.db.order.shiprocket_state, "order_created");
});

test("existing Shiprocket IDs are preserved and existing tracking prevents AWB overwrite", async () => {
  const h = setup({ order: {
    shiprocket_order_id: 7001, shiprocket_shipment_id: 8001, shiprocket_state: "awb_assigned",
    tracking_number: "MANUAL-AWB", courier_name: "Existing Courier", tracking_url: "https://carrier.example/track",
  } });
  await createOrResumeShipment(baseOrder.id, h.deps);
  await assert.rejects(assignShipmentAwb(baseOrder.id, h.deps), /Tracking information already exists/);
  assert.equal(h.calls.length, 0);
  assert.equal(h.db.order.shiprocket_order_id, 7001);
  assert.equal(h.db.order.shiprocket_shipment_id, 8001);
  assert.equal(h.db.order.tracking_number, "MANUAL-AWB");
});

test("concurrent AWB requests issue one request and persist the AWB once", async () => {
  const h = setup({ order: { shiprocket_order_id: 7001, shiprocket_shipment_id: 8001, shiprocket_state: "order_created" } });
  const results = await Promise.allSettled([
    assignShipmentAwb(baseOrder.id, h.deps),
    assignShipmentAwb(baseOrder.id, h.deps),
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(h.calls.filter(call => call.path === "/courier/assign/awb").length, 1);
  assert.equal(h.db.order.tracking_number, "SR123456789");
  assert.equal(h.db.order.shiprocket_state, "awb_assigned");
});

test("malformed or mismatched AWB success responses become uncertain and cannot be retried", async () => {
  const invalidResponses = [
    { awb_assign_status: 1, response: { data: { shipment_id: 9999, awb_code: "SR123456789", courier_name: "Test Courier" } } },
    { awb_assign_status: 1, response: { data: { shipment_id: 8001, awb_code: "", courier_name: "Test Courier" } } },
    { awb_assign_status: 0, response: { data: { shipment_id: 8001, awb_code: "SR123456789", courier_name: "Test Courier" } } },
    {},
  ];
  for (const response of invalidResponses) {
    const h = setup({
      order: { shiprocket_order_id: 7001, shiprocket_shipment_id: 8001, shiprocket_state: "order_created" },
      response,
    });
    await assert.rejects(assignShipmentAwb(baseOrder.id, h.deps), /incomplete or mismatched AWB response/);
    assert.equal(h.db.order.shiprocket_state, "awb_unknown");
    assert.equal(h.db.order.tracking_number, null);
    await assert.rejects(assignShipmentAwb(baseOrder.id, h.deps), /not ready for AWB assignment or needs reconciliation/);
    assert.equal(h.calls.filter(call => call.path === "/courier/assign/awb").length, 1);
  }
});

test("cancellation committed before provider-order claim blocks Shiprocket", async () => {
  const h = setup({ beforeLockedRead: async order => { order.cancellation_requested = 1; } });
  await assert.rejects(createOrResumeShipment(baseOrder.id, h.deps), /not eligible/);
  assert.equal(h.calls.length, 0);
  assert.equal(h.db.order.shiprocket_state, "not_created");
});

test("refund/status change committed before AWB claim blocks Shiprocket", async () => {
  const h = setup({
    order: { shiprocket_order_id: 7001, shiprocket_shipment_id: 8001, shiprocket_state: "order_created" },
    beforeLockedRead: async order => { order.order_status = "refund_pending"; order.refund_status = "pending"; },
  });
  await assert.rejects(assignShipmentAwb(baseOrder.id, h.deps), /not eligible/);
  assert.equal(h.calls.length, 0);
  assert.equal(h.db.order.shiprocket_state, "order_created");
});

test("AWB failure is surfaced and leaves a safe retry state without changing tracking", async () => {
  const h = setup({ order: { shiprocket_order_id: 7001, shiprocket_shipment_id: 8001, shiprocket_state: "order_created" }, response: new ShiprocketError("provider rejected", 422) });
  await assert.rejects(assignShipmentAwb(baseOrder.id, h.deps), /provider rejected/);
  assert.equal(h.calls.length, 1);
  assert.equal(h.db.order.shiprocket_state, "order_created");
  assert.equal(h.db.order.tracking_number, null);
});

test("AWB accepted but local persistence fails becomes awb_unknown and cannot be retried", async () => {
  const h = setup({
    order: { shiprocket_order_id: 7001, shiprocket_shipment_id: 8001, shiprocket_state: "order_created" },
    failOn: "SET tracking_number = ?",
  });
  await assert.rejects(assignShipmentAwb(baseOrder.id, h.deps), /mock database write failed/);
  assert.equal(h.db.order.shiprocket_state, "awb_unknown");
  assert.equal(h.db.order.tracking_number, null);
  await assert.rejects(assignShipmentAwb(baseOrder.id, h.deps), /needs reconciliation/);
  assert.equal(h.calls.length, 1);
});

test("AWB and pickup requests reject missing shipment references without provider calls", async () => {
  const h = setup();
  await assert.rejects(assignShipmentAwb(baseOrder.id, h.deps), /Create a Shiprocket order/);
  await assert.rejects(scheduleShipmentPickup(baseOrder.id, h.deps), /An AWB must be assigned/);
  assert.equal(h.calls.length, 0);
  assert.equal(h.db.writes.length, 0);
});

test("pickup failure is surfaced and remains retryable without duplicate scheduling", async () => {
  const h = setup({ order: {
    shiprocket_shipment_id: 8001, shiprocket_state: "awb_assigned", tracking_number: "SR123456789",
  }, response: new ShiprocketError("pickup rejected", 422) });
  await assert.rejects(scheduleShipmentPickup(baseOrder.id, h.deps), /pickup rejected/);
  assert.equal(h.calls.length, 1);
  assert.equal(h.db.order.shiprocket_state, "awb_assigned");
  assert.equal(h.db.order.tracking_number, "SR123456789");
});

test("pickup is persisted only after the documented successful response is validated", async () => {
  const h = setup({ order: {
    shiprocket_shipment_id: 8001, shiprocket_state: "awb_assigned", tracking_number: "SR123456789",
  } });
  const result = await scheduleShipmentPickup(baseOrder.id, h.deps);
  assert.equal(result.pickup_status, 1);
  assert.equal(result.response.status, 3);
  assert.equal(h.db.order.shiprocket_state, "pickup_requested");
});

test("malformed pickup success responses become uncertain and cannot be retried", async () => {
  const invalidResponses = [
    {},
    { pickup_status: 0, response: { pickup_scheduled_date: "2026-10-25 12:39:54", pickup_token_number: "token", status: 3 } },
    { pickup_status: 1, response: { pickup_scheduled_date: "2026-10-25 12:39:54", pickup_token_number: "token", status: 2 } },
    { pickup_status: 1, response: { pickup_scheduled_date: "2026-10-25 12:39:54", status: 3 } },
  ];
  for (const response of invalidResponses) {
    const h = setup({
      order: { shiprocket_shipment_id: 8001, shiprocket_state: "awb_assigned", tracking_number: "SR123456789" },
      response,
    });
    await assert.rejects(scheduleShipmentPickup(baseOrder.id, h.deps), /incomplete pickup response/);
    assert.equal(h.db.order.shiprocket_state, "pickup_unknown");
    await assert.rejects(scheduleShipmentPickup(baseOrder.id, h.deps), /in progress or needs reconciliation/);
    assert.equal(h.calls.filter(call => call.path === "/courier/generate/pickup").length, 1);
  }
});

test("cancellation committed before pickup claim blocks Shiprocket", async () => {
  const h = setup({ order: { shiprocket_shipment_id: 8001, tracking_number: "SR123456789", shiprocket_state: "awb_assigned" },
    beforeLockedRead: async order => { order.order_status = "cancelled"; } });
  await assert.rejects(scheduleShipmentPickup(baseOrder.id, h.deps), /not eligible/);
  assert.equal(h.calls.length, 0);
});

test("concurrent pickup requests issue one provider request", async () => {
  const h = setup({ order: { shiprocket_shipment_id: 8001, tracking_number: "SR123456789", shiprocket_state: "awb_assigned" } });
  const results = await Promise.allSettled([scheduleShipmentPickup(baseOrder.id, h.deps), scheduleShipmentPickup(baseOrder.id, h.deps)]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(h.calls.filter(call => call.path === "/courier/generate/pickup").length, 1);
});

test("unpaid, partial, cancelled, refunded and terminal orders never call Shiprocket", async () => {
  const cases = [
    { payment_status: "pending_payment", order_status: "pending_payment" },
    { payment_status: "partially_paid", payment_method: "COD Advance", order_status: "advance_paid" },
    { payment_status: "paid", order_status: "cancelled" },
    { payment_status: "paid", order_status: "refunded" },
    { payment_status: "paid", order_status: "refund_pending" },
    { payment_status: "paid", order_status: "payment_failed" },
    { payment_status: "paid", order_status: "delivered" },
    { payment_status: "refunded", order_status: "processing" },
  ];
  for (const order of cases) {
    const h = setup({ order });
    await assert.rejects(createOrResumeShipment(baseOrder.id, h.deps), /not eligible/);
    assert.equal(h.calls.length, 0);
    assert.equal(h.db.writes.length, 0);
  }
});

test("AWB, pickup, and label actions recheck order eligibility before provider calls", async () => {
  const actions = [
    [assignShipmentAwb, { shiprocket_order_id: 7001, shiprocket_shipment_id: 8001, shiprocket_state: "order_created" }],
    [scheduleShipmentPickup, { shiprocket_shipment_id: 8001, shiprocket_state: "awb_assigned", tracking_number: "SR123456789" }],
    [generateShipmentLabel, { shiprocket_shipment_id: 8001, shiprocket_state: "awb_assigned", tracking_number: "SR123456789" }],
  ];
  for (const [action, shipment] of actions) {
    const h = setup({ order: { ...shipment, order_status: "cancelled" } });
    await assert.rejects(action(baseOrder.id, h.deps), /not eligible/);
    assert.equal(h.calls.length, 0);
    assert.equal(h.db.writes.length, 0);
  }
});

test("unknown creation, AWB, and pickup outcomes remain blocked without provider retries", async () => {
  for (const [state, action] of [
    ["unknown", createOrResumeShipment], ["creating", createOrResumeShipment],
    ["awb_unknown", assignShipmentAwb], ["pickup_unknown", scheduleShipmentPickup],
  ]) {
    const h = setup({ order: {
      shiprocket_order_id: state === "unknown" || state === "creating" ? null : 7001,
      shiprocket_shipment_id: state === "unknown" || state === "creating" ? null : 8001,
      tracking_number: state === "pickup_unknown" ? "SR123456789" : null,
      shiprocket_state: state,
    } });
    await assert.rejects(action(baseOrder.id, h.deps));
    assert.equal(h.calls.length, 0);
  }
});

test("pickup acceptance with failed state persistence becomes pickup_unknown", async () => {
  const h = setup({
    order: { shiprocket_shipment_id: 8001, shiprocket_state: "awb_assigned", tracking_number: "SR123456789" },
    failOn: "SET shiprocket_state = 'pickup_requested'",
  });
  await assert.rejects(scheduleShipmentPickup(baseOrder.id, h.deps), /mock database write failed/);
  assert.equal(h.calls.length, 1);
  assert.equal(h.db.order.shiprocket_state, "pickup_unknown");
  await assert.rejects(scheduleShipmentPickup(baseOrder.id, h.deps), /in progress or needs reconciliation/);
  assert.equal(h.calls.length, 1);
});

test("label generation is claimed once and cannot be repeated after success", async () => {
  const h = setup({ order: { shiprocket_shipment_id: 8001, shiprocket_state: "awb_assigned", tracking_number: "SR123456789" } });
  assert.equal(await generateShipmentLabel(baseOrder.id, h.deps), "https://labels.example.test/label.pdf");
  assert.equal(h.db.order.shiprocket_state, "label_ready");
  await assert.rejects(generateShipmentLabel(baseOrder.id, h.deps), /label already exists/);
  assert.deepEqual(h.calls.map(call => call.path), ["/courier/generate/label"]);
});

test("label generation requires an exact host allowlist before calling Shiprocket", async () => {
  const h = setup({
    order: { shiprocket_shipment_id: 8001, shiprocket_state: "awb_assigned", tracking_number: "SR123456789" },
    envOverrides: { SHIPROCKET_LABEL_ALLOWED_HOSTS: "" },
  });
  await assert.rejects(generateShipmentLabel(baseOrder.id, h.deps), /label host allowlist is not configured/);
  assert.equal(h.calls.length, 0);
  assert.equal(h.db.order.shiprocket_state, "awb_assigned");
});

test("label generation rejects malformed allowlist entries before calling Shiprocket", async () => {
  for (const value of ["*.example.test", "https://labels.example.test", "labels.example.test/path", "127.0.0.1"]) {
    const h = setup({ envOverrides: { SHIPROCKET_LABEL_ALLOWED_HOSTS: value } });
    await assert.rejects(generateShipmentLabel(baseOrder.id, h.deps), /SHIPROCKET_LABEL_ALLOWED_HOSTS must be a comma-separated list/);
    assert.equal(h.calls.length, 0);
  }
});

test("untrusted provider label URLs are not stored or returned", async () => {
  const h = setup({
    order: { shiprocket_shipment_id: 8001, shiprocket_state: "awb_assigned", tracking_number: "SR123456789" },
    response: { label_url: "https://attacker.example.test/phishing.pdf" },
  });
  await assert.rejects(generateShipmentLabel(baseOrder.id, h.deps), /untrusted or incomplete label URL/);
  assert.equal(h.db.order.shiprocket_label_url, undefined);
  assert.equal(h.db.order.shiprocket_state, "label_unknown");
});

test("ineligible status at label claim blocks provider call", async () => {
  const h = setup({ order: { shiprocket_shipment_id: 8001, tracking_number: "SR123456789", shiprocket_state: "awb_assigned" },
    beforeLockedRead: async order => { order.order_status = "cancelled"; } });
  await assert.rejects(generateShipmentLabel(baseOrder.id, h.deps), /not eligible/);
  assert.equal(h.calls.length, 0);
});

test("concurrent label requests issue one provider request", async () => {
  const h = setup({ order: { shiprocket_shipment_id: 8001, tracking_number: "SR123456789", shiprocket_state: "awb_assigned" } });
  const results = await Promise.allSettled([generateShipmentLabel(baseOrder.id, h.deps), generateShipmentLabel(baseOrder.id, h.deps)]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(h.calls.filter(call => call.path === "/courier/generate/label").length, 1);
});

test("ambiguous label outcome or failed local persistence blocks retries", async () => {
  for (const options of [
    { response: new ShiprocketError("outcome unknown", undefined, true) },
    { response: {} },
    { failOn: "SET shiprocket_label_url = ?" },
  ]) {
    const h = setup({
      order: { shiprocket_shipment_id: 8001, shiprocket_state: "awb_assigned", tracking_number: "SR123456789" },
      ...options,
    });
    await assert.rejects(generateShipmentLabel(baseOrder.id, h.deps));
    assert.equal(h.db.order.shiprocket_state, "label_unknown");
    await assert.rejects(generateShipmentLabel(baseOrder.id, h.deps), /needs reconciliation/);
    assert.equal(h.calls.length, 1);
  }
});
