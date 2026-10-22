import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRefundReconciliationPost } from "../src/services/refund-reconciliation-route.ts";
import { reconcileRefundReservation } from "../src/services/refund-reconciliation.ts";

const now = Math.floor(Date.now() / 1000);
const baseReservation = {
  id: "refund_local_1", order_id: "order_local_1", order_number: "RNL-1",
  razorpay_payment_id: "pay_1", razorpay_refund_id: null, amount_paisa: 25000,
  currency: "INR", status: "pending", created_at: new Date(now * 1000 - 30_000).toISOString(),
};
const order = { id: baseReservation.order_id, order_number: baseReservation.order_number, customer_email: "buyer@example.test" };

function setup({ auth = { email: "admin@example.test", role: "admin" }, refundStatus = "processed", refundOverrides = {}, applyOutcome, missing = false } = {}) {
  const reservation = { ...baseReservation };
  const refund = {
    id: "rfnd_1", payment_id: reservation.razorpay_payment_id, amount: reservation.amount_paisa,
    currency: "INR", status: refundStatus, created_at: now,
    notes: { orderId: reservation.order_id, orderNumber: reservation.order_number }, ...refundOverrides,
  };
  const emailKeys = new Set();
  let emailAttempts = 0;
  let applyCalls = 0;
  let providerCalls = 0;
  const deps = {
    requireAdminAuth: async () => auth,
    getDb: () => ({ prepare: () => ({ get: async () => reservation }) }),
    getOrderById: async () => order,
    getRazorpayClient: () => ({ payments: {
      fetchRefund: async () => { providerCalls += 1; return refund; },
      fetchMultipleRefund: async () => { providerCalls += 1; return { items: missing ? [] : [refund] }; },
    } }),
    applyRefundReconciliation: async ({ providerRefundId, providerStatus }) => {
      applyCalls += 1;
      if (applyOutcome) return { outcome: applyOutcome, refund: { ...reservation } };
      Object.assign(reservation, { status: providerStatus, razorpay_refund_id: providerRefundId });
      return { outcome: "applied", refund: { ...reservation } };
    },
    sendRefundConfirmationEmail: async (_order, _amount, refundId) => {
      emailAttempts += 1;
      emailKeys.add(`notif_rfnd_${refundId}`);
    },
    reconcileRefundReservation,
    writeAuditLog: async () => undefined,
  };
  const handler = createRefundReconciliationPost(deps);
  const invoke = () => handler(new Request("http://localhost/api/admin/refunds/refund_local_1/reconcile"), {
    params: Promise.resolve({ refundId: reservation.id }),
  });
  return { invoke, reservation, emailKeys, deps, get emailAttempts() { return emailAttempts; }, get applyCalls() { return applyCalls; }, get providerCalls() { return providerCalls; } };
}

describe("admin refund reconciliation route", () => {
  test("rejects missing session and any non-admin role before provider access", async () => {
    for (const auth of [null, { email: "staff@example.test", role: "staff" }, { email: "user@example.test" }]) {
      const harness = setup({ auth });
      const response = await harness.invoke();
      assert.ok([401, 403].includes(response.status));
      assert.equal(harness.providerCalls, 0);
    }
  });

  test("applies verified processed status and deduplicates repeated confirmation jobs", async () => {
    const harness = setup();
    const first = await harness.invoke();
    assert.equal(first.status, 200);
    assert.equal((await first.json()).status, "processed");
    assert.equal(harness.reservation.status, "processed");
    assert.equal(harness.emailKeys.size, 1);

    const retry = await harness.invoke();
    assert.equal((await retry.json()).status, "processed");
    assert.equal(harness.emailKeys.size, 1);
  });

  test("applies provider failure without a processed confirmation", async () => {
    const harness = setup({ refundStatus: "failed" });
    const response = await harness.invoke();
    assert.equal(response.status, 200);
    assert.equal(harness.reservation.status, "failed");
    assert.equal(harness.emailAttempts, 0);
  });

  test("keeps pending, missing, and contradictory outcomes unresolved", async () => {
    const pending = setup({ refundStatus: "pending" });
    assert.equal((await pending.invoke()).status, 200);
    assert.equal(pending.reservation.status, "pending");
    assert.equal(pending.emailAttempts, 0);

    const missing = setup({ missing: true });
    const missingResponse = await missing.invoke();
    assert.equal(missingResponse.status, 202);
    assert.equal(missing.reservation.status, "pending");
    assert.equal(missing.applyCalls, 0);

    const contradictory = setup({ refundOverrides: { amount: 1 } });
    const conflict = await contradictory.invoke();
    assert.equal(conflict.status, 409);
    assert.equal(contradictory.reservation.status, "pending");
    assert.equal(contradictory.emailAttempts, 0);
  });
});
