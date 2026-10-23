import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { processNotificationJob } from "../src/services/notification-service.ts";

const fixedNow = new Date("2026-10-23T12:00:00.000Z");

function notificationJob(overrides = {}) {
  return {
    id: "notif_test_1",
    order_id: "order_test_1",
    recipient_email: "recipient@example.test",
    recipient_name: "Test Recipient",
    event_type: "order_confirmation",
    subject: "Order confirmation",
    body_text: "Test body",
    body_html: "<p>Test body</p>",
    status: "pending",
    provider: "",
    provider_message_id: null,
    attempts: 0,
    max_attempts: 3,
    last_error: null,
    idempotency_key: "notif_test_idempotency",
    created_at: fixedNow.toISOString(),
    updated_at: fixedNow.toISOString(),
    ...overrides,
  };
}

function createJobDb(initialJob) {
  const state = { job: { ...initialJob } };
  return {
    state,
    prepare(sql) {
      return {
        async get(...params) {
          if (sql.includes("RETURNING *") && sql.includes("UPDATE notification_jobs")) {
            const eligible = state.job && state.job.id === params[1] && state.job.attempts < state.job.max_attempts &&
              ["pending", "failed", "skipped"].includes(state.job.status);
            if (!eligible) return undefined;
            state.job = { ...state.job, status: "sending", provider: "resend", attempts: state.job.attempts + 1, last_error: null, updated_at: params[0] };
            return { ...state.job };
          }
          if (sql.includes("SELECT * FROM notification_jobs")) {
            return state.job?.id === params[0] ? { ...state.job } : undefined;
          }
          if (sql.includes("UPDATE notification_jobs")) {
            if (!state.job || state.job.id !== params.at(-1)) return undefined;
            if (sql.includes("status = 'skipped'")) {
              state.job = { ...state.job, status: "skipped", last_error: "No supported email provider configured (RESEND_API_KEY missing).", updated_at: params[0] };
            } else if (sql.includes("SET status = 'sent'")) {
              state.job = { ...state.job, status: "sent", provider: "resend", provider_message_id: params[0], last_error: null, updated_at: params[1] };
            } else if (sql.includes("SET status = 'pending'")) {
              state.job = { ...state.job, status: "pending", max_attempts: state.job.max_attempts + 3, updated_at: params[0] };
            }
            return { ...state.job };
          }
          throw new Error(`Unexpected database get: ${sql}`);
        },
        async run(...params) {
          if (!state.job || state.job.id !== params.at(-1)) return { rowCount: 0 };
          if (sql.includes("SET status = 'skipped'")) {
            state.job = { ...state.job, status: "skipped", last_error: "No supported email provider configured (RESEND_API_KEY missing).", updated_at: params[0] };
            return { rowCount: 1 };
          }
          if (sql.includes("SET status = 'pending'")) {
            state.job = { ...state.job, status: "pending", max_attempts: state.job.max_attempts + 3, updated_at: params[0] };
            return { rowCount: 1 };
          }
          if (sql.includes("SET status = 'sent'")) {
            state.job = { ...state.job, status: "sent", provider: "resend", provider_message_id: params[0], last_error: null, updated_at: params[1] };
            return { rowCount: 1 };
          }
          const [status, lastError, updatedAt] = params;
          state.job = { ...state.job, status, last_error: lastError, updated_at: updatedAt };
          return { rowCount: 1 };
        },
        async all() { return []; },
      };
    },
  };
}

describe("notification delivery through mocked Resend", () => {
  test("missing provider configuration skips delivery and never calls fetch", async () => {
    const db = createJobDb(notificationJob());
    let calls = 0;
    const result = await processNotificationJob("notif_test_1", {
      db, apiKey: "", now: () => fixedNow, fetcher: async () => { calls += 1; throw new Error("must not call provider"); },
    });
    assert.equal(result.sent, false);
    assert.equal(result.provider, "none");
    assert.equal(db.state.job.status, "skipped");
    assert.equal(calls, 0);
  });

  test("successful retry uses the stored recipient and content with a stable provider idempotency key", async () => {
    const db = createJobDb(notificationJob());
    let request;
    const result = await processNotificationJob("notif_test_1", {
      db, apiKey: "mock_resend_key", from: "RightNowLife <test@example.test>", now: () => fixedNow,
      fetcher: async (url, options) => {
        request = { url, options, body: JSON.parse(options.body) };
        return new Response(JSON.stringify({ id: "resend_mock_accepted" }), { status: 200 });
      },
    });
    assert.equal(result.sent, true);
    assert.equal(result.messageId, "resend_mock_accepted");
    assert.equal(db.state.job.status, "sent");
    assert.equal(request.url, "https://api.resend.com/emails");
    assert.equal(request.body.to[0], "recipient@example.test");
    assert.equal(request.body.subject, "Order confirmation");
    assert.equal(request.options.headers["Idempotency-Key"], "notif_test_idempotency");
    assert.equal(request.options.headers.Authorization, "Bearer mock_resend_key");
  });

  test("provider rejection is retryable, status-bearing, and does not expose the provider response body", async () => {
    const db = createJobDb(notificationJob());
    const result = await processNotificationJob("notif_test_1", {
      db, apiKey: "mock_resend_key", now: () => fixedNow,
      fetcher: async () => new Response("private recipient and request details", { status: 422 }),
    });
    assert.equal(result.sent, false);
    assert.equal(db.state.job.status, "pending");
    assert.equal(result.error, "Resend rejected request (HTTP 422).");
    assert.doesNotMatch(db.state.job.last_error, /private recipient/);
  });

  test("failed and pending jobs may retry, already-sent jobs do not send again, and unknown jobs do not send", async () => {
    for (const status of ["pending", "failed"]) {
      const db = createJobDb(notificationJob({ status }));
      let calls = 0;
      const result = await processNotificationJob("notif_test_1", {
        db, manualRetry: true, apiKey: "mock_resend_key", now: () => fixedNow,
        fetcher: async () => { calls += 1; return new Response(JSON.stringify({ id: "accepted" }), { status: 200 }); },
      });
      assert.equal(result.sent, true, `${status} jobs should be retryable`);
      assert.equal(calls, 1);
    }

    const sentDb = createJobDb(notificationJob({ status: "sent", provider: "resend", provider_message_id: "already_sent" }));
    let sends = 0;
    const alreadySent = await processNotificationJob("notif_test_1", { db: sentDb, apiKey: "mock_resend_key", fetcher: async () => { sends += 1; return new Response(); } });
    assert.equal(alreadySent.sent, true);
    assert.equal(alreadySent.alreadySent, true);
    assert.equal(sends, 0);

    const unknownDb = createJobDb(notificationJob({ status: "unknown", attempts: 1 }));
    const unknown = await processNotificationJob("notif_test_1", { db: unknownDb, apiKey: "mock_resend_key", fetcher: async () => { sends += 1; return new Response(); } });
    assert.equal(unknown.sent, false);
    assert.equal(sends, 0);
  });

  test("concurrent manual retries claim the job once", async () => {
    const db = createJobDb(notificationJob());
    let calls = 0;
    const options = {
      db, manualRetry: true, apiKey: "mock_resend_key", now: () => fixedNow,
      fetcher: async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return new Response(JSON.stringify({ id: "accepted_once" }), { status: 200 });
      },
    };
    const results = await Promise.all([
      processNotificationJob("notif_test_1", options),
      processNotificationJob("notif_test_1", options),
    ]);
    assert.equal(calls, 1);
    assert.equal(results.filter((result) => result.sent).length, 1);
    assert.equal(db.state.job.status, "sent");
  });
});
