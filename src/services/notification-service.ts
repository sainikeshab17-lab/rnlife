import { getDb, DbNotificationJob, OrderWithDetails, type DbConnection } from "@/lib/db";
import { randomUUID } from "crypto";

const RESEND_RETRY_WINDOW_MS = 23 * 60 * 60 * 1000;

export function isProviderRetryWindowExpired(firstAttemptAt: string | null, now = Date.now()): boolean {
  return Boolean(firstAttemptAt && now - Date.parse(firstAttemptAt) >= RESEND_RETRY_WINDOW_MS);
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function safeTrackingHref(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? escapeHtml(url.href) : null;
  } catch {
    return null;
  }
}

export interface EmailSendResult {
  sent: boolean;
  alreadySent?: boolean;
  provider: "smtp" | "resend" | "none";
  messageId?: string;
  error?: string;
}

export interface ProcessNotificationOptions {
  manualRetry?: boolean;
  db?: DbConnection;
  apiKey?: string;
  from?: string;
  fetcher?: typeof fetch;
  now?: () => Date;
}

/**
 * Enqueue a transactional email notification job to the persistent notification_jobs table.
 * If credentials exist, attempts immediate dispatch; otherwise marks as 'skipped' with reason.
 */
export async function queueNotificationJob(params: {
  orderId?: string | null;
  recipientEmail: string;
  recipientName?: string | null;
  eventType: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string | null;
  idempotencyKey?: string | null;
}): Promise<DbNotificationJob> {
  const db = getDb();
  const id = `notif_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const idempotencyKey = params.idempotencyKey || id;
  const now = new Date().toISOString();

  await db.prepare(`
    INSERT INTO notification_jobs (
      id, order_id, recipient_email, recipient_name, event_type,
      subject, body_text, body_html, status, attempts, max_attempts,
      last_error, idempotency_key, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, 3, NULL, ?, ?, ?)
    ON CONFLICT (idempotency_key) DO NOTHING
  `).run(
    id,
    params.orderId || null,
    params.recipientEmail,
    params.recipientName || null,
    params.eventType,
    params.subject,
    params.bodyText || null,
    params.bodyHtml,
    idempotencyKey,
    now,
    now
  );

  // Attempt dispatch immediately
  const job = await db.prepare("SELECT * FROM notification_jobs WHERE idempotency_key = ?")
    .get<DbNotificationJob>(idempotencyKey);
  if (!job) throw new Error("Notification job could not be retrieved after enqueue.");
  await processNotificationJob(job.id);

  return (await db.prepare("SELECT * FROM notification_jobs WHERE id = ?")
    .get<DbNotificationJob>(job.id)) ?? job;
}

/**
 * Process a queued notification job by ID
 */
export async function processNotificationJob(
  jobId: string,
  options: ProcessNotificationOptions = {}
): Promise<EmailSendResult> {
  const db = options.db ?? getDb();
  let job = await db.prepare("SELECT * FROM notification_jobs WHERE id = ?")
    .get<DbNotificationJob>(jobId);

  if (!job) {
    return { sent: false, provider: "none", error: "Notification job not found." };
  }
  const currentTime = (options.now ?? (() => new Date()))();
  const now = currentTime.toISOString();

  if (job.status === "sent") {
    return { sent: true, alreadySent: true, provider: "resend", messageId: job.provider_message_id ?? undefined };
  }

  // created_at is present in the original schema and immutable, so it can
  // conservatively bound the provider idempotency window without a migration.
  const firstProviderAttempt = job.created_at;
  if (job.attempts > 0 && isProviderRetryWindowExpired(firstProviderAttempt)) {
    if (job.status === "sending" && currentTime.getTime() - Date.parse(job.updated_at) < 5 * 60 * 1000) {
      return { sent: false, provider: "resend", error: "Notification is processing; reconcile its provider outcome before retrying." };
    }
    const message = "Provider outcome is unknown and the provider idempotency window has expired; reconcile in Resend before retrying.";
    const transition = await db.prepare(`
      UPDATE notification_jobs SET status = 'unknown', last_error = ?, updated_at = ?
      WHERE id = ? AND status = ? AND created_at = ?
    `).run(message, now, jobId, job.status, job.created_at);
    if (transition.rowCount !== 1) {
      return { sent: false, provider: "none", error: "Notification state changed during retry-window reconciliation; refresh the job." };
    }
    return { sent: false, provider: "none", error: message };
  }

  const resendApiKey = options.apiKey ?? process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    // Graceful unconfigured fallback
    await db.prepare(`
      UPDATE notification_jobs
      SET status = 'skipped',
          last_error = 'No supported email provider configured (RESEND_API_KEY missing).',
          updated_at = ?
      WHERE id = ? AND status IN ('pending', 'failed', 'skipped')
    `).run(now, jobId);

    console.info(`[Notification] Job ${jobId} skipped: provider is unconfigured.`);
    return { sent: false, provider: "none", error: "Email provider unconfigured." };
  }

  if (options.manualRetry && job.status === "failed" && job.attempts >= job.max_attempts) {
    await db.prepare(`
      UPDATE notification_jobs SET status = 'pending', max_attempts = max_attempts + 3, updated_at = ?
      WHERE id = ? AND status = 'failed' AND attempts >= max_attempts
    `).run(now, jobId);
    job = await db.prepare("SELECT * FROM notification_jobs WHERE id = ?")
      .get<DbNotificationJob>(jobId);
    if (!job) return { sent: false, provider: "none", error: "Notification job not found." };
  }

  // Claim once across concurrent requests. Reclaim stale sends only while the
  // Resend idempotency key is still within its documented retention window.
  const claimed = await db.prepare(`
    UPDATE notification_jobs
    SET status = 'sending', provider = 'resend', attempts = attempts + 1,
        last_error = NULL, updated_at = ?
    WHERE id = ? AND attempts < max_attempts
      AND (attempts = 0 OR created_at > NOW() - INTERVAL '23 hours') AND (
      status IN ('pending', 'failed', 'skipped') OR
      (status = 'sending' AND updated_at < NOW() - INTERVAL '5 minutes'
        AND updated_at > NOW() - INTERVAL '23 hours')
    )
    RETURNING *
  `).get<DbNotificationJob>(now, jobId);

  if (!claimed) {
    job = await db.prepare("SELECT * FROM notification_jobs WHERE id = ?")
      .get<DbNotificationJob>(jobId);
    return {
      sent: job?.status === "sent",
      alreadySent: job?.status === "sent",
      provider: job?.provider === "resend" ? "resend" : "none",
      messageId: job?.provider_message_id ?? undefined,
      error: job?.status === "sending" ? "Notification is processing or requires reconciliation." :
        job?.status === "unknown" ? job.last_error ?? "Provider outcome requires reconciliation." :
        job?.status === "failed" ? job.last_error ?? "Notification retry limit reached." : undefined,
    };
  }

  try {
    const response = await (options.fetcher ?? fetch)("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": claimed.idempotency_key,
      },
      body: JSON.stringify({
        from: options.from ?? (process.env.EMAIL_FROM || "RightNowLife Orders <orders@rightnowlife.in>"),
        to: [claimed.recipient_email],
        subject: claimed.subject,
        html: claimed.body_html,
        ...(claimed.body_text ? { text: claimed.body_text } : {}),
      }),
    });

    if (response.ok) {
      const data = await response.json() as { id?: string };
      await db.prepare(`
        UPDATE notification_jobs
        SET status = 'sent', provider = 'resend', provider_message_id = ?,
            last_error = NULL, updated_at = ?
        WHERE id = ? AND status = 'sending'
      `).run(data.id ?? null, new Date().toISOString(), jobId);
      return { sent: true, provider: "resend", messageId: data.id };
    }

    // Provider bodies can echo submitted addresses or payload details; retain
    // only the status code in the job record and the admin response.
    const providerError = `Resend rejected request (HTTP ${response.status}).`;
    const status = claimed.attempts >= claimed.max_attempts ? "failed" : "pending";
    await db.prepare(`UPDATE notification_jobs SET status = ?, last_error = ?, updated_at = ? WHERE id = ? AND status = 'sending'`)
      .run(status, providerError, currentTime.toISOString(), jobId);
    return { sent: false, provider: "resend", error: providerError };
  } catch {
    const message = "Email provider request failed or timed out; retry or reconcile the outcome.";
    const status = currentTime.getTime() - Date.parse(claimed.created_at) > 23 * 60 * 60 * 1000
      ? "unknown"
      : claimed.attempts >= claimed.max_attempts ? "failed" : "pending";
    await db.prepare(`UPDATE notification_jobs SET status = ?, last_error = ?, updated_at = ? WHERE id = ? AND status = 'sending'`)
      .run(status, `Provider outcome uncertain: ${message}`, currentTime.toISOString(), jobId);
    return { sent: false, provider: "resend", error: message };
  }
}

/**
 * Trigger order confirmation notification to customer
 */
export async function sendOrderConfirmationEmail(order: OrderWithDetails): Promise<DbNotificationJob> {
  const html = generateOrderEmailHtml(order);
  const confirmationLabel = order.payment_method === "COD Advance"
    ? "COD Advance verified — order confirmed"
    : order.payment_method === "Cash on Delivery" && order.payment_status !== "paid"
      ? "Order placed — Cash on Delivery" : "Order Confirmed";
  const advance = getVerifiedCodAdvance(order);
  const paymentLine = order.payment_method === "COD Advance"
    ? `Advance verified: ₹${advance} | Balance due on delivery: ₹${Math.max(0, order.total - advance)}` : "";
  const plainText = `${confirmationLabel}: #${order.order_number}\nTotal: ₹${order.total}\n${paymentLine}\nItems: ${order.items.map(i => `${i.product_name} (${i.size}) x${i.quantity}${i.customization ? ` — “${i.customization.quote}”` : ""}`).join(", ")}`;
  return queueNotificationJob({
    orderId: order.id,
    recipientEmail: order.customer_email,
    recipientName: order.customer_name,
    eventType: "order_confirmation",
    subject: `${confirmationLabel}: #${order.order_number} — RightNowLife`,
    bodyHtml: html,
    bodyText: plainText,
    idempotencyKey: `notif_conf_${order.id}`,
  });
}

/**
 * Trigger new order notification to admin / store owner
 */
export async function sendAdminNewOrderNotification(order: OrderWithDetails): Promise<DbNotificationJob> {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.INITIAL_ADMIN_EMAIL || "admin@rightnowlife.in";
  const itemsText = order.items.map(i => `${i.product_name} (${i.size}) x${i.quantity} = ₹${i.price * i.quantity}${i.customization ? ` — “${i.customization.quote}” (${i.customization.font}/${i.customization.printColor}/${i.customization.placement})` : ""}`).join(", ");
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #111111;">
      <h1 style="text-transform: uppercase; letter-spacing: -0.02em;">RIGHTNOWLIFE</h1>
      <p style="font-size: 14px; color: #0876A8; font-weight: bold;">NEW ORDER RECEIVED — ACTION REQUIRED</p>
      <p>A new order has been placed on RightNowLife.</p>
      <div style="background: #f7f7f7; padding: 16px; border-radius: 6px; margin: 16px 0;">
        <p style="margin: 0 0 6px 0;"><strong>Order Number:</strong> #${escapeHtml(order.order_number)}</p>
        <p style="margin: 0 0 6px 0;"><strong>Customer:</strong> ${escapeHtml(order.customer_name)} (${escapeHtml(order.customer_email)}, ${escapeHtml(order.customer_phone)})</p>
        <p style="margin: 0 0 6px 0;"><strong>Payment Method:</strong> ${escapeHtml(order.payment_method)} (${escapeHtml(order.payment_status)})</p>
        <p style="margin: 0 0 6px 0;"><strong>Total Value:</strong> ₹${order.total.toLocaleString("en-IN")}</p>
        ${order.payment_method === "COD Advance" ? `<p style="margin: 0 0 6px 0;"><strong>Verified COD Advance:</strong> ₹${getVerifiedCodAdvance(order).toLocaleString("en-IN")}</p><p style="margin: 0 0 6px 0;"><strong>Balance due on delivery:</strong> ₹${Math.max(0, order.total - getVerifiedCodAdvance(order)).toLocaleString("en-IN")}</p>` : ""}
        <p style="margin: 0;"><strong>Delivery:</strong> ${escapeHtml(order.address?.address_line1)}, ${escapeHtml(order.address?.city)}, ${escapeHtml(order.address?.state)} - ${escapeHtml(order.address?.pin_code)}</p>
      </div>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
        <thead>
          <tr style="text-align: left; border-bottom: 2px solid #111111;">
            <th style="padding-bottom: 8px;">GARMENT</th>
            <th style="padding-bottom: 8px; text-align: right;">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${order.items.map(item => `
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5;">
                <strong>${escapeHtml(item.product_name)}</strong><br/>
                <small>Size: ${escapeHtml(item.size)} | Color: ${escapeHtml(item.color)} | Qty: ${item.quantity}</small>
                ${item.customization ? `<br/><small>Custom quote: “${escapeHtml(item.customization.quote)}” | Font: ${escapeHtml(item.customization.font)} | Print: ${escapeHtml(item.customization.printColor)} | Placement: ${escapeHtml(item.customization.placement)} | Mood: ${escapeHtml(item.customization.mood)}</small>` : ""}
              </td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5; text-align: right;">
                ₹${(item.price * item.quantity).toLocaleString("en-IN")}
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  return queueNotificationJob({
    orderId: order.id,
    recipientEmail: adminEmail,
    recipientName: "RightNowLife Operations",
    eventType: "admin_order_notification",
    subject: `[New Order] #${order.order_number} - ₹${order.total.toLocaleString("en-IN")}`,
    bodyHtml: html,
    bodyText: `New Order #${order.order_number}\nCustomer: ${order.customer_name} (${order.customer_email})\nTotal: ₹${order.total}\nItems: ${itemsText}`,
    idempotencyKey: `notif_admin_${order.id}`,
  });
}

/**
 * Trigger new order notification to seller(s)
 */
export async function sendSellerNewOrderNotification(order: OrderWithDetails): Promise<DbNotificationJob> {
  const sellerEmail = process.env.SELLER_NOTIFICATION_EMAIL || process.env.ADMIN_NOTIFICATION_EMAIL || process.env.INITIAL_ADMIN_EMAIL || "seller@rightnowlife.in";
  const itemsText = order.items.map(i => `${i.product_name} (${i.size}) x${i.quantity}`).join(", ");
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #111111;">
      <h1 style="text-transform: uppercase; letter-spacing: -0.02em;">RIGHTNOWLIFE SELLER PORTAL</h1>
      <p style="font-size: 14px; color: #079447; font-weight: bold;">NEW ORDER TO FULFILL</p>
      <p>You have new item(s) to prepare for shipment for Order <strong>#${escapeHtml(order.order_number)}</strong>.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
        <thead>
          <tr style="text-align: left; border-bottom: 2px solid #111111;">
            <th style="padding-bottom: 8px;">GARMENT</th>
            <th style="padding-bottom: 8px; text-align: right;">QTY</th>
          </tr>
        </thead>
        <tbody>
          ${order.items.map(item => `
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5;">
                <strong>${escapeHtml(item.product_name)}</strong><br/>
                <small>Size: ${escapeHtml(item.size)} | Color: ${escapeHtml(item.color)}</small>
              </td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5; text-align: right; font-weight: bold;">
                ${item.quantity}
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <div style="background: #f7f7f7; padding: 12px; border-radius: 6px;">
        <p style="margin: 0; font-size: 13px;"><strong>Ship To:</strong> ${escapeHtml(order.address?.city)}, ${escapeHtml(order.address?.state)} - ${escapeHtml(order.address?.pin_code)}</p>
      </div>
    </div>
  `;

  return queueNotificationJob({
    orderId: order.id,
    recipientEmail: sellerEmail,
    recipientName: "RightNowLife Merchant",
    eventType: "seller_order_notification",
    subject: `[Action Required] New Order to Fulfill: #${order.order_number} — RightNowLife`,
    bodyHtml: html,
    bodyText: `New Order to Fulfill #${order.order_number}\nItems: ${itemsText}\nShip To: ${order.address?.city}, ${order.address?.state} - ${order.address?.pin_code}`,
    idempotencyKey: `notif_seller_${order.id}`,
  });
}

/**
 * Dispatch all order notifications (Customer, Admin, Seller)
 */
export async function dispatchAllOrderNotifications(order: OrderWithDetails): Promise<{ persisted: number; failed: number }> {
  const results = await Promise.allSettled([
    sendOrderConfirmationEmail(order),
    sendAdminNewOrderNotification(order),
    sendSellerNewOrderNotification(order),
  ]);

  let persisted = 0;
  let failed = 0;
  results.forEach((result, idx) => {
    if (result.status === "rejected") {
      failed += 1;
      const target = idx === 0 ? "Customer" : idx === 1 ? "Admin" : "Seller";
      console.error(`[Notification] Failed to queue ${target} notification for order ${order.id}:`, result.reason);
    } else {
      persisted += 1;
    }
  });
  return { persisted, failed };
}

export async function persistPaymentNotificationJobs(
  orderId: string,
  persist: () => Promise<{ persisted: number; failed: number }>
): Promise<boolean> {
  try {
    const result = await persist();
    if (result.failed > 0) {
      console.error(`[Notification] ${result.failed} payment notification job(s) require recovery for order ${orderId}.`);
      return false;
    }
    return true;
  } catch (error: unknown) {
    console.error(`[Notification] Failed to persist payment notification jobs for order ${orderId}:`, error);
    return false;
  }
}

/**
 * Trigger shipping notification
 */
export async function sendShippingUpdateEmail(
  order: OrderWithDetails,
  courierName: string,
  trackingNumber: string,
  trackingUrl?: string | null
): Promise<DbNotificationJob> {
  const trackingHref = trackingUrl ? safeTrackingHref(trackingUrl) : null;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #111111;">
      <h1 style="text-transform: uppercase; letter-spacing: -0.02em;">RIGHTNOWLIFE</h1>
      <p style="font-size: 14px; color: #0876A8; font-weight: bold;">YOUR ORDER IS ON THE WAY</p>
      <p>Hey ${escapeHtml(order.customer_name)},</p>
      <p>Great news! Your Order <strong>#${escapeHtml(order.order_number)}</strong> has been handed over to <strong>${escapeHtml(courierName)}</strong>.</p>
      <div style="background: #f7f7f7; padding: 16px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 0 0 8px 0; font-size: 13px;"><strong>Courier Partner:</strong> ${escapeHtml(courierName)}</p>
        <p style="margin: 0 0 8px 0; font-size: 13px;"><strong>Tracking Number (AWB):</strong> ${escapeHtml(trackingNumber)}</p>
        ${
          trackingHref
            ? `<p style="margin: 0; font-size: 13px;"><a href="${trackingHref}" style="display: inline-block; background: #111111; color: #ffffff; text-decoration: none; padding: 8px 16px; font-weight: bold; border-radius: 4px;" target="_blank" rel="noopener noreferrer">Track Consignment &rarr;</a></p>`
            : ""
        }
      </div>
      <p style="font-size: 12px; color: #858585;">Estimated delivery within 2–4 business days across metro locations.</p>
    </div>
  `;

  return queueNotificationJob({
    orderId: order.id,
    recipientEmail: order.customer_email,
    recipientName: order.customer_name,
    eventType: "shipping_update",
    subject: `Dispatched: Order #${order.order_number} is on the way — RightNowLife`,
    bodyHtml: html,
    idempotencyKey: `notif_ship_${order.id}_${trackingNumber}`,
  });
}

/**
 * Trigger return status notification
 */
export async function sendReturnStatusEmail(
  order: OrderWithDetails,
  returnType: "return" | "exchange",
  status: string,
  adminNote?: string | null
): Promise<DbNotificationJob> {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #111111;">
      <h1 style="text-transform: uppercase; letter-spacing: -0.02em;">RIGHTNOWLIFE</h1>
      <p style="font-size: 14px; color: #111111; font-weight: bold;">${returnType.toUpperCase()} STATUS UPDATE</p>
      <p>Hey ${escapeHtml(order.customer_name)},</p>
      <p>Your request for a ${escapeHtml(returnType)} on Order <strong>#${escapeHtml(order.order_number)}</strong> has been updated to: <strong>${escapeHtml(status.toUpperCase())}</strong>.</p>
      ${adminNote ? `<p style="background: #f7f7f7; padding: 12px; border-left: 3px solid #111111; font-size: 13px;">${escapeHtml(adminNote)}</p>` : ""}
      <p style="font-size: 12px; color: #858585;">You can view the full progress in your customer order dashboard.</p>
    </div>
  `;

  return queueNotificationJob({
    orderId: order.id,
    recipientEmail: order.customer_email,
    recipientName: order.customer_name,
    eventType: "return_status_update",
    subject: `${returnType === "exchange" ? "Exchange" : "Return"} Status: #${order.order_number} (${status}) — RightNowLife`,
    bodyHtml: html,
    idempotencyKey: `notif_ret_${order.id}_${status}_${Date.now()}`,
  });
}

/**
 * Trigger refund notification
 */
export async function sendRefundConfirmationEmail(
  order: OrderWithDetails,
  amount: number,
  refundId: string
): Promise<DbNotificationJob> {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #111111;">
      <h1 style="text-transform: uppercase; letter-spacing: -0.02em;">RIGHTNOWLIFE</h1>
      <p style="font-size: 14px; color: #079447; font-weight: bold;">REFUND PROCESSED SUCCESSFULLY</p>
      <p>Hey ${escapeHtml(order.customer_name)},</p>
      <p>A refund of <strong>₹${amount.toLocaleString("en-IN")}</strong> for Order <strong>#${escapeHtml(order.order_number)}</strong> has been processed to your original payment method. Your bank or UPI provider may take 3–7 business days to reflect it.</p>
      <div style="background: #f7f7f7; padding: 16px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 0 0 8px 0; font-size: 13px;"><strong>Refund Reference ID:</strong> ${escapeHtml(refundId)}</p>
        <p style="margin: 0; font-size: 13px;"><strong>Amount:</strong> ₹${amount.toLocaleString("en-IN")}</p>
      </div>
      <p style="font-size: 12px; color: #858585;">Bank / UPI processing times typically take 3–7 business days to reflect on your statement.</p>
    </div>
  `;

  return queueNotificationJob({
    orderId: order.id,
    recipientEmail: order.customer_email,
    recipientName: order.customer_name,
    eventType: "refund_processed",
    subject: `Refund Processed: ₹${amount} for #${order.order_number} — RightNowLife`,
    bodyHtml: html,
    idempotencyKey: `notif_rfnd_${refundId}`,
  });
}

function generateOrderEmailHtml(order: OrderWithDetails): string {
  const itemsHtml = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e5;">
          <strong>${escapeHtml(item.product_name)}</strong><br/>
          <small>Size: ${escapeHtml(item.size)} | Color: ${escapeHtml(item.color)} | Qty: ${item.quantity}</small>
          ${item.customization ? `<br/><small>Custom quote: “${escapeHtml(item.customization.quote)}” | Mood: ${escapeHtml(item.customization.mood)} | Style: ${escapeHtml(item.customization.quoteStyle)} | Font: ${escapeHtml(item.customization.font)} | Print: ${escapeHtml(item.customization.printColor)} | Placement: ${escapeHtml(item.customization.placement)}</small>` : ""}
        </td>
        <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e5; text-align: right;">
          ₹${(item.price * item.quantity).toLocaleString("en-IN")}
        </td>
      </tr>
    `
    )
    .join("");

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #111111;">
      <h1 style="text-transform: uppercase; letter-spacing: -0.02em;">RIGHTNOWLIFE</h1>
      <p style="font-size: 14px; color: #079447; font-weight: bold;">${order.payment_method === "COD Advance" ? "₹200 COD ADVANCE VERIFIED — ORDER CONFIRMED" : order.payment_method === "Cash on Delivery" && order.payment_status !== "paid" ? "ORDER PLACED — CASH ON DELIVERY" : "PAYMENT VERIFIED & ORDER CONFIRMED"}</p>
      <p>Hey ${escapeHtml(order.customer_name)},</p>
      <p>${order.payment_method === "COD Advance"
        ? `Your ₹200 COD Advance for Order <strong>#${escapeHtml(order.order_number)}</strong> was verified. The remaining ₹${Math.max(0, order.total - getVerifiedCodAdvance(order)).toLocaleString("en-IN")} is due on delivery.`
        : order.payment_method === "Cash on Delivery" && order.payment_status !== "paid"
        ? `Thank you for choosing RightNowLife. Your Cash on Delivery order <strong>#${escapeHtml(order.order_number)}</strong> has been placed and is entering preparation.`
        : `Thank you for choosing RightNowLife. Your payment for Order <strong>#${escapeHtml(order.order_number)}</strong> has been received and your garments are entering preparation.`}</p>
      
      <table style="width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 13px;">
        <thead>
          <tr style="text-align: left; border-bottom: 2px solid #111111;">
            <th style="padding-bottom: 8px;">GARMENT</th>
            <th style="padding-bottom: 8px; text-align: right;">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td style="padding-top: 12px; font-weight: bold;">Subtotal</td>
            <td style="padding-top: 12px; font-weight: bold; text-align: right;">₹${order.subtotal.toLocaleString("en-IN")}</td>
          </tr>
          <tr>
            <td style="padding-top: 6px;">Express Shipping</td>
            <td style="padding-top: 6px; text-align: right;">${order.shipping === 0 ? "FREE" : "₹" + order.shipping}</td>
          </tr>
          <tr style="font-size: 16px; font-weight: 900;">
            <td style="padding-top: 10px; border-top: 1px solid #111111;">${order.payment_method === "COD Advance" ? "Order Total" : order.payment_method === "Cash on Delivery" && order.payment_status !== "paid" ? "Total Due on Delivery" : "Total Paid"}</td>
            <td style="padding-top: 10px; border-top: 1px solid #111111; text-align: right;">₹${order.total.toLocaleString("en-IN")}</td>
          </tr>
          ${order.payment_method === "COD Advance" ? `<tr><td>Advance received</td><td style="text-align:right;">₹${getVerifiedCodAdvance(order).toLocaleString("en-IN")}</td></tr><tr><td>Balance due on delivery</td><td style="text-align:right;">₹${Math.max(0, order.total - getVerifiedCodAdvance(order)).toLocaleString("en-IN")}</td></tr>` : ""}
        </tfoot>
      </table>

      <p style="font-size: 12px; color: #858585;">
        Delivery Address: ${escapeHtml(order.address?.address_line1)}, ${escapeHtml(order.address?.city)}, ${escapeHtml(order.address?.state)} - ${escapeHtml(order.address?.pin_code)}<br/>
        Air courier tracking details will be dispatched via SMS once picked up by our logistics partner.
      </p>
    </div>
  `;
}

function getVerifiedCodAdvance(order: OrderWithDetails): number {
  const attempt = order.payment_attempts?.find((payment) => payment.purpose === "cod_advance" && payment.payment_state === "captured");
  return attempt ? attempt.amount_paisa / 100 : 0;
}
