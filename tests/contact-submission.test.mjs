import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  ContactEmailConfigurationError,
  ContactEmailProviderError,
  createContactSubmissionHandler,
  sendContactSubmissionEmail,
} from "../src/services/contact-submission.ts";

const contact = {
  type: "contact",
  name: "Rohan Sharma",
  email: "rohan@example.com",
  subject: "Order question",
  message: "Please help with my order.",
};

function request(body, headers = {}) {
  return new Request("http://localhost/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

test("contact email uses configured sender, correct recipient, reply-to, and formatted timestamp", async () => {
  let sent;
  const result = await sendContactSubmissionEmail(contact, {
    apiKey: "mock-key",
    from: "RIGHTNOWLIFE <verified@example.com>",
    now: () => new Date("2026-10-22T12:30:00.000Z"),
    fetcher: async (url, options) => {
      assert.equal(url, "https://api.resend.com/emails");
      sent = JSON.parse(options.body);
      return Response.json({ id: "mock-message-id" });
    },
  });
  assert.deepEqual(result, { messageId: "mock-message-id" });
  assert.equal(sent.from, "RIGHTNOWLIFE <verified@example.com>");
  assert.deepEqual(sent.to, ["rightnowlife8@gmail.com"]);
  assert.equal(sent.reply_to, contact.email);
  assert.match(sent.text, /2026-10-22T12:30:00.000Z/);
  assert.match(sent.text, /Please help with my order\./);
});

test("Drop Notes requests use the shared recipient and are labeled as signup requests", async () => {
  let sent;
  await sendContactSubmissionEmail({ type: "drop_notes", email: "drop@example.com" }, {
    apiKey: "mock-key",
    from: "RIGHTNOWLIFE <verified@example.com>",
    fetcher: async (_url, options) => {
      sent = JSON.parse(options.body);
      return Response.json({ id: "mock-id" });
    },
  });
  assert.deepEqual(sent.to, ["rightnowlife8@gmail.com"]);
  assert.equal(sent.subject, "Drop Notes signup request");
  assert.equal(sent.reply_to, undefined);
});

test("email content is escaped and provider errors never expose provider response bodies", async () => {
  let sent;
  await sendContactSubmissionEmail({ ...contact, name: "<img src=x>", message: "<script>alert(1)</script>" }, {
    apiKey: "mock-key",
    from: "verified@example.com",
    fetcher: async (_url, options) => {
      sent = JSON.parse(options.body);
      return Response.json({ id: "mock-id" });
    },
  });
  assert.match(sent.html, /&lt;img src=x&gt;/);
  assert.doesNotMatch(sent.html, /<script>/);

  await assert.rejects(
    sendContactSubmissionEmail(contact, {
      apiKey: "mock-key",
      from: "verified@example.com",
      fetcher: async () => new Response("private provider detail", { status: 500 }),
    }),
    ContactEmailProviderError,
  );
  await assert.rejects(
    sendContactSubmissionEmail(contact, {
      apiKey: "mock-key",
      from: "verified@example.com",
      fetcher: async () => { throw new Error("network secret"); },
    }),
    ContactEmailProviderError,
  );
});

test("missing server email configuration is reported without attempting provider delivery", async () => {
  await assert.rejects(sendContactSubmissionEmail(contact, { apiKey: "", from: "" }), ContactEmailConfigurationError);
});

test("handler accepts contact and Drop Notes only after the mocked provider accepts", async () => {
  const submitted = [];
  const handler = createContactSubmissionHandler({
    send: async (submission) => { submitted.push(submission); },
    allowRequest: () => true,
  });
  for (const body of [contact, { type: "drop_notes", email: "drop@example.com" }]) {
    const response = await handler(request(body));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, status: "accepted" });
  }
  assert.equal(submitted.length, 2);
  assert.deepEqual(submitted[0], contact);
  assert.deepEqual(submitted[1], { type: "drop_notes", email: "drop@example.com" });
});

test("handler rejects invalid, empty, overlong, and honeypot submissions without sending", async () => {
  let sends = 0;
  const handler = createContactSubmissionHandler({ send: async () => { sends += 1; }, allowRequest: () => true });
  for (const body of [
    {},
    { ...contact, name: " " },
    { ...contact, email: "not-an-email" },
    { ...contact, message: "" },
    { ...contact, message: "x".repeat(5001) },
    { ...contact, website: "spam.example" },
    { type: "drop_notes", email: "not-an-email" },
  ]) {
    const response = await handler(request(body));
    assert.ok(response.status >= 400);
  }
  assert.equal(sends, 0);
});

test("handler enforces rate limits and gives retryable errors when delivery fails", async () => {
  const throttled = createContactSubmissionHandler({ send: async () => assert.fail("should not send"), allowRequest: () => false });
  const limited = await throttled(request(contact));
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "600");

  const failed = createContactSubmissionHandler({ send: async () => { throw new ContactEmailProviderError(); }, allowRequest: () => true });
  const response = await failed(request(contact));
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /try again/);
});

test("public support email and account label behavior are consistent", () => {
  const root = process.cwd();
  const publicSources = [
    "src/data/mock-data.ts",
    "src/app/privacy/page.tsx",
    "src/app/returns/page.tsx",
    "src/app/shipping/page.tsx",
    "src/app/terms/page.tsx",
  ];
  for (const file of publicSources) {
    assert.doesNotMatch(fs.readFileSync(path.join(root, file), "utf8"), /contact@rightnowlife\.com/);
  }
  assert.match(fs.readFileSync(path.join(root, "src/data/mock-data.ts"), "utf8"), /supportEmail: SUPPORT_EMAIL/);
  assert.match(fs.readFileSync(path.join(root, "src/lib/support-contact.ts"), "utf8"), /SUPPORT_EMAIL = "rightnowlife8@gmail\.com"/);
  const navbar = fs.readFileSync(path.join(root, "src/components/layout/Navbar.tsx"), "utf8");
  assert.match(navbar, /user\.role !== "customer"/);
  assert.match(navbar, /\{user\.role\} Demo Account/);
  const contactPage = fs.readFileSync(path.join(root, "src/app/contact/page.tsx"), "utf8");
  const footer = fs.readFileSync(path.join(root, "src/components/layout/Footer.tsx"), "utf8");
  assert.match(contactPage, /fetch\("\/api\/contact"/);
  assert.match(footer, /type: "drop_notes"/);
  assert.doesNotMatch(contactPage, /Phase 1 Prototype|demo fixtures/i);
});
