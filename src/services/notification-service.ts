import { getDb, DbNotificationJob, OrderWithDetails } from "@/lib/db";
import { randomUUID } from "crypto";

export interface EmailSendResult {
  sent: boolean;
  provider: "smtp" | "resend" | "none";
  messageId?: string;
  error?: string;
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
  if (job.id === id) await processNotificationJob(job.id);

  return (await db.prepare("SELECT * FROM notification_jobs WHERE id = ?")
    .get<DbNotificationJob>(job.id)) ?? job;
}

/**
 * Process a queued notification job by ID
 */
export async function processNotificationJob(jobId: string): Promise<EmailSendResult> {
  const db = getDb();
  const job = await db.prepare("SELECT * FROM notification_jobs WHERE id = ?")
    .get<DbNotificationJob>(jobId);

  if (!job) {
    return { sent: false, provider: "none", error: "Notification job not found." };
  }

  if (job.status === "sent") {
    return { sent: true, provider: "none" };
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const smtpHost = process.env.SMTP_HOST;
  const now = new Date().toISOString();

  if (!resendApiKey && !smtpHost) {
    // Graceful unconfigured fallback
    await db.prepare(`
      UPDATE notification_jobs
      SET status = 'skipped',
          last_error = 'No email provider configured (RESEND_API_KEY or SMTP_HOST missing).',
          updated_at = ?
      WHERE id = ?
    `).run(now, jobId);

    console.info(`[Notification] Job ${jobId} skipped: provider is unconfigured.`);
    return { sent: false, provider: "none", error: "Email provider unconfigured." };
  }

  if (resendApiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "RightNowLife Orders <orders@rightnowlife.in>",
          to: [job.recipient_email],
          subject: job.subject,
          html: job.body_html,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        await db.prepare(`
          UPDATE notification_jobs
          SET status = 'sent',
              attempts = attempts + 1,
              last_error = NULL,
              updated_at = ?
          WHERE id = ?
        `).run(new Date().toISOString(), jobId);

        return { sent: true, provider: "resend", messageId: data.id };
      } else {
        const errData = await response.text();
        await db.prepare(`
          UPDATE notification_jobs
          SET attempts = attempts + 1,
              status = CASE WHEN attempts + 1 >= max_attempts THEN 'failed' ELSE 'pending' END,
              last_error = ?,
              updated_at = ?
          WHERE id = ?
        `).run(`Resend error: ${errData}`, new Date().toISOString(), jobId);

        return { sent: false, provider: "resend", error: errData };
      }
    } catch (err: any) {
      await db.prepare(`
        UPDATE notification_jobs
        SET attempts = attempts + 1,
            status = CASE WHEN attempts + 1 >= max_attempts THEN 'failed' ELSE 'pending' END,
            last_error = ?,
            updated_at = ?
        WHERE id = ?
      `).run(err.message, new Date().toISOString(), jobId);

      return { sent: false, provider: "resend", error: err.message };
    }
  }

  return { sent: false, provider: "none", error: "Unsupported email provider." };
}

/**
 * Trigger order confirmation notification
 */
export async function sendOrderConfirmationEmail(order: OrderWithDetails): Promise<DbNotificationJob> {
  const html = generateOrderEmailHtml(order);
  return queueNotificationJob({
    orderId: order.id,
    recipientEmail: order.customer_email,
    recipientName: order.customer_name,
    eventType: "order_confirmation",
    subject: `Order Confirmed: #${order.order_number} — RightNowLife`,
    bodyHtml: html,
    idempotencyKey: `notif_conf_${order.id}`,
  });
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
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #111111;">
      <h1 style="text-transform: uppercase; letter-spacing: -0.02em;">RIGHTNOWLIFE</h1>
      <p style="font-size: 14px; color: #0876A8; font-weight: bold;">YOUR ORDER IS ON THE WAY</p>
      <p>Hey ${order.customer_name},</p>
      <p>Great news! Your Order <strong>#${order.order_number}</strong> has been handed over to <strong>${courierName}</strong>.</p>
      <div style="background: #f7f7f7; padding: 16px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 0 0 8px 0; font-size: 13px;"><strong>Courier Partner:</strong> ${courierName}</p>
        <p style="margin: 0 0 8px 0; font-size: 13px;"><strong>Tracking Number (AWB):</strong> ${trackingNumber}</p>
        ${
          trackingUrl
            ? `<p style="margin: 0; font-size: 13px;"><a href="${trackingUrl}" style="display: inline-block; background: #111111; color: #ffffff; text-decoration: none; padding: 8px 16px; font-weight: bold; border-radius: 4px;" target="_blank" rel="noopener noreferrer">Track Consignment &rarr;</a></p>`
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
      <p>Hey ${order.customer_name},</p>
      <p>Your request for a ${returnType} on Order <strong>#${order.order_number}</strong> has been updated to: <strong>${status.toUpperCase()}</strong>.</p>
      ${adminNote ? `<p style="background: #f7f7f7; padding: 12px; border-left: 3px solid #111111; font-size: 13px;">${adminNote}</p>` : ""}
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
      <p>Hey ${order.customer_name},</p>
      <p>A refund of <strong>₹${amount.toLocaleString("en-IN")}</strong> for Order <strong>#${order.order_number}</strong> has been successfully initiated to your original payment method.</p>
      <div style="background: #f7f7f7; padding: 16px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 0 0 8px 0; font-size: 13px;"><strong>Refund Reference ID:</strong> ${refundId}</p>
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
          <strong>${item.product_name}</strong><br/>
          <small>Size: ${item.size} | Color: ${item.color} | Qty: ${item.quantity}</small>
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
      <p style="font-size: 14px; color: #079447; font-weight: bold;">PAYMENT VERIFIED & ORDER CONFIRMED</p>
      <p>Hey ${order.customer_name},</p>
      <p>Thank you for choosing RightNowLife. Your payment for Order <strong>#${order.order_number}</strong> has been received and your garments are entering preparation.</p>
      
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
            <td style="padding-top: 10px; border-top: 1px solid #111111;">Total Paid</td>
            <td style="padding-top: 10px; border-top: 1px solid #111111; text-align: right;">₹${order.total.toLocaleString("en-IN")}</td>
          </tr>
        </tfoot>
      </table>

      <p style="font-size: 12px; color: #858585;">
        Delivery Address: ${order.address?.address_line1}, ${order.address?.city}, ${order.address?.state} - ${order.address?.pin_code}<br/>
        Air courier tracking details will be dispatched via SMS once picked up by our logistics partner.
      </p>
    </div>
  `;
}
