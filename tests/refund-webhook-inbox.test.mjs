import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { receiveRazorpayRefundWebhook } from "../src/services/razorpay/refund-webhook-inbox.ts";

function createMockDb({ failInsert = false } = {}) {
  const rows = new Map();
  const attempts = [];
  const db = {
    prepare(sql) {
      return {
        async run(...params) {
          if (sql.includes("INSERT INTO razorpay_refund_webhook_inbox")) {
            if (failInsert) throw new Error("simulated durable inbox write failure");
            const [key, sourceId, payloadFingerprint, eventType, refundId, paymentId, orderId, amount, currency, providerStatus] = params;
            const existing = [...rows.values()].find(row => row.event_key === key || (sourceId && row.provider_event_id === sourceId));
            if (existing) return { rowCount: 0 };
            rows.set(key, { event_key: key, provider_event_id: sourceId, payloadFingerprint, eventType, refundId, paymentId, orderId, amountPaisa: amount, currency, providerStatus, state: "received", attempts: 0 });
            return { rowCount: 1 };
          }
          if (sql.includes("INSERT INTO razorpay_refund_webhook_attempts")) {
            attempts.push({ eventKey: params[0], outcome: params[1], reason: params[2] });
            return { rowCount: 1 };
          }
          if (sql.includes("UPDATE razorpay_refund_webhook_inbox SET state = ?")) {
            const [state, reason, , key, previousState] = params;
            const row = rows.get(key);
            if (!row || row.state !== previousState) return { rowCount: 0 };
            row.state = state;
            row.attempts += 1;
            row.last_error = reason;
            return { rowCount: 1 };
          }
          if (sql.includes("UPDATE razorpay_refund_webhook_inbox SET attempts = attempts + 1")) {
            const [reason, , key, expectedState] = params;
            const row = rows.get(key);
            if (row?.state === expectedState) { row.attempts += 1; row.last_error = reason; }
            return { rowCount: row?.state === expectedState ? 1 : 0 };
          }
          throw new Error(`Unexpected mock SQL run: ${sql}`);
        },
        async get(...params) {
          if (sql.includes("SELECT id FROM orders")) return undefined;
          if (sql.includes("FROM razorpay_refund_webhook_inbox WHERE event_key = ? OR")) {
            const key = params[0];
            const sourceId = params[2];
            return rows.get(key) ?? [...rows.values()].find(row => sourceId && row.provider_event_id === sourceId);
          }
          if (sql.includes("FROM razorpay_refund_webhook_inbox WHERE event_key = ? FOR UPDATE")) return rows.get(params[0]);
          if (sql.includes("SELECT state FROM razorpay_refund_webhook_inbox")) {
            const row = rows.get(params[0]);
            return row ? { state: row.state } : undefined;
          }
          throw new Error(`Unexpected mock SQL get: ${sql}`);
        },
      };
    },
  };
  const transaction = callback => callback(db);
  return { db, rows, attempts, transaction };
}

const mismatchEvent = overrides => ({
  eventType: "refund.processed",
  refundId: "rf_test_1",
  paymentId: "pay_test_1",
  amountPaisa: 1500,
  currency: "INR",
  providerStatus: "pending",
  sourceEventId: "evt_test_mismatch",
  payloadFingerprint: "fingerprint_a",
  quarantineReason: "refund_processed_status_mismatch",
  ...overrides,
});

test("mismatched refund.processed status is durably quarantined without applying a refund", async () => {
  const h = createMockDb();
  const outcome = await receiveRazorpayRefundWebhook(mismatchEvent(), { transaction: h.transaction });
  assert.equal(outcome.state, "quarantined");
  assert.equal(h.rows.size, 1);
  assert.equal([...h.rows.values()][0].state, "quarantined");
  assert.equal(h.attempts.some(attempt => attempt.outcome === "quarantined" && attempt.reason === "refund_processed_status_mismatch"), true);
  assert.equal(h.attempts.some(attempt => attempt.outcome === "processed"), false);
});

test("webhook verifies the raw body before parsing and returns non-success when durable processing throws", () => {
  const route = fs.readFileSync("src/app/api/webhooks/razorpay/route.ts", "utf8");
  assert.ok(route.indexOf("verifyWebhookSignature(rawBody") < route.indexOf("JSON.parse(rawBody)"));
  assert.match(route, /quarantineReason:\s*classifyRefundWebhook\(eventType, refundEntity\.status\)/);
  assert.match(route, /status:\s*500/);
});

test("durable inbox write failure rejects processing so the webhook cannot acknowledge success", async () => {
  const h = createMockDb({ failInsert: true });
  await assert.rejects(receiveRazorpayRefundWebhook(mismatchEvent(), { transaction: h.transaction }), /simulated durable inbox write failure/);
  assert.equal(h.rows.size, 0);
});

test("duplicate provider event delivery is idempotent and separately identified events remain distinct", async () => {
  const h = createMockDb();
  const event = mismatchEvent();
  assert.equal((await receiveRazorpayRefundWebhook(event, { transaction: h.transaction })).state, "quarantined");
  assert.equal((await receiveRazorpayRefundWebhook(event, { transaction: h.transaction })).state, "quarantined");
  assert.equal(h.rows.size, 1);
  assert.equal(h.attempts.filter(attempt => attempt.outcome === "duplicate").length, 1);

  await receiveRazorpayRefundWebhook(mismatchEvent({ sourceEventId: "evt_test_distinct", payloadFingerprint: "fingerprint_b" }), { transaction: h.transaction });
  assert.equal(h.rows.size, 2);

  const conflict = await receiveRazorpayRefundWebhook(mismatchEvent({ payloadFingerprint: "different_signed_payload" }), { transaction: h.transaction });
  assert.equal(conflict.state, "quarantined");
  assert.equal([...h.rows.values()].find(row => row.provider_event_id === "evt_test_mismatch").state, "quarantined");
});

test("missing provider event IDs use a stable payload-derived inbox identity", async () => {
  const h = createMockDb();
  const event = mismatchEvent({ sourceEventId: null, payloadFingerprint: "canonical_payload_hash" });
  await receiveRazorpayRefundWebhook(event, { transaction: h.transaction });
  await receiveRazorpayRefundWebhook(event, { transaction: h.transaction });
  assert.equal(h.rows.size, 1);
  assert.equal([...h.rows.values()][0].provider_event_id, null);
});
