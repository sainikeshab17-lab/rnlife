import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { reconcileRefundReservation, resolveProviderRefund } from "../src/services/refund-reconciliation.ts";

const reservation = {
  id: "ref_local_1",
  order_id: "ord_123",
  order_number: "RNL-123",
  razorpay_payment_id: "pay_123",
  razorpay_refund_id: null,
  amount_paisa: 25000,
  currency: "INR",
  status: "pending",
  created_at: new Date(Date.now() - 30_000).toISOString(),
};

function providerWithRefund(refund) {
  return {
    fetchRefund: async () => refund,
    fetchRefunds: async () => refund ? [refund] : [],
  };
}

function validRefund(overrides = {}) {
  return {
    id: "rfnd_123",
    payment_id: reservation.razorpay_payment_id,
    amount: reservation.amount_paisa,
    currency: "INR",
    status: "processed",
    created_at: Math.floor(Date.now() / 1000),
    notes: { orderId: reservation.order_id, orderNumber: reservation.order_number },
    ...overrides,
  };
}

describe("pending refund reconciliation against provider snapshots", () => {
  test("reconciles a processed refund found by payment and order notes", async () => {
    const result = await resolveProviderRefund(reservation, providerWithRefund(validRefund()));
    assert.equal(result.outcome, "processed");
    assert.equal(result.refund.id, "rfnd_123");
  });

  test("reconciles a provider-confirmed failure by stored refund ID", async () => {
    const knownId = { ...reservation, razorpay_refund_id: "rfnd_123" };
    const result = await resolveProviderRefund(knownId, providerWithRefund(validRefund({ status: "failed" })));
    assert.equal(result.outcome, "failed");
  });

  test("keeps a provider-pending refund pending", async () => {
    const result = await resolveProviderRefund(reservation, providerWithRefund(validRefund({ status: "pending" })));
    assert.equal(result.outcome, "pending");
  });

  test("treats a missing refund as inconclusive rather than failure", async () => {
    const result = await resolveProviderRefund(reservation, providerWithRefund(null));
    assert.equal(result.outcome, "missing");
  });

  test("quarantines mismatched payment, amount, currency, order, and ambiguous candidates", async () => {
    for (const refund of [
      validRefund({ payment_id: "pay_other" }),
      validRefund({ amount: 24999 }),
      validRefund({ currency: "USD" }),
      validRefund({ notes: { orderId: "ord_other" } }),
    ]) {
      const result = await resolveProviderRefund(reservation, providerWithRefund(refund));
      assert.equal(result.outcome, "contradictory");
    }
    const duplicateProvider = { fetchRefund: async () => validRefund(), fetchRefunds: async () => [validRefund(), validRefund({ id: "rfnd_456" })] };
    assert.equal((await resolveProviderRefund(reservation, duplicateProvider)).outcome, "contradictory");
  });

  test("keeps reservations pending when provider lookup is unavailable and repeated snapshots are idempotent", async () => {
    const unavailable = await resolveProviderRefund(reservation, {
      fetchRefund: async () => { throw new Error("network timeout"); },
      fetchRefunds: async () => { throw new Error("network timeout"); },
    });
    assert.equal(unavailable.outcome, "uncertain");

    const provider = providerWithRefund(validRefund());
    const [first, retry] = await Promise.all([
      resolveProviderRefund(reservation, provider),
      resolveProviderRefund(reservation, provider),
    ]);
    assert.equal(first.outcome, "processed");
    assert.deepEqual(retry, first);
  });

  test("mocked reconciliation applies terminal provider state and deduplicates repeated processed notices", async () => {
    const stored = { status: "pending", razorpay_refund_id: null, amount_paisa: reservation.amount_paisa };
    const queuedKeys = new Set();
    let providerCalls = 0;
    const provider = providerWithRefund(validRefund());
    const args = {
      reservation,
      provider: {
        fetchRefund: provider.fetchRefund,
        fetchRefunds: async (paymentId) => { providerCalls += 1; return provider.fetchRefunds(paymentId); },
      },
      apply: async (resolution) => {
        if (stored.status === "pending") {
          stored.status = resolution.outcome;
          stored.razorpay_refund_id = resolution.refund.id;
        }
        return stored;
      },
      notifyProcessed: async (refund) => { queuedKeys.add(`notif_rfnd_${refund.razorpay_refund_id}`); },
    };
    const first = await reconcileRefundReservation(args);
    const second = await reconcileRefundReservation(args);
    assert.equal(first.stored.status, "processed");
    assert.equal(second.stored.status, "processed");
    assert.equal(providerCalls, 2);
    assert.equal(queuedKeys.size, 1);
  });

  test("mocked failed and pending outcomes never queue confirmation mail; missing and contradictory outcomes never mutate", async () => {
    for (const status of ["failed", "pending"]) {
      const stored = { status: "pending", razorpay_refund_id: null, amount_paisa: reservation.amount_paisa };
      let emails = 0;
      const result = await reconcileRefundReservation({
        reservation,
        provider: providerWithRefund(validRefund({ status })),
        apply: async (resolution) => { stored.status = resolution.outcome; stored.razorpay_refund_id = resolution.refund.id; return stored; },
        notifyProcessed: async () => { emails += 1; },
      });
      assert.equal(result.stored.status, status);
      assert.equal(emails, 0);
    }

    for (const refund of [null, validRefund({ amount: 1 })]) {
      let mutations = 0;
      const result = await reconcileRefundReservation({
        reservation, provider: providerWithRefund(refund),
        apply: async () => { mutations += 1; return undefined; }, notifyProcessed: async () => undefined,
      });
      assert.ok(["missing", "contradictory"].includes(result.resolution.outcome));
      assert.equal(mutations, 0);
    }
  });

  test("the reconciliation endpoint is admin-only and applies provider results through the idempotent DB helper", async () => {
    const fs = await import("node:fs");
    const route = fs.readFileSync("src/app/api/admin/refunds/[refundId]/reconcile/route.ts", "utf8");
    const handler = fs.readFileSync("src/services/refund-reconciliation-route.ts", "utf8");
    assert.match(route, /POST = createRefundReconciliationPost\(\)/);
    assert.match(handler, /requireAdminAuth\(req\)/);
    assert.match(handler, /admin\.role !== "admin"/);
    assert.match(handler, /reconcileRefundReservation\(/);
    assert.match(handler, /applyRefundReconciliation\(/);
  });
});
