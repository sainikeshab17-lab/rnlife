import { OrderWithDetails } from "@/lib/db";

export interface EmailSendResult {
  sent: boolean;
  provider: "smtp" | "resend" | "none";
  messageId?: string;
  error?: string;
}

/**
 * Order Confirmation Notification Service
 * Dispatches transactional notifications if credentials are provided in environment.
 * Honestly logs and reports when email provider is unconfigured.
 */
export async function sendOrderConfirmationEmail(
  order: OrderWithDetails
): Promise<EmailSendResult> {
  const smtpHost = process.env.SMTP_HOST;
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!smtpHost && !resendApiKey) {
    console.info(
      `[Notification Service] Order confirmation email for #${order.order_number} to <${order.customer_email}> skipped: No SMTP_HOST or RESEND_API_KEY configured.`
    );
    return {
      sent: false,
      provider: "none",
      error: "Email notification provider not configured in environment.",
    };
  }

  // If Resend API is configured
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
          to: [order.customer_email],
          subject: `Order Confirmed: #${order.order_number} — RightNowLife`,
          html: generateOrderEmailHtml(order),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          sent: true,
          provider: "resend",
          messageId: data.id,
        };
      } else {
        const errData = await response.text();
        return {
          sent: false,
          provider: "resend",
          error: `Resend error: ${errData}`,
        };
      }
    } catch (err: any) {
      return {
        sent: false,
        provider: "resend",
        error: err.message,
      };
    }
  }

  return {
    sent: false,
    provider: "none",
    error: "No supported email provider configured.",
  };
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
