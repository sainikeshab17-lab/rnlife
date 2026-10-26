import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_WEBHOOK_BODY_BYTES = 1_000_000;

type WebhookEventSummary = { messages: number; statuses: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function summarizeWebhookEvent(payload: unknown): WebhookEventSummary | null {
  if (!isRecord(payload) || payload.object !== "whatsapp_business_account" || !Array.isArray(payload.entry)) {
    return null;
  }

  let messages = 0;
  let statuses = 0;
  for (const entry of payload.entry) {
    if (!isRecord(entry) || !Array.isArray(entry.changes)) return null;
    for (const change of entry.changes) {
      if (!isRecord(change) || typeof change.field !== "string" || !isRecord(change.value)) return null;
      const { value } = change;
      if (value.messages !== undefined) {
        if (!Array.isArray(value.messages) || !value.messages.every(isRecord)) return null;
        messages += value.messages.length;
      }
      if (value.statuses !== undefined) {
        if (!Array.isArray(value.statuses) || !value.statuses.every(isRecord)) return null;
        statuses += value.statuses.length;
      }
    }
  }
  return { messages, statuses };
}

export function verifyWhatsAppSignature(rawBody: string | Uint8Array, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader || !appSecret) return false;
  const match = /^sha256=([a-f0-9]{64})$/i.exec(signatureHeader);
  if (!match) return false;

  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  const received = Buffer.from(match[1], "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function GET(request: Request): Promise<Response> {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!verifyToken) return new Response("Webhook is not configured", { status: 500 });

  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode !== "subscribe" || token !== verifyToken || challenge === null) {
    return new Response("Forbidden", { status: 403 });
  }
  return new Response(challenge, { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } });
}

export async function POST(request: Request): Promise<Response> {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return Response.json({ error: "Webhook is not configured" }, { status: 500 });

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_WEBHOOK_BODY_BYTES) {
    return Response.json({ error: "Payload too large" }, { status: 413 });
  }

  let rawBody: Buffer;
  try {
    if (!request.body) return Response.json({ error: "Missing request body" }, { status: 400 });
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_WEBHOOK_BODY_BYTES) {
        await reader.cancel();
        return Response.json({ error: "Payload too large" }, { status: 413 });
      }
      chunks.push(value);
    }
    rawBody = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), totalBytes);
  } catch {
    return Response.json({ error: "Unable to read request body" }, { status: 400 });
  }

  if (!verifyWhatsAppSignature(rawBody, request.headers.get("x-hub-signature-256"), appSecret)) {
    return Response.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(rawBody));
  } catch {
    return Response.json({ error: "Malformed JSON payload" }, { status: 400 });
  }

  const summary = summarizeWebhookEvent(payload);
  if (!summary) return Response.json({ error: "Malformed WhatsApp webhook payload" }, { status: 400 });

  // Deliberately acknowledge and classify only. No customer content is logged,
  // persisted, sent, or used to trigger order changes or other side effects.
  return Response.json({ status: "accepted", ...summary });
}
