/**
 * Fire-and-forget order email helpers. Each function:
 *
 *   - looks up the customer + order summary from the DB
 *   - skips silently when the customer has no email on file
 *   - never throws into the caller (so a Resend outage doesn't fail an order)
 *
 * Callers should `void emailOnOrderCreated(orderId)` (no await) when the
 * order is created in a transaction context, so the SMTP round-trip doesn't
 * hold the DB connection. Outside a txn an await is fine.
 */

import "server-only";

import { db, hasDatabase } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import {
  orderConfirmationEmail,
  paymentReceivedEmail,
  orderShippedEmail,
  orderCancelledEmail,
} from "@/lib/email-templates";
import { SITE } from "@/lib/site";
import { appUrl } from "@/lib/app-url";
import { formatMoney } from "@/lib/money";

function trackingUrl(orderNumber: string): string {
  return appUrl(`/orders/${orderNumber}`);
}

/** Installment-balance reminder. Returns true only if an email was sent
 *  (customer has an address on file + there's still a balance). */
export async function emailInstallmentReminder(orderId: string): Promise<boolean> {
  if (!hasDatabase) return false;
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { customer: { select: { name: true, email: true } } },
    });
    if (!order) return false;
    const email = order.customer?.email;
    if (!email) return false;

    const total = Number(order.totalKobo);
    const paid = Number(order.paidKobo);
    const outstanding = Math.max(0, total - paid);
    if (outstanding <= 0) return false;

    const name = order.customer?.name ?? order.shipName;
    const url = trackingUrl(order.number);
    const subject = `Payment reminder — order ${order.number}`;
    const text = `Hi ${name},\n\nA friendly reminder that order ${order.number} has an outstanding balance of ${formatMoney(
      outstanding,
    )} (${formatMoney(paid)} of ${formatMoney(total)} paid). You can pay any amount towards it at any time.\n\nView your order: ${url}\n\nThank you,\n${SITE.name}`;
    const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;color:#0f172a">
      <p>Hi ${name},</p>
      <p>A friendly reminder that order <strong>${order.number}</strong> has an outstanding balance of <strong>${formatMoney(
        outstanding,
      )}</strong> (${formatMoney(paid)} of ${formatMoney(total)} paid).</p>
      <p>You can pay any amount towards it at any time.</p>
      <p><a href="${url}">View your order</a></p>
      <p style="color:#64748b">Thank you,<br/>${SITE.name}</p>
    </div>`;

    await sendEmail({
      to: email,
      subject,
      html,
      text,
      tags: [
        { name: "kind", value: "installment-reminder" },
        { name: "order", value: order.number },
      ],
    });
    return true;
  } catch (err) {
    console.error("[order-emails] installment reminder failed:", err);
    return false;
  }
}

/** Order-confirmation email, fired right after order creation. */
export async function emailOnOrderCreated(orderId: string): Promise<void> {
  if (!hasDatabase) return;
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        customer: { select: { name: true, email: true } },
        lines: {
          select: {
            nameSnapshot: true,
            quantity: true,
            unitKobo: true,
            bulkDiscountKobo: true,
          },
        },
      },
    });
    if (!order) return;
    const email = order.customer?.email;
    if (!email) return;

    const { subject, html, text } = orderConfirmationEmail({
      recipientName: order.customer?.name ?? order.shipName,
      orderNumber: order.number,
      totalKobo: Number(order.totalKobo),
      paidKobo: Number(order.paidKobo),
      outstandingKobo: Math.max(
        0,
        Number(order.totalKobo) - Number(order.paidKobo),
      ),
      items: order.lines.map((l) => ({
        name: l.nameSnapshot,
        qty: l.quantity,
        lineTotalKobo:
          Number(l.unitKobo) * l.quantity - Number(l.bulkDiscountKobo),
      })),
      shipping: {
        line1: order.shipLine1,
        city: order.shipCity,
        state: order.shipState,
      },
      trackingUrl: trackingUrl(order.number),
    });

    await sendEmail({
      to: email,
      subject,
      html,
      text,
      tags: [
        { name: "kind", value: "order-confirmation" },
        { name: "order", value: order.number },
      ],
    });
  } catch (err) {
    console.error("[order-emails] confirmation failed:", err);
  }
}

/** Payment-received email — fired after /payments or the Nuqood webhook. */
export async function emailOnPaymentReceived(
  orderId: string,
  amountKobo: number,
  method: string,
): Promise<void> {
  if (!hasDatabase) return;
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { customer: { select: { name: true, email: true } } },
    });
    if (!order) return;
    const email = order.customer?.email;
    if (!email) return;

    const total = Number(order.totalKobo);
    const paid = Number(order.paidKobo);
    const outstanding = Math.max(0, total - paid);

    const { subject, html, text } = paymentReceivedEmail({
      recipientName: order.customer?.name ?? order.shipName,
      orderNumber: order.number,
      amountKobo,
      method,
      newPaidKobo: paid,
      totalKobo: total,
      outstandingKobo: outstanding,
      trackingUrl: trackingUrl(order.number),
    });

    await sendEmail({
      to: email,
      subject,
      html,
      text,
      tags: [
        { name: "kind", value: "payment-received" },
        { name: "order", value: order.number },
      ],
    });
  } catch (err) {
    console.error("[order-emails] payment-received failed:", err);
  }
}

/** Shipped notification. */
export async function emailOnOrderShipped(
  orderId: string,
  extra?: { carrier?: string; trackingNumber?: string },
): Promise<void> {
  if (!hasDatabase) return;
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { customer: { select: { name: true, email: true } } },
    });
    if (!order) return;
    const email = order.customer?.email;
    if (!email) return;

    const { subject, html, text } = orderShippedEmail({
      recipientName: order.customer?.name ?? order.shipName,
      orderNumber: order.number,
      trackingUrl: trackingUrl(order.number),
      ...(extra?.carrier && { carrier: extra.carrier }),
      ...(extra?.trackingNumber && { trackingNumber: extra.trackingNumber }),
    });
    await sendEmail({
      to: email,
      subject,
      html,
      text,
      tags: [
        { name: "kind", value: "order-shipped" },
        { name: "order", value: order.number },
      ],
    });
  } catch (err) {
    console.error("[order-emails] shipped failed:", err);
  }
}

/** Cancellation notification. */
export async function emailOnOrderCancelled(
  orderId: string,
  reason?: string,
): Promise<void> {
  if (!hasDatabase) return;
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { customer: { select: { name: true, email: true } } },
    });
    if (!order) return;
    const email = order.customer?.email;
    if (!email) return;

    const { subject, html, text } = orderCancelledEmail({
      recipientName: order.customer?.name ?? order.shipName,
      orderNumber: order.number,
      ...(reason && { reason }),
    });
    await sendEmail({
      to: email,
      subject,
      html,
      text,
      tags: [
        { name: "kind", value: "order-cancelled" },
        { name: "order", value: order.number },
      ],
    });
  } catch (err) {
    console.error("[order-emails] cancelled failed:", err);
  }
}
