import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyRefundWebhook,
  isLegalRefundInboxTransition,
  refundWebhookEventKey,
  stablePayloadFingerprint,
} from "../src/services/razorpay/refund-webhook-inbox-policy.ts";

test("refund processed status mismatches and nonterminal event types are classified for quarantine", () => {
  assert.equal(classifyRefundWebhook("refund.processed", "pending"), "refund_processed_status_mismatch");
  assert.equal(classifyRefundWebhook("refund.processed", "processed"), null);
  assert.equal(classifyRefundWebhook("refund.speed_changed", "processed"), "refund_speed_changed_not_a_terminal_refund_outcome");
  assert.equal(classifyRefundWebhook("refund.failed", "failed"), null);
});

test("provider event IDs distinguish source events and deduplicate the same event", () => {
  assert.equal(refundWebhookEventKey("evt_same", "a"), refundWebhookEventKey("evt_same", "b"));
  assert.notEqual(refundWebhookEventKey("evt_one", "same"), refundWebhookEventKey("evt_two", "same"));
});

test("missing event IDs use a deterministic canonical payload fingerprint", () => {
  const first = stablePayloadFingerprint({ event: "refund.processed", payload: { id: "rf_1", status: "processed" } });
  const reordered = stablePayloadFingerprint({ payload: { status: "processed", id: "rf_1" }, event: "refund.processed" });
  const distinctSourcePayload = stablePayloadFingerprint({ event: "refund.processed", payload: { id: "rf_1", status: "processed", attempt: 2 } });
  assert.equal(first, reordered);
  assert.equal(refundWebhookEventKey(null, first), refundWebhookEventKey(undefined, reordered));
  assert.notEqual(refundWebhookEventKey(null, first), refundWebhookEventKey(null, distinctSourcePayload));
});

test("legal inbox transitions keep processed and quarantined terminal", () => {
  assert.equal(isLegalRefundInboxTransition("received", "deferred"), true);
  assert.equal(isLegalRefundInboxTransition("deferred", "processed"), true);
  assert.equal(isLegalRefundInboxTransition("processed", "deferred"), false);
  assert.equal(isLegalRefundInboxTransition("quarantined", "processed"), false);
});
