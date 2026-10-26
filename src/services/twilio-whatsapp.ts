import "server-only";
import { randomUUID } from "crypto";
import { getDb, type DbConnection, type DbNotificationJob, type OrderWithDetails } from "@/lib/db";

export type TwilioConfig = {
  accountSid: string;
  authToken: string;
  from: string;
  contentSid: string;
  /** Maps the approved template's actual Content API keys to existing order fields. */
  contentVariables: Record<string, "id" | "order_number" | "customer_name" | "total">;
};

export type WhatsAppResult = { sent: boolean; status: "sent" | "skipped" | "failed" | "unknown"; error?: string };

export function normalizeWhatsAppPhone(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || /[A-Za-z]/.test(trimmed)) return null;
  const digits = trimmed.replace(/[^\d+]/g, "");
  const international = digits.startsWith("+") ? digits.slice(1) : digits;
  const indianMobile = international.replace(/^(?:91|0)/, "");
  if (!/^[6-9]\d{9}$/.test(indianMobile) || (digits.startsWith("+") && !international.startsWith("91"))) return null;
  return `whatsapp:+91${indianMobile}`;
}

export function getTwilioConfig(env: NodeJS.ProcessEnv = process.env): TwilioConfig | null {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM, TWILIO_CONTENT_SID, TWILIO_CONTENT_VARIABLES } = env;
  if (env.TWILIO_WHATSAPP_ENABLED !== "true" || !TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN ||
      !TWILIO_WHATSAPP_FROM || !TWILIO_CONTENT_SID || TWILIO_CONTENT_VARIABLES === undefined) return null;
  if (!/^AC[0-9a-fA-F]{32}$/.test(TWILIO_ACCOUNT_SID) || !/^HX[0-9a-fA-F]{32}$/.test(TWILIO_CONTENT_SID)) return null;
  let contentVariables: unknown;
  try { contentVariables = JSON.parse(TWILIO_CONTENT_VARIABLES); } catch { return null; }
  if (!contentVariables || typeof contentVariables !== "object" || Array.isArray(contentVariables) ||
      Object.entries(contentVariables).some(([key, field]) =>
        !/^\d+$/.test(key) || !["id", "order_number", "customer_name", "total"].includes(String(field)))) return null;
  const variableCount = Object.keys(contentVariables).length;
  const confirmedVariableFree = env.TWILIO_TEMPLATE_HAS_NO_VARIABLES === "true";
  if ((variableCount === 0) !== confirmedVariableFree) return null;
  return { accountSid: TWILIO_ACCOUNT_SID, authToken: TWILIO_AUTH_TOKEN,
    from: TWILIO_WHATSAPP_FROM, contentSid: TWILIO_CONTENT_SID,
    contentVariables: contentVariables as TwilioConfig["contentVariables"] };
}

function validSender(value: string): string | null {
  const normalized = value.startsWith("whatsapp:") ? value : `whatsapp:${value}`;
  const address = normalized.slice("whatsapp:".length);
  return /^\+[1-9]\d{7,14}$/.test(address) ? normalized : null;
}

/** Queue and send only an order whose payment is durably marked paid by a server verifier. */
export async function sendPaidOrderWhatsApp(
  order: Pick<OrderWithDetails, "id" | "order_number" | "customer_name" | "total" | "customer_phone" | "payment_status" | "razorpay_payment_id">,
  options: { db?: DbConnection; config?: TwilioConfig | null; fetcher?: typeof fetch; production?: boolean } = {}
): Promise<WhatsAppResult> {
  if (order.payment_status !== "paid" || !order.razorpay_payment_id) return { sent: false, status: "skipped" };

  // Development and test environments never make outbound WhatsApp requests.
  if (options.production === false || (!options.production && process.env.NODE_ENV !== "production")) {
    return { sent: false, status: "skipped" };
  }

  const config = options.config === undefined ? getTwilioConfig() : options.config;
  if (!config) return { sent: false, status: "skipped", error: "Twilio WhatsApp configuration is incomplete." };
  const to = normalizeWhatsAppPhone(order.customer_phone);
  const from = validSender(config.from);
  if (!to || !from) return { sent: false, status: "failed", error: "Customer phone or configured WhatsApp sender is invalid." };

  const db = options.db ?? getDb();
  const jobId = `notif_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const now = new Date().toISOString();
  const contentVariables = Object.fromEntries(Object.entries(config.contentVariables).map(([key, field]) => [
    key, field === "total" ? String(order.total) : String(order[field]),
  ]));
  const inserted = await db.prepare(`
    INSERT INTO notification_jobs (
      id, order_id, channel, recipient_phone, event_type, recipient_email, recipient_name,
      subject, body_text, body_html, content_sid, content_variables, status, provider,
      attempts, max_attempts, idempotency_key, created_at, updated_at
    ) VALUES (?, ?, 'whatsapp', ?, 'order_confirmation', '', ?, 'Order confirmation', '', '', ?, ?::jsonb,
      'pending', 'twilio', 0, 3, ?, ?, ?)
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING *
  `).get<DbNotificationJob>(jobId, order.id, to, order.customer_name,
    config.contentSid, JSON.stringify(contentVariables), `notif_whatsapp_conf_${order.id}`, now, now);

  // A prior invocation owns the unique job. Never repeat a send on a payment retry/webhook replay.
  if (!inserted) return { sent: false, status: "skipped" };
  return processTwilioWhatsAppJob(jobId, { db, config, fetcher: options.fetcher });
}

export async function processTwilioWhatsAppJob(
  jobId: string,
  options: { db?: DbConnection; config?: TwilioConfig | null; fetcher?: typeof fetch; manualRetry?: boolean } = {}
): Promise<WhatsAppResult> {
  const db = options.db ?? getDb();
  const job = await db.prepare("SELECT * FROM notification_jobs WHERE id = ? AND channel = 'whatsapp'")
    .get<DbNotificationJob>(jobId);
  if (!job) return { sent: false, status: "failed", error: "WhatsApp notification job not found." };
  if (job.status === "sent") return { sent: true, status: "sent" };
  if (job.status === "unknown") return { sent: false, status: "unknown", error: "Twilio request outcome is unknown; reconcile before retrying." };
  const config = options.config === undefined ? getTwilioConfig() : options.config;
  if (!config) return { sent: false, status: "skipped", error: "Twilio WhatsApp configuration is incomplete." };
  const from = validSender(config.from);
  if (!from || !job.recipient_phone || !job.content_sid) {
    return { sent: false, status: "failed", error: "WhatsApp job is missing a valid sender, recipient, or approved template." };
  }
  if (job.content_sid !== config.contentSid) {
    return { sent: false, status: "failed", error: "Configured Content SID differs from the queued template." };
  }

  if (options.manualRetry && job.status === "failed" && job.attempts >= job.max_attempts) {
    await db.prepare("UPDATE notification_jobs SET max_attempts = max_attempts + 3, updated_at = ? WHERE id = ? AND status = 'failed'")
      .run(new Date().toISOString(), jobId);
  }
  const claimed = await db.prepare(`
    UPDATE notification_jobs SET status = 'sending', provider = 'twilio', attempts = attempts + 1,
      last_error = NULL, updated_at = ?
    WHERE id = ? AND channel = 'whatsapp' AND attempts < max_attempts
      AND (status = 'pending' OR (status = 'failed' AND ? = TRUE))
    RETURNING *
  `).get<DbNotificationJob>(new Date().toISOString(), jobId, Boolean(options.manualRetry));
  if (!claimed) return { sent: false, status: job.status === "failed" ? "failed" : "skipped", error: job.last_error ?? undefined };

  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.accountSid)}/Messages.json`;
  const form = new URLSearchParams({ To: job.recipient_phone, From: from, ContentSid: job.content_sid });
  if (job.content_variables && Object.keys(job.content_variables).length) {
    form.set("ContentVariables", JSON.stringify(job.content_variables));
  }
  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)(url, {
      method: "POST", signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      }, body: form,
    });
  } catch {
    // Twilio may have accepted a request before a network timeout; never auto-retry an uncertain send.
    await db.prepare(`UPDATE notification_jobs SET status = 'unknown', last_error = ?, updated_at = ? WHERE id = ? AND status = 'sending'`)
      .run("Twilio request outcome is unknown; reconcile in Twilio before retrying.", new Date().toISOString(), jobId);
    return { sent: false, status: "unknown", error: "Twilio request outcome is unknown." };
  }

  if (!response.ok) {
    const message = `Twilio rejected the WhatsApp request (HTTP ${response.status}).`;
    await db.prepare(`UPDATE notification_jobs SET status = 'failed', last_error = ?, updated_at = ? WHERE id = ? AND status = 'sending'`)
      .run(message, new Date().toISOString(), jobId);
    return { sent: false, status: "failed", error: message };
  }

  let messageSid: string | null = null;
  try {
    const data = await response.json() as { sid?: unknown };
    if (typeof data.sid === "string") messageSid = data.sid;
  } catch { /* Twilio accepted; a missing SID does not change payment or resend the message. */ }
  await db.prepare(`UPDATE notification_jobs SET status = 'sent', provider = 'twilio', provider_message_id = ?, last_error = NULL, updated_at = ? WHERE id = ? AND status = 'sending'`)
    .run(messageSid, new Date().toISOString(), jobId);
  return { sent: true, status: "sent" };
}
