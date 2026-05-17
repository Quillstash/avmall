/**
 * POST /api/v1/webhooks/nuqood?token=<shared secret>
 *
 * Nuqood pings us here once a bank transfer / dynamic-account payment is
 * confirmed. Marks the matching OrderPayment as completed, bumps the order's
 * paidKobo + paymentStatus, and writes an audit log.
 *
 * Security
 * --------
 * Nuqood's docs don't define a signing scheme, so we authenticate the inbound
 * webhook with a shared URL token (`?token=...`) the merchant adds to their
 * callback URL in the Nuqood dashboard. The token lives in
 * NUQOOD_WEBHOOK_SECRET. Requests without the right token are rejected 403.
 *
 * Idempotency
 * -----------
 * Nuqood may retry. We key on `transaction_reference` and refuse to apply the
 * same payment twice (status already `completed` → no-op, returns 200).
 */

import { NextRequest, NextResponse } from "next/server";
import { db, hasDatabase } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { emailOnPaymentReceived } from "@/lib/order-emails";
import {
  amountFromNuqood,
  type NuqoodWebhookPayload,
} from "@/lib/nuqood";
import { env } from "@/lib/env";

export const runtime = "nodejs";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function POST(req: NextRequest) {
  // 1. URL-token check (our home-grown signature substitute).
  const presented = req.nextUrl.searchParams.get("token") ?? "";
  const expected = env.NUQOOD_WEBHOOK_SECRET;
  if (!expected) {
    // Refuse to accept webhooks until the operator has set a token. This is
    // safer than implicitly trusting every POST that hits the URL.
    console.error("[nuqood-webhook] NUQOOD_WEBHOOK_SECRET not set — rejecting");
    return NextResponse.json(
      { error: { code: "WEBHOOK_NOT_CONFIGURED", message: "Webhook token missing" } },
      { status: 503 },
    );
  }
  if (!safeEqual(presented, expected)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Invalid webhook token" } },
      { status: 403 },
    );
  }

  if (!hasDatabase) {
    return NextResponse.json(
      { error: { code: "DB_NOT_CONFIGURED", message: "Database required" } },
      { status: 503 },
    );
  }

  // 2. Parse payload.
  let payload: NuqoodWebhookPayload;
  try {
    payload = (await req.json()) as NuqoodWebhookPayload;
  } catch {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
      { status: 400 },
    );
  }
  if (!payload?.transaction_reference) {
    return NextResponse.json(
      {
        error: {
          code: "BAD_REQUEST",
          message: "transaction_reference missing in webhook payload",
        },
      },
      { status: 400 },
    );
  }

  const reference = payload.transaction_reference;
  const amountKobo = amountFromNuqood(payload.amount);

  try {
    const result = await db.$transaction(async (tx) => {
      const payment = await tx.orderPayment.findFirst({
        where: { reference },
        include: { order: true },
      });

      if (!payment) {
        // Unknown reference — log and accept (200) so Nuqood stops retrying.
        // We can't link the money to an order without manual reconciliation.
        return { kind: "unknown" as const };
      }

      if (payment.status === "completed") {
        return { kind: "duplicate" as const, payment };
      }

      // 3. Mark payment completed.
      await tx.orderPayment.update({
        where: { id: payment.id },
        data: {
          status: "completed",
          // Use Nuqood's reported amount if it differs (e.g. customer paid
          // a partial). The order's outstanding will reflect the truth.
          amountKobo: BigInt(amountKobo > 0 ? amountKobo : Number(payment.amountKobo)),
        },
      });

      // 4. Recompute the order's paid total + status from the source of truth
      //    (all completed payment rows), avoiding drift from prior partials.
      const allCompleted = await tx.orderPayment.findMany({
        where: { orderId: payment.orderId, status: "completed" },
        select: { amountKobo: true },
      });
      const paidKobo = allCompleted.reduce(
        (a, p) => a + Number(p.amountKobo),
        0,
      );
      const total = Number(payment.order.totalKobo);
      const paymentStatus =
        paidKobo <= 0 ? "unpaid" : paidKobo < total ? "partial" : "paid";

      await tx.order.update({
        where: { id: payment.orderId },
        data: {
          paidKobo: BigInt(paidKobo),
          paymentStatus,
          // Auto-confirm on full payment, mirroring the manual /payments flow.
          ...(paymentStatus === "paid" &&
            payment.order.status === "pending" && { status: "confirmed" }),
        },
      });

      await writeAudit(
        {
          actorType: "system",
          action: "payment.webhook_received",
          entityType: "order_payment",
          entityId: payment.id,
          before: { status: payment.status, paidKobo: Number(payment.order.paidKobo) },
          after: { status: "completed", paidKobo, paymentStatus },
          metadata: {
            channel: "nuqood-webhook",
            reference,
            amountKobo,
            ...(payload.customer_sendername && {
              senderName: payload.customer_sendername,
            }),
            ...(payload.customer_senderbankname && {
              senderBank: payload.customer_senderbankname,
            }),
          },
        },
        tx,
      );

      return {
        kind: "applied" as const,
        paidKobo,
        paymentStatus,
        orderId: payment.orderId,
        applyAmountKobo: amountKobo > 0 ? amountKobo : Number(payment.amountKobo),
      };
    });

    // Fire-and-forget email notification when a new payment was applied.
    if (result.kind === "applied") {
      void emailOnPaymentReceived(
        result.orderId,
        result.applyAmountKobo,
        "Bank transfer (Nuqood)",
      );
    }

    return NextResponse.json({ data: { received: true, ...result } });
  } catch (err) {
    console.error("[nuqood-webhook] failed:", err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL",
          message: "Failed to apply webhook — Nuqood will retry",
        },
      },
      { status: 500 },
    );
  }
}
