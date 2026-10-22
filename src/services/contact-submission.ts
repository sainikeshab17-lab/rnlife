import "server-only";
import { z } from "zod";
import { SUPPORT_EMAIL } from "@/lib/support-contact";

const submissionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("contact"),
    name: z.string().trim().min(1).max(100),
    email: z.string().trim().email().max(254),
    subject: z.string().trim().max(120).optional().default(""),
    message: z.string().trim().min(1).max(5000),
    website: z.string().max(200).optional().default(""),
  }).strict(),
  z.object({
    type: z.literal("drop_notes"),
    email: z.string().trim().email().max(254),
    website: z.string().max(200).optional().default(""),
  }).strict(),
]);

export type ContactSubmission = z.infer<typeof submissionSchema>;
type ContactEmailSubmission =
  | Omit<Extract<ContactSubmission, { type: "contact" }>, "website">
  | Omit<Extract<ContactSubmission, { type: "drop_notes" }>, "website">;

export class ContactEmailConfigurationError extends Error {
  constructor() {
    super("Contact email delivery is not configured.");
    this.name = "ContactEmailConfigurationError";
  }
}

export class ContactEmailProviderError extends Error {
  constructor() {
    super("The email provider did not accept the message.");
    this.name = "ContactEmailProviderError";
  }
}

type EmailOptions = {
  apiKey?: string;
  from?: string;
  fetcher?: typeof fetch;
  now?: () => Date;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] ?? character);
}

function cleanSubject(value: string): string {
  return value.replace(/[\r\n\u0000-\u001f\u007f]+/g, " ").trim();
}

export async function sendContactSubmissionEmail(
  submission: ContactEmailSubmission,
  options: EmailOptions = {}
): Promise<{ messageId: string | null }> {
  const apiKey = options.apiKey ?? process.env.RESEND_API_KEY;
  const from = options.from ?? process.env.EMAIL_FROM;
  if (!apiKey || !from?.trim()) throw new ContactEmailConfigurationError();

  const submittedAt = (options.now ?? (() => new Date()))().toISOString();
  const isContact = submission.type === "contact";
  const subject = isContact
    ? `Contact form: ${cleanSubject(submission.subject || "New message")}`
    : "Drop Notes signup request";
  const text = isContact
    ? `Name: ${submission.name}\nEmail: ${submission.email}\nSubject: ${submission.subject || "(not provided)"}\nSubmitted: ${submittedAt}\n\n${submission.message}`
    : `Email: ${submission.email}\nSubmitted: ${submittedAt}\n\nThis visitor asked to receive RIGHTNOWLIFE drop updates.`;
  const html = isContact
    ? `<h2>New RIGHTNOWLIFE contact message</h2><p><strong>Name:</strong> ${escapeHtml(submission.name)}</p><p><strong>Email:</strong> ${escapeHtml(submission.email)}</p><p><strong>Subject:</strong> ${escapeHtml(submission.subject || "(not provided)")}</p><p><strong>Submitted:</strong> ${escapeHtml(submittedAt)}</p><hr/><p>${escapeHtml(submission.message).replace(/\n/g, "<br/>")}</p>`
    : `<h2>RIGHTNOWLIFE Drop Notes request</h2><p><strong>Email:</strong> ${escapeHtml(submission.email)}</p><p><strong>Submitted:</strong> ${escapeHtml(submittedAt)}</p><p>This visitor asked to receive RIGHTNOWLIFE drop updates.</p>`;

  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [SUPPORT_EMAIL],
        ...(isContact ? { reply_to: submission.email } : {}),
        subject: cleanSubject(subject),
        text,
        html,
        tags: [{ name: "source", value: isContact ? "contact_form" : "drop_notes" }],
      }),
    });
  } catch {
    console.error("[Contact] Email provider request failed before acceptance.");
    throw new ContactEmailProviderError();
  }

  if (!response.ok) {
    console.error("[Contact] Email provider rejected a submission.", { status: response.status });
    throw new ContactEmailProviderError();
  }

  let messageId: string | null = null;
  try {
    const data = await response.json() as { id?: unknown };
    if (typeof data.id === "string") messageId = data.id;
  } catch {
    // Resend acceptance is the response status; the provider ID is optional.
  }
  return { messageId };
}

type HandlerOptions = {
  send?: (submission: ContactEmailSubmission) => Promise<unknown>;
  allowRequest?: (key: string, now: number) => boolean;
  now?: () => number;
};

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 5;
const submissionsByAddress = new Map<string, { since: number; count: number }>();

function allowAddress(address: string, now: number): boolean {
  if (submissionsByAddress.size >= 10_000) {
    for (const [key, bucket] of submissionsByAddress) {
      if (now - bucket.since >= RATE_WINDOW_MS) submissionsByAddress.delete(key);
    }
    if (submissionsByAddress.size >= 10_000 && !submissionsByAddress.has(address)) return false;
  }
  const bucket = submissionsByAddress.get(address);
  if (!bucket || now - bucket.since >= RATE_WINDOW_MS) {
    submissionsByAddress.set(address, { since: now, count: 1 });
    return true;
  }
  if (bucket.count >= RATE_LIMIT) return false;
  bucket.count += 1;
  return true;
}

function getClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const value = forwarded || realIp || "unknown";
  return value.slice(0, 100);
}

function json(body: Record<string, unknown>, status: number, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

export function createContactSubmissionHandler(options: HandlerOptions = {}) {
  return async function POST(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Enter your details and try again." }, 400);
    }

    const parsed = submissionSchema.safeParse(body);
    if (!parsed.success) return json({ error: "Check the form fields and try again." }, 400);
    if (parsed.data.website) return json({ error: "This submission could not be processed." }, 400);

    const now = (options.now ?? Date.now)();
    const key = getClientKey(request);
    if (!(options.allowRequest ?? allowAddress)(key, now)) {
      return json({ error: "Too many submissions. Please try again in a few minutes." }, 429, { "retry-after": "600" });
    }

    const { website: _website, ...submission } = parsed.data;
    try {
      await (options.send ?? sendContactSubmissionEmail)(submission);
      return json({ success: true, status: "accepted" }, 200);
    } catch (error) {
      if (error instanceof ContactEmailConfigurationError) {
        return json({ error: `Contact email is temporarily unavailable. Please email ${SUPPORT_EMAIL} directly.` }, 503);
      }
      return json({ error: `We couldn't send your message right now. Please try again or email ${SUPPORT_EMAIL} directly.` }, 502);
    }
  };
}
