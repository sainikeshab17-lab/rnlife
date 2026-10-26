import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { GET, POST } from "../src/services/whatsapp-webhook.ts";

const originalVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
const originalAppSecret = process.env.META_APP_SECRET;
const verifyToken = "test-webhook-token";
const appSecret = "test-meta-app-secret";

after(() => {
  if (originalVerifyToken === undefined) delete process.env.WHATSAPP_VERIFY_TOKEN;
  else process.env.WHATSAPP_VERIFY_TOKEN = originalVerifyToken;
  if (originalAppSecret === undefined) delete process.env.META_APP_SECRET;
  else process.env.META_APP_SECRET = originalAppSecret;
});

function signedRequest(body, signature = true) {
  const headers = { "content-type": "application/json" };
  if (signature) {
    headers["x-hub-signature-256"] = `sha256=${createHmac("sha256", appSecret).update(body).digest("hex")}`;
  }
  return new Request("http://localhost/api/webhooks/whatsapp", { method: "POST", headers, body });
}

describe("WhatsApp Cloud API webhook", () => {
  test("verifies Meta subscription and returns the challenge as plain text", async () => {
    process.env.WHATSAPP_VERIFY_TOKEN = verifyToken;
    const response = await GET(new Request(`http://localhost/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=challenge-123`));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "text/plain; charset=utf-8");
    assert.equal(await response.text(), "challenge-123");
  });

  test("rejects an invalid verification token", async () => {
    process.env.WHATSAPP_VERIFY_TOKEN = verifyToken;
    const response = await GET(new Request("http://localhost/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=challenge-123"));
    assert.equal(response.status, 403);
  });

  test("accepts valid signatures and classifies messages and status updates", async () => {
    process.env.META_APP_SECRET = appSecret;
    const body = JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: "business-id", changes: [{
      field: "messages", value: { messages: [{ id: "message-id", from: "15551234567", type: "text", text: { body: "private customer content" } }], statuses: [{ id: "message-id", status: "delivered", recipient_id: "15551234567" }] },
    }] }] });
    const response = await POST(signedRequest(body));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "accepted", messages: 1, statuses: 1 });
  });

  test("rejects invalid or missing signatures", async () => {
    process.env.META_APP_SECRET = appSecret;
    const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
    const invalid = await POST(new Request("http://localhost/api/webhooks/whatsapp", { method: "POST", headers: { "x-hub-signature-256": `sha256=${"0".repeat(64)}` }, body }));
    const missing = await POST(signedRequest(body, false));
    assert.equal(invalid.status, 401);
    assert.equal(missing.status, 401);
  });

  test("safely rejects malformed JSON and malformed event structure", async () => {
    process.env.META_APP_SECRET = appSecret;
    const malformedJson = await POST(signedRequest("{"));
    const invalidEnvelope = await POST(signedRequest(JSON.stringify({ object: "not_whatsapp", entry: [] })));
    assert.equal(malformedJson.status, 400);
    assert.equal(invalidEnvelope.status, 400);
  });
});
