import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn("[Email] SMTP not configured — emails will be logged but not sent. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.");
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return transporter;
}

const SENDER_NAME = process.env.SMTP_FROM_NAME || "AuditWise";
const SENDER_EMAIL = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "noreply@auditwise.tech";

export interface InvoiceEmailData {
  firmName: string;
  firmEmail: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  lines: { description: string; quantity: number; unitPrice: number; amount: number }[];
  subtotal: number;
  tax: number;
  total: number;
  planName: string;
  billingPeriod?: string;
}

function buildInvoiceHtml(data: InvoiceEmailData): string {
  const lineRows = data.lines.map(l => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;">${l.description}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:14px;">${l.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:14px;">${data.currency} ${l.unitPrice.toLocaleString("en-PK")}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:14px;font-weight:600;">${data.currency} ${l.amount.toLocaleString("en-PK")}</td>
    </tr>
  `).join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:650px;margin:0 auto;padding:24px 16px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <div style="background:#1e3a5f;padding:24px 32px;text-align:center;">
        <h1 style="color:#ffffff;margin:0;font-size:24px;letter-spacing:0.5px;">AuditWise</h1>
        <p style="color:#94a3b8;margin:4px 0 0;font-size:13px;">Statutory Audit Management Platform</p>
      </div>

      <div style="padding:32px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:24px;">
          <div>
            <h2 style="margin:0 0 4px;font-size:20px;color:#1e293b;">INVOICE</h2>
            <p style="margin:0;font-size:14px;color:#64748b;">${data.invoiceNo}</p>
          </div>
          <div style="text-align:right;">
            <p style="margin:0;font-size:13px;color:#64748b;">Invoice Date</p>
            <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:#1e293b;">${data.invoiceDate}</p>
          </div>
        </div>

        <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:24px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="vertical-align:top;width:50%;padding-right:16px;">
                <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Bill To</p>
                <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#1e293b;">${data.firmName}</p>
                <p style="margin:2px 0 0;font-size:13px;color:#64748b;">${data.firmEmail}</p>
              </td>
              <td style="vertical-align:top;text-align:right;">
                <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Due Date</p>
                <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#dc2626;">${data.dueDate}</p>
                <p style="margin:6px 0 0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Plan</p>
                <p style="margin:2px 0 0;font-size:13px;color:#1e293b;">${data.planName}</p>
              </td>
            </tr>
          </table>
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="padding:10px 12px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Description</th>
              <th style="padding:10px 12px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Qty</th>
              <th style="padding:10px 12px;text-align:right;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Unit Price</th>
              <th style="padding:10px 12px;text-align:right;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${lineRows}
          </tbody>
        </table>

        <div style="border-top:2px solid #e5e7eb;padding-top:12px;margin-top:8px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:4px 12px;text-align:right;font-size:14px;color:#64748b;">Subtotal</td>
              <td style="padding:4px 12px;text-align:right;font-size:14px;width:160px;">${data.currency} ${data.subtotal.toLocaleString("en-PK")}</td>
            </tr>
            ${data.tax > 0 ? `
            <tr>
              <td style="padding:4px 12px;text-align:right;font-size:14px;color:#64748b;">Tax</td>
              <td style="padding:4px 12px;text-align:right;font-size:14px;">${data.currency} ${data.tax.toLocaleString("en-PK")}</td>
            </tr>` : ""}
            <tr>
              <td style="padding:8px 12px;text-align:right;font-size:16px;font-weight:700;color:#1e293b;">Total Due</td>
              <td style="padding:8px 12px;text-align:right;font-size:18px;font-weight:700;color:#1e293b;">${data.currency} ${data.total.toLocaleString("en-PK")}</td>
            </tr>
          </table>
        </div>

        <div style="background:#fef3c7;border-radius:8px;padding:16px;margin-top:24px;border-left:4px solid #f59e0b;">
          <p style="margin:0;font-size:13px;color:#92400e;font-weight:600;">Payment Instructions</p>
          <p style="margin:6px 0 0;font-size:13px;color:#78350f;">Payment shall be made via Cash Deposit or Online Bank Transfer. After payment, please send the receipt to <strong>invoice@auditwise.tech</strong> along with your firm name for confirmation.</p>
          <p style="margin:8px 0 0;font-size:12px;color:#92400e;">If payment is not received within 15 days of the due date, your account may be suspended.</p>
        </div>
      </div>

      <div style="background:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:12px;color:#94a3b8;">This is an automated invoice from AuditWise. For questions, contact invoice@auditwise.tech</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export async function sendInvoiceEmail(data: InvoiceEmailData): Promise<{ sent: boolean; message: string }> {
  const html = buildInvoiceHtml(data);
  const subject = `Invoice ${data.invoiceNo} — ${data.currency} ${data.total.toLocaleString("en-PK")} | AuditWise`;

  const transport = getTransporter();

  if (!transport) {
    console.log(`[Email] Invoice ${data.invoiceNo} for ${data.firmName} (${data.firmEmail}) — SMTP not configured, email skipped.`);
    console.log(`[Email] Subject: ${subject}`);
    return { sent: false, message: "SMTP not configured. Invoice created but email not sent." };
  }

  try {
    await transport.sendMail({
      from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
      to: data.firmEmail,
      subject,
      html,
    });
    console.log(`[Email] Invoice ${data.invoiceNo} sent to ${data.firmEmail}`);
    return { sent: true, message: `Invoice emailed to ${data.firmEmail}` };
  } catch (error: any) {
    console.error(`[Email] Failed to send invoice ${data.invoiceNo} to ${data.firmEmail}:`, error.message);
    return { sent: false, message: `Email failed: ${error.message}` };
  }
}

export async function sendGenericEmail(to: string, subject: string, html: string): Promise<{ sent: boolean; message: string }> {
  const transport = getTransporter();

  if (!transport) {
    console.log(`[Email] Generic email to ${to} — SMTP not configured, skipped.`);
    return { sent: false, message: "SMTP not configured" };
  }

  try {
    await transport.sendMail({
      from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
      to,
      subject,
      html,
    });
    return { sent: true, message: `Email sent to ${to}` };
  } catch (error: any) {
    console.error(`[Email] Failed to send to ${to}:`, error.message);
    return { sent: false, message: `Email failed: ${error.message}` };
  }
}
