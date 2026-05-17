/**
 * POST /api/v1/ai/tools/payments/link
 *
 * Create a payment link for an existing order. Records a pending payment row
 * with a deterministic reference and returns a hosted-checkout URL the AI
 * can share with the customer.
 *
 * The Nuqood integration is wired in Phase 5 — until then this returns a
 * stub URL pointing at the storefront's order tracking page. The pending
 * OrderPayment row is real either way, so once Nuqood is wired the webhook
 * will mark this same row as completed.
 *
 * Body:
 *   {
 *     orderNumber: string,
 *     amountKobo?: number,   // defaults to the outstanding balance
 *     method?: "nuqood" | "bank_transfer",   // default "nuqood"
 *   }
 *
 * Response:
 *   { reference, paymentUrl, amountKobo, expiresAt }
 *
 * Auth: Bearer AI_AGENT_TOKEN
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, hasDatabase } from "@/lib/db";
import { requireAiAgent } from "@/lib/ai-auth";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { env } from "@/lib/env";
import { SITE } from "@/lib/site";
import { createDynamicAccount, nuqoodConfigured } from "@/lib/nuqood";
import {
  AppError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";

export const runtime = "nodejs";

const bodySchema = z.object({
  orderNumber: z.string().min(1),
  amountKobo: z.number().int().positive().optional(),
  method: z.enum(["nuqood", "bank_transfer"]).default("nuqood"),
});

/** 32-char hex reference. Short enough for SMS, long enough to dedupe. */
function makeRef(): string {
  return Array.from({ length: 4 })
    .map(() => Math.random().toString(16).slice(2, 10).padStart(8, "0"))
    .join("")
    .slice(0, 32);
}

export async function POST(req: NextRequest) {
  try {
    requireAiAgent(req);

    if (!hasDatabase) {
      throw new AppError("DB_NOT_CONFIGURED", "Payment link requires DATABASE_URL.", 503);
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ValidationError({
        [issue?.path.join(".") ?? "body"]: issue?.message ?? "Invalid",
      });
    }
    const { orderNumber, method } = parsed.data;

    const order = await db.order.findUnique({ where: { number: orderNumber } });
    if (!order) throw new NotFoundError(`Order ${orderNumber}`);
    if (order.status === "cancelled") {
      throw new ConflictError("Order is cancelled — cannot collect payment");
    }

    const outstandingKobo = Number(order.totalKobo) - Number(order.paidKobo);
    if (outstandingKobo <= 0) {
      throw new ConflictError("Order is fully paid — no payment due");
    }
    const amountKobo = parsed.data.amountKobo ?? outstandingKobo;
    if (amountKobo > outstandingKobo) {
      throw new ValidationError({
        amountKobo: `Cannot collect more than the outstanding balance (₦${outstandingKobo / 100}).`,
      });
    }

    // Hit Nuqood for a real hosted-checkout URL when we're wired up + the
    // requested method is Nuqood. Falls back to the storefront tracking page
    // for bank_transfer (or any time Nuqood isn't configured).
    let reference: string;
    let paymentUrl: string;
    let bankDetails: { number: string; name: string; bank: string } | null = null;
    let nuqoodLive = false;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    if (nuqoodConfigured && method === "nuqood") {
      // Look up the customer email if available — Nuqood requires one.
      const customer = order.customerId
        ? await db.customer.findUnique({
            where: { id: order.customerId },
            select: { email: true },
          })
        : null;
      const email =
        customer?.email ?? `order-${order.number}@${SITE.url.replace(/^https?:\/\//, "")}`;

      const callbackUrl = `${SITE.url}/api/v1/webhooks/nuqood${
        env.NUQOOD_WEBHOOK_SECRET
          ? `?token=${encodeURIComponent(env.NUQOOD_WEBHOOK_SECRET)}`
          : ""
      }`;

      const account = await createDynamicAccount({
        email,
        amountKobo,
        callbackUrl,
      });

      reference = account.ref;
      paymentUrl = account.checkoutUrl;
      bankDetails = {
        number: account.number,
        name: account.name,
        bank: account.bank,
      };
      nuqoodLive = true;
    } else {
      // Stub flow: random reference + storefront URL so the customer has
      // somewhere to land. The webhook is the source of truth in production.
      reference = makeRef();
      paymentUrl = `${SITE.url}/orders/${order.number}?ref=${reference}`;
    }

    await db.orderPayment.create({
      data: {
        orderId: order.id,
        method,
        amountKobo: BigInt(amountKobo),
        reference,
        status: "pending",
      },
    });

    await writeAudit({
      actorType: "ai",
      action: "payment.link_created",
      entityType: "order",
      entityId: order.id,
      after: { orderNumber, reference, amountKobo, method, nuqoodLive },
    });

    return NextResponse.json(
      apiSuccess({
        reference,
        paymentUrl,
        amountKobo,
        method,
        expiresAt: expiresAt.toISOString(),
        nuqoodLive,
        ...(bankDetails && { bankTransfer: bankDetails }),
      }),
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
