import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { getTwilioConfig, normalizeWhatsAppPhone, processTwilioWhatsAppJob, sendPaidOrderWhatsApp } from "../src/services/twilio-whatsapp.ts";

const config = {
  accountSid: "AC00000000000000000000000000000000",
  authToken: "test-secret-token",
  from: "whatsapp:+14155238886",
  contentSid: "HX12345678901234567890123456789012",
  contentVariables: {},
};
const paidOrder = { id: "order-1", order_number: "ORDREAL1", customer_name: "Customer", total: 1234,
  customer_phone: "9876543210", payment_status: "paid", razorpay_payment_id: "pay_verified" };

function createDb({ duplicate = false } = {}) {
  const state = { status: duplicate ? "sent" : "pending", attempts: duplicate ? 1 : 0, lastError: null, job: null };
  return {
    state,
    prepare(sql) {
      return {
        async get(...params) {
          if (sql.includes("INSERT INTO notification_jobs")) {
            if (duplicate || state.job) return undefined;
            state.job = { id: params[0], status: "pending", channel: "whatsapp", attempts: 0, max_attempts: 3,
              recipient_phone: params[2], content_sid: params[4], content_variables: JSON.parse(params[5]),
              provider_message_id: null, last_error: null };
            return { ...state.job };
          }
          if (sql.includes("SELECT * FROM notification_jobs")) return state.job ? { ...state.job, status: state.status, attempts: state.attempts, last_error: state.lastError } : undefined;
          if (sql.includes("UPDATE notification_jobs") && sql.includes("RETURNING *")) {
            if (state.status !== "pending" && !(state.status === "failed" && params[2] === true)) return undefined;
            state.status = "sending";
            state.attempts += 1;
            return { ...state.job, id: params[1], status: "sending", attempts: state.attempts };
          }
          throw new Error(`Unexpected get query: ${sql}`);
        },
        async run(...params) {
          if (sql.includes("SET status = 'sent'")) { state.status = "sent"; state.job.provider_message_id = params[0]; }
          else if (sql.includes("SET status = 'failed'")) { state.status = "failed"; state.lastError = params[0]; }
          else if (sql.includes("SET status = 'unknown'")) { state.status = "unknown"; state.lastError = params[0]; }
          else throw new Error(`Unexpected run query: ${sql}`);
          return { rowCount: 1 };
        },
      };
    },
  };
}

describe("Twilio WhatsApp paid order confirmation", () => {
  test("successful verified payment sends approved no-variable template with normalized Indian number", async () => {
    const db = createDb();
    let request;
    const result = await sendPaidOrderWhatsApp(paidOrder, {
      db, config, production: true,
      fetcher: async (url, options) => {
        request = { url, options, body: new URLSearchParams(options.body) };
        return new Response(JSON.stringify({ sid: "SMaccepted" }), { status: 201 });
      },
    });
    assert.equal(result.status, "sent");
    assert.equal(db.state.status, "sent");
    assert.equal(request.body.get("To"), "whatsapp:+919876543210");
    assert.equal(request.body.get("From"), "whatsapp:+14155238886");
    assert.equal(request.body.get("ContentSid"), config.contentSid);
    assert.equal(request.body.has("ContentVariables"), false);
    assert.match(request.options.headers.Authorization, /^Basic /);
    assert.doesNotMatch(request.url + request.options.body, /test-secret-token/);
  });

  test("failed or unverified payment never sends", async () => {
    const db = createDb();
    let calls = 0;
    const result = await sendPaidOrderWhatsApp({ ...paidOrder, payment_status: "pending_payment", razorpay_payment_id: null }, {
      db, config, production: true, fetcher: async () => { calls += 1; return new Response(); },
    });
    assert.equal(result.status, "skipped");
    assert.equal(calls, 0);
    assert.equal(db.state.attempts, 0);
  });

  test("duplicate payment events do not create a second Twilio request", async () => {
    const db = createDb({ duplicate: true });
    let calls = 0;
    const result = await sendPaidOrderWhatsApp(paidOrder, {
      db, config, production: true, fetcher: async () => { calls += 1; return new Response(); },
    });
    assert.equal(result.status, "skipped");
    assert.equal(calls, 0);
  });

  test("missing configuration skips without sending and config uses only server variables", () => {
    assert.equal(getTwilioConfig({}), null);
    assert.deepEqual(getTwilioConfig({
      TWILIO_WHATSAPP_ENABLED: "true",
      TWILIO_ACCOUNT_SID: config.accountSid,
      TWILIO_AUTH_TOKEN: config.authToken,
      TWILIO_WHATSAPP_FROM: config.from,
      TWILIO_CONTENT_SID: config.contentSid,
      TWILIO_CONTENT_VARIABLES: "{}",
      TWILIO_TEMPLATE_HAS_NO_VARIABLES: "true",
    }), config);
  });

  test("approved template variables map to current database order values", async () => {
    const db = createDb();
    let requestBody;
    const result = await sendPaidOrderWhatsApp(paidOrder, {
      db, config: { ...config, contentVariables: { "1": "order_number" } }, production: true,
      fetcher: async (_url, options) => {
        requestBody = new URLSearchParams(options.body);
        return new Response(JSON.stringify({ sid: "SMaccepted" }), { status: 201 });
      },
    });
    assert.equal(result.status, "sent");
    assert.deepEqual(JSON.parse(requestBody.get("ContentVariables")), { "1": "ORDREAL1" });
  });

  test("Twilio API errors are recorded without leaking provider response or credentials", async () => {
    const db = createDb();
    const result = await sendPaidOrderWhatsApp(paidOrder, {
      db, config, production: true,
      fetcher: async () => new Response("private recipient and credentials", { status: 400 }),
    });
    assert.equal(result.status, "failed");
    assert.equal(db.state.status, "failed");
    assert.equal(paidOrder.payment_status, "paid", "notification failure must not change the successful payment state");
    assert.equal(result.error, "Twilio rejected the WhatsApp request (HTTP 400).");
    assert.doesNotMatch(db.state.lastError, /private recipient|test-secret-token/);
  });

  test("an uncertain Twilio timeout is not automatically retried or resent", async () => {
    const db = createDb();
    let calls = 0;
    const first = await sendPaidOrderWhatsApp(paidOrder, {
      db, config, production: true,
      fetcher: async () => { calls += 1; throw new Error("socket timeout"); },
    });
    const duplicate = await sendPaidOrderWhatsApp(paidOrder, {
      db, config, production: true, fetcher: async () => { calls += 1; return new Response(); },
    });
    assert.equal(first.status, "unknown");
    assert.equal(duplicate.status, "skipped");
    assert.equal(calls, 1);
    assert.equal(db.state.status, "unknown");
  });

  test("an explicit provider rejection can be manually retried, and accepted jobs stay idempotent", async () => {
    const db = createDb();
    const rejected = await sendPaidOrderWhatsApp(paidOrder, {
      db, config, production: true, fetcher: async () => new Response("rate limited", { status: 429 }),
    });
    assert.equal(rejected.status, "failed");
    let calls = 0;
    const retried = await processTwilioWhatsAppJob(db.state.job.id, {
      db, config, manualRetry: true, fetcher: async () => { calls += 1; return new Response(JSON.stringify({ sid: "SMaccepted" }), { status: 201 }); },
    });
    assert.equal(retried.status, "sent");
    const duplicate = await processTwilioWhatsAppJob(db.state.job.id, {
      db, config, manualRetry: true, fetcher: async () => { calls += 1; return new Response(); },
    });
    assert.equal(duplicate.status, "sent");
    assert.equal(calls, 1);
  });

  test("invalid numbers and non-production mode never send", async () => {
    assert.equal(normalizeWhatsAppPhone("+1 415 555 0123"), null);
    const db = createDb();
    let calls = 0;
    const result = await sendPaidOrderWhatsApp({ ...paidOrder, customer_phone: "123" }, {
      db, config, production: true, fetcher: async () => { calls += 1; return new Response(); },
    });
    assert.equal(result.status, "failed");
    assert.equal(calls, 0);
    const dev = await sendPaidOrderWhatsApp(paidOrder, {
      db: createDb(), config, production: false, fetcher: async () => { calls += 1; return new Response(); },
    });
    assert.equal(dev.status, "skipped");
    assert.equal(calls, 0);
  });
});
