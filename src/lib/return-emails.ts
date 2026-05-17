/**
 * Fire-and-forget return email helpers. Same shape as `order-emails.ts` — each
 * function looks up the return + customer, skips silently when no email, and
 * never throws into the caller.
 */

import "server-only";

import { db, hasDatabase } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import {
  returnReceivedEmail,
  refundProcessedEmail,
} from "@/lib/email-templates";

export async function emailOnReturnReceived(returnId: string): Promise<void> {
  if (!hasDatabase) return;
  try {
    const ret = await db.return.findUnique({
      where: { id: returnId },
      include: {
        order: { select: { number: true } },
        customer: { select: { name: true, email: true } },
      },
    });
    if (!ret) return;
    const email = ret.customer?.email;
    if (!email) return;

    const { subject, html, text } = returnReceivedEmail({
      recipientName: ret.customer?.name ?? "there",
      returnNumber: ret.number,
      orderNumber: ret.order.number,
      refundKobo: Number(ret.refundKobo),
    });
    await sendEmail({
      to: email,
      subject,
      html,
      text,
      tags: [
        { name: "kind", value: "return-received" },
        { name: "return", value: ret.number },
      ],
    });
  } catch (err) {
    console.error("[return-emails] received failed:", err);
  }
}

export async function emailOnRefundProcessed(
  returnId: string,
  method: string,
): Promise<void> {
  if (!hasDatabase) return;
  try {
    const ret = await db.return.findUnique({
      where: { id: returnId },
      include: {
        order: { select: { number: true } },
        customer: { select: { name: true, email: true } },
      },
    });
    if (!ret) return;
    const email = ret.customer?.email;
    if (!email) return;

    const { subject, html, text } = refundProcessedEmail({
      recipientName: ret.customer?.name ?? "there",
      returnNumber: ret.number,
      orderNumber: ret.order.number,
      refundKobo: Number(ret.refundKobo),
      method,
    });
    await sendEmail({
      to: email,
      subject,
      html,
      text,
      tags: [
        { name: "kind", value: "refund-processed" },
        { name: "return", value: ret.number },
      ],
    });
  } catch (err) {
    console.error("[return-emails] refund failed:", err);
  }
}
