/**
 * Email template builders. Each returns `{ subject, html, text }` — pass the
 * result into `sendEmail()`. No external rendering libs — the templates are
 * plain HTML strings inside a shared layout so they render in every client.
 *
 * Why inline HTML, not React Email: it adds a heavy dep + a build step for
 * what is, today, ~6 emails. We can graduate to React Email once we have a
 * proper marketing surface.
 */

import "server-only";

import { SITE } from "@/lib/site";
import { formatMoney } from "@/lib/money";

/** Wraps a block of inner HTML in our brand layout. */
function layout(opts: {
  preheader?: string;
  heading: string;
  body: string;
  ctaUrl?: string;
  ctaLabel?: string;
  footerNote?: string;
}): string {
  const ctaHtml = opts.ctaUrl
    ? `
      <tr>
        <td style="padding: 24px 0 8px;">
          <a href="${opts.ctaUrl}" style="display: inline-block; background: #2c5cdc; color: #ffffff; padding: 12px 22px; border-radius: 8px; font-weight: 600; text-decoration: none; font-size: 14px;">
            ${opts.ctaLabel ?? "Open"}
          </a>
        </td>
      </tr>`
    : "";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(opts.heading)}</title>
  </head>
  <body style="margin: 0; padding: 0; background: #f4f6fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #14182b;">
    <span style="display: none !important; opacity: 0; color: transparent; height: 0; max-height: 0; overflow: hidden;">${escapeHtml(opts.preheader ?? "")}</span>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background: #f4f6fa;">
      <tr>
        <td align="center" style="padding: 32px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width: 560px; background: #ffffff; border-radius: 14px; padding: 32px;">
            <tr>
              <td style="padding-bottom: 24px;">
                <div style="display: inline-flex; align-items: center; gap: 8px; font-weight: 700; font-size: 18px;">
                  <span style="display: inline-block; width: 28px; height: 28px; line-height: 28px; text-align: center; border-radius: 6px; background: #2c5cdc; color: #ffffff; font-weight: 800; font-size: 12px;">av</span>
                  <span>mall</span>
                </div>
              </td>
            </tr>
            <tr>
              <td style="font-size: 22px; font-weight: 700; line-height: 1.25; padding-bottom: 14px;">${escapeHtml(opts.heading)}</td>
            </tr>
            <tr>
              <td style="font-size: 15px; line-height: 1.6; color: #14182b;">
                ${opts.body}
              </td>
            </tr>
            ${ctaHtml}
            <tr>
              <td style="padding-top: 32px; border-top: 1px solid #e6e9ef; margin-top: 32px;">
                <p style="font-size: 12px; color: #6b7280; line-height: 1.6; margin: 0;">
                  ${opts.footerNote ? opts.footerNote + "<br />" : ""}
                  ${escapeHtml(SITE.legalName)} Ltd · ${escapeHtml(SITE.address.city)}, ${escapeHtml(SITE.address.state)}<br />
                  Need help? Reply to this email or WhatsApp ${escapeHtml(SITE.phone)}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

// ─── Customer OTP ─────────────────────────────────────────────────────────

export function customerOtpEmail(args: { code: string }): EmailContent {
  const subject = `Your ${SITE.name} sign-in code is ${args.code}`;
  const heading = "Your sign-in code";
  const body = `
    <p style="margin: 0 0 12px;">Enter this code on the sign-in page:</p>
    <p style="margin: 0 0 12px; font-size: 32px; font-weight: 700; letter-spacing: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #f4f6fa; padding: 18px 0; text-align: center; border-radius: 10px;">${escapeHtml(args.code)}</p>
    <p style="margin: 0 0 12px; color: #6b7280; font-size: 13px;">The code expires in 5 minutes. If you didn't ask to sign in, ignore this email.</p>
  `;
  const html = layout({
    preheader: `Your sign-in code is ${args.code}`,
    heading,
    body,
    footerNote: "Never share this code with anyone — not even Avmall staff.",
  });
  const text = `Your ${SITE.name} sign-in code is: ${args.code}

The code expires in 5 minutes. If you didn't ask to sign in, ignore this email.`;
  return { subject, html, text };
}

// ─── Staff password reset ─────────────────────────────────────────────────

export function staffPasswordResetEmail(args: {
  recipientName: string;
  resetUrl: string;
  expiresAt: Date;
}): EmailContent {
  const expiry = args.expiresAt.toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  });
  const subject = `Reset your ${SITE.name} password`;
  const heading = `Reset your password, ${escapeHtml(args.recipientName)}.`;
  const body = `
    <p style="margin: 0 0 14px;">Someone asked to reset the password for this account. Click below to choose a new one.</p>
    <p style="margin: 0 0 14px; color: #6b7280; font-size: 13px;">The link expires <strong>${escapeHtml(expiry)}</strong>. If you didn't request this, you can ignore this email — your password will stay the same.</p>
  `;
  const html = layout({
    preheader: `Reset your ${SITE.name} password`,
    heading,
    body,
    ctaUrl: args.resetUrl,
    ctaLabel: "Reset password",
    footerNote: "Single-use link — only the most recent reset email works.",
  });
  const text = `Reset your password, ${args.recipientName}.

Reset link: ${args.resetUrl}

The link expires ${expiry}. If you didn't request this, you can ignore this email — your password will stay the same.`;
  return { subject, html, text };
}

// ─── Staff invitation ─────────────────────────────────────────────────────

export function staffInvitationEmail(args: {
  recipientName: string;
  inviterName: string;
  role: string;
  acceptUrl: string;
  expiresAt: Date;
}): EmailContent {
  const expiry = args.expiresAt.toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  });
  const roleLabel = args.role.replace(/_/g, " ");
  const subject = `You're invited to join ${SITE.name} as ${roleLabel}`;
  const heading = `Welcome to ${SITE.legalName}, ${escapeHtml(args.recipientName)}.`;
  const body = `
    <p style="margin: 0 0 14px;">${escapeHtml(args.inviterName)} has invited you to join the ${escapeHtml(SITE.legalName)} admin as a <strong>${escapeHtml(roleLabel)}</strong>.</p>
    <p style="margin: 0 0 14px;">Click the button below to set your password and sign in. The invite expires <strong>${escapeHtml(expiry)}</strong>.</p>
  `;
  const html = layout({
    preheader: `${args.inviterName} invited you to join ${SITE.name}.`,
    heading,
    body,
    ctaUrl: args.acceptUrl,
    ctaLabel: "Accept invitation",
    footerNote: "If you didn't expect this email, please ignore it.",
  });
  const text = `Welcome to ${SITE.legalName}, ${args.recipientName}.

${args.inviterName} has invited you to join the ${SITE.legalName} admin as ${roleLabel}.

Accept your invite: ${args.acceptUrl}

The link expires ${expiry}.`;
  return { subject, html, text };
}

// ─── Order created ────────────────────────────────────────────────────────

export function orderConfirmationEmail(args: {
  recipientName: string;
  orderNumber: string;
  totalKobo: number;
  paidKobo: number;
  outstandingKobo: number;
  items: { name: string; qty: number; lineTotalKobo: number }[];
  shipping: { city: string; state: string; line1: string };
  trackingUrl: string;
}): EmailContent {
  const subject = `Order ${args.orderNumber} confirmed`;
  const heading = `Thanks, ${escapeHtml(args.recipientName)} — your order's in.`;
  const itemsHtml = args.items
    .map(
      (i) => `
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #f0f2f5;">
            <div style="font-weight: 600;">${escapeHtml(i.name)}</div>
            <div style="font-size: 12px; color: #6b7280;">${i.qty} × ${escapeHtml(formatMoney(Math.floor(i.lineTotalKobo / i.qty)))}</div>
          </td>
          <td style="padding: 8px 0; text-align: right; border-bottom: 1px solid #f0f2f5; font-weight: 600;">
            ${escapeHtml(formatMoney(i.lineTotalKobo))}
          </td>
        </tr>`,
    )
    .join("");
  const body = `
    <p style="margin: 0 0 18px;">We've recorded order <strong>${escapeHtml(args.orderNumber)}</strong>. Here's a summary.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 18px;">
      ${itemsHtml}
      <tr>
        <td style="padding: 12px 0 4px; font-weight: 700;">Total</td>
        <td style="padding: 12px 0 4px; text-align: right; font-weight: 700;">${escapeHtml(formatMoney(args.totalKobo))}</td>
      </tr>
      ${
        args.paidKobo > 0
          ? `<tr>
        <td style="padding: 0 0 4px; font-size: 12px; color: #6b7280;">Paid</td>
        <td style="padding: 0 0 4px; text-align: right; font-size: 12px; color: #6b7280;">${escapeHtml(formatMoney(args.paidKobo))}</td>
      </tr>`
          : ""
      }
      ${
        args.outstandingKobo > 0
          ? `<tr>
        <td style="padding: 0; font-size: 13px; color: #b54708; font-weight: 700;">Outstanding</td>
        <td style="padding: 0; text-align: right; font-size: 13px; color: #b54708; font-weight: 700;">${escapeHtml(formatMoney(args.outstandingKobo))}</td>
      </tr>`
          : ""
      }
    </table>
    <p style="margin: 0 0 6px; font-size: 13px; color: #6b7280;">Shipping to</p>
    <p style="margin: 0 0 16px; font-size: 14px;">${escapeHtml(args.shipping.line1)}<br />${escapeHtml(args.shipping.city)}, ${escapeHtml(args.shipping.state)}</p>
  `;
  const html = layout({
    preheader: `${args.orderNumber} confirmed — ${formatMoney(args.totalKobo)}`,
    heading,
    body,
    ctaUrl: args.trackingUrl,
    ctaLabel: "Track this order",
  });
  const text = `Thanks ${args.recipientName} — your order's in.

Order: ${args.orderNumber}
Total: ${formatMoney(args.totalKobo)}
Paid:  ${formatMoney(args.paidKobo)}
${args.outstandingKobo > 0 ? `Outstanding: ${formatMoney(args.outstandingKobo)}\n` : ""}
Track this order: ${args.trackingUrl}`;
  return { subject, html, text };
}

// ─── Payment received ─────────────────────────────────────────────────────

export function paymentReceivedEmail(args: {
  recipientName: string;
  orderNumber: string;
  amountKobo: number;
  method: string;
  newPaidKobo: number;
  totalKobo: number;
  outstandingKobo: number;
  trackingUrl: string;
}): EmailContent {
  const fullyPaid = args.outstandingKobo <= 0;
  const subject = fullyPaid
    ? `Payment received — ${args.orderNumber} is paid in full`
    : `Payment received — ${args.orderNumber}`;
  const heading = fullyPaid
    ? "Paid in full — thank you."
    : "Payment received.";
  const body = `
    <p style="margin: 0 0 14px;">We've recorded a <strong>${escapeHtml(formatMoney(args.amountKobo))}</strong> payment (${escapeHtml(args.method)}) toward order <strong>${escapeHtml(args.orderNumber)}</strong>.</p>
    ${
      fullyPaid
        ? `<p style="margin: 0 0 14px;">Your order will now move into fulfilment. We'll email again once it ships.</p>`
        : `<p style="margin: 0 0 14px;"><strong>${escapeHtml(formatMoney(args.outstandingKobo))}</strong> is still outstanding on this order.</p>`
    }
  `;
  const html = layout({
    preheader: `${formatMoney(args.amountKobo)} received for ${args.orderNumber}`,
    heading,
    body,
    ctaUrl: args.trackingUrl,
    ctaLabel: "View order",
  });
  const text = `Payment received: ${formatMoney(args.amountKobo)} (${args.method}) for ${args.orderNumber}.
${fullyPaid ? "Paid in full — we'll email again once it ships." : `Outstanding: ${formatMoney(args.outstandingKobo)}`}

View order: ${args.trackingUrl}`;
  return { subject, html, text };
}

// ─── Shipped ──────────────────────────────────────────────────────────────

export function orderShippedEmail(args: {
  recipientName: string;
  orderNumber: string;
  trackingUrl: string;
  carrier?: string;
  trackingNumber?: string;
}): EmailContent {
  const subject = `${args.orderNumber} is on the way`;
  const heading = "Your order has shipped.";
  const body = `
    <p style="margin: 0 0 14px;">Order <strong>${escapeHtml(args.orderNumber)}</strong> is on the way${
      args.carrier ? ` via <strong>${escapeHtml(args.carrier)}</strong>` : ""
    }.</p>
    ${
      args.trackingNumber
        ? `<p style="margin: 0 0 14px;">Tracking number: <strong>${escapeHtml(args.trackingNumber)}</strong></p>`
        : ""
    }
  `;
  const html = layout({
    preheader: `${args.orderNumber} is on the way`,
    heading,
    body,
    ctaUrl: args.trackingUrl,
    ctaLabel: "Track this order",
  });
  const text = `Your order has shipped.

Order: ${args.orderNumber}
${args.carrier ? `Carrier: ${args.carrier}\n` : ""}${args.trackingNumber ? `Tracking: ${args.trackingNumber}\n` : ""}
Track it: ${args.trackingUrl}`;
  return { subject, html, text };
}

// ─── Cancelled ────────────────────────────────────────────────────────────

export function orderCancelledEmail(args: {
  recipientName: string;
  orderNumber: string;
  reason?: string;
}): EmailContent {
  const subject = `${args.orderNumber} was cancelled`;
  const heading = "Your order was cancelled.";
  const body = `
    <p style="margin: 0 0 14px;">Order <strong>${escapeHtml(args.orderNumber)}</strong> has been cancelled. Any payments will be refunded to the original method within 5 business days.</p>
    ${args.reason ? `<p style="margin: 0 0 14px;">Reason: <em>${escapeHtml(args.reason)}</em></p>` : ""}
    <p style="margin: 0 0 14px;">If this wasn't expected, reply to this email and we'll look into it.</p>
  `;
  const html = layout({
    preheader: `${args.orderNumber} cancelled`,
    heading,
    body,
  });
  const text = `Your order ${args.orderNumber} was cancelled.
${args.reason ? `Reason: ${args.reason}\n` : ""}
Any payments will be refunded to the original method within 5 business days.`;
  return { subject, html, text };
}

// ─── Return received + refunded ───────────────────────────────────────────

export function returnReceivedEmail(args: {
  recipientName: string;
  returnNumber: string;
  orderNumber: string;
  refundKobo: number;
}): EmailContent {
  const subject = `Return ${args.returnNumber} received`;
  const heading = "We've received your return.";
  const body = `
    <p style="margin: 0 0 14px;">Return <strong>${escapeHtml(args.returnNumber)}</strong> (from order <strong>${escapeHtml(args.orderNumber)}</strong>) has been received. We'll inspect the items and process the <strong>${escapeHtml(formatMoney(args.refundKobo))}</strong> refund within 48 hours.</p>
  `;
  const html = layout({
    preheader: `Return ${args.returnNumber} received`,
    heading,
    body,
  });
  const text = `We've received your return ${args.returnNumber} (from order ${args.orderNumber}). Refund of ${formatMoney(args.refundKobo)} will be processed within 48 hours.`;
  return { subject, html, text };
}

export function refundProcessedEmail(args: {
  recipientName: string;
  returnNumber: string;
  orderNumber: string;
  refundKobo: number;
  method: string;
}): EmailContent {
  const subject = `Refund processed — ${args.returnNumber}`;
  const heading = "Your refund is on the way.";
  const body = `
    <p style="margin: 0 0 14px;">We've processed a <strong>${escapeHtml(formatMoney(args.refundKobo))}</strong> refund for return <strong>${escapeHtml(args.returnNumber)}</strong> (order <strong>${escapeHtml(args.orderNumber)}</strong>) via <strong>${escapeHtml(args.method)}</strong>.</p>
    <p style="margin: 0 0 14px;">Depending on your bank it may take 3–5 business days to land.</p>
  `;
  const html = layout({
    preheader: `Refund ${formatMoney(args.refundKobo)} processed`,
    heading,
    body,
  });
  const text = `Refund processed: ${formatMoney(args.refundKobo)} via ${args.method} for return ${args.returnNumber} (order ${args.orderNumber}). Allow 3–5 business days.`;
  return { subject, html, text };
}
