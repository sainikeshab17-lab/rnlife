import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createAdminNotificationHandlers } from "../src/services/admin-notification-route.ts";

function setup({ admin = { id: "admin_1", email: "admin@example.test", role: "admin" }, result = { sent: true, provider: "resend", messageId: "provider-id" } } = {}) {
  const calls = { process: [], audit: [], db: 0 };
  const handlers = createAdminNotificationHandlers({
    requireAdminAuth: async () => admin,
    getDb: () => ({ prepare: () => ({ all: async () => [{ id: "job_1" }] }) }),
    processNotificationJob: async (...args) => { calls.process.push(args); return result; },
    writeAuditLog: async (entry) => { calls.audit.push(entry); },
  });
  const request = (method = "GET", body) => new Request("http://localhost/api/admin/notifications", {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { handlers, calls, request };
}

describe("admin notification API", () => {
  test("requires a valid session and the admin role before listing or retrying", async () => {
    for (const admin of [null, { id: "staff_1", email: "staff@example.test", role: "staff" }]) {
      const harness = setup({ admin });
      assert.ok([401, 403].includes((await harness.handlers.GET(harness.request())).status));
      assert.ok([401, 403].includes((await harness.handlers.POST(harness.request("POST", { jobId: "job_1" }))).status));
      assert.equal(harness.calls.process.length, 0);
    }
  });

  test("authorized queue requests list stored jobs and retry only the stored job id", async () => {
    const harness = setup();
    const list = await harness.handlers.GET(harness.request());
    assert.equal(list.status, 200);
    assert.deepEqual(await list.json(), { jobs: [{ id: "job_1" }] });

    const retry = await harness.handlers.POST(harness.request("POST", { jobId: " job_1 " }));
    const body = await retry.json();
    assert.equal(retry.status, 200);
    assert.equal(body.providerAccepted, true);
    assert.equal(body.deliveryConfirmed, false);
    assert.equal(harness.calls.process[0][0], "job_1");
    assert.deepEqual(harness.calls.process[0][1], { manualRetry: true });
    assert.equal(harness.calls.audit[0].action, "notification_retry");
    assert.equal("error" in harness.calls.audit[0].metadata, false);
  });

  test("provider rejection reports not-sent rather than a false send success", async () => {
    const harness = setup({ result: { sent: false, provider: "resend", error: "Resend rejected request (HTTP 422)." } });
    const response = await harness.handlers.POST(harness.request("POST", { jobId: "job_1" }));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.providerAccepted, false);
    assert.equal(body.deliveryConfirmed, false);
    assert.equal(body.message, "The notification was not sent. Review its status before retrying.");
  });

  test("already-sent notifications are reported without another provider attempt", async () => {
    const harness = setup({ result: { sent: true, alreadySent: true, provider: "resend", messageId: "previous-id" } });
    const response = await harness.handlers.POST(harness.request("POST", { jobId: "job_1" }));
    const body = await response.json();
    assert.equal(body.providerAccepted, false);
    assert.equal(body.alreadySent, true);
    assert.equal(body.message, "This notification was already accepted previously; no duplicate was sent.");
  });

  test("malformed and missing notification job IDs are rejected without provider calls", async () => {
    const harness = setup();
    const malformed = await harness.handlers.POST(new Request("http://localhost/api/admin/notifications", { method: "POST", body: "not json" }));
    assert.equal(malformed.status, 400);
    const missing = await harness.handlers.POST(harness.request("POST", { jobId: " " }));
    assert.equal(missing.status, 400);
    assert.equal(harness.calls.process.length, 0);
  });
});
