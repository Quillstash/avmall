/**
 * POST /api/v1/admin/orders/[number]/payment-link
 *
 * Generate a Nuqood hosted-checkout URL for the outstanding balance on an
 * order and record a `pending` OrderPayment. The Nuqood webhook eventually
 * flips that row to `completed` once the customer transfers.
 *
 * Permission: orders.edit
 *
 * Body (all optional):
 *   { amountKobo?: number }   // defaults to the order's outstanding balance
 *
 * Response (201):
 *   { reference, paymentUrl, amountKobo, expiresAt, nuqoodLive, bankTransfer? }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, hasDatabase } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { createDynamicAccount, nuqoodConfigured } from "@/lib/nuqood";
import { env } from "@/lib/env";
import { SITE } from "@/lib/site";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import {
  AppError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";

export const runtime = "nodejs";

const bodySchema = z.object({
  amountKobo: z.number().int().positive().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { number: string } },
) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "orders.edit");

    if (!hasDatabase) {
      throw new AppError(
        "DB_NOT_CONFIGURED",
        "Payment link requires DATABASE_URL.",
        503,
      );
    }
    if (!nuqoodConfigured) {
      throw new AppError(
        "NUQOOD_NOT_CONFIGURED",
        "Nuqood credentials missing — set NUQOOD_API_KEY, NUQOOD_SECRET_KEY and NUQOOD_BUSINESS_CODE.",
        503,
      );
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ValidationError({ body: "Invalid" });
    }

    const order = await db.order.findUnique({
      where: { number: params.number },
      include: { customer: { select: { email: true, name: true } } },
    });
    if (!order) throw new NotFoundError(`Order ${params.number}`);
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

    const callbackUrl = `${SITE.url}/api/v1/webhooks/nuqood${
      env.NUQOOD_WEBHOOK_SECRET
        ? `?token=${encodeURIComponent(env.NUQOOD_WEBHOOK_SECRET)}`
        : ""
    }`;
    const customerEmail =
      order.customer?.email ??
      `order-${order.number}@${SITE.url.replace(/^https?:\/\//, "")}`;

    const account = await createDynamicAccount({
      email: customerEmail,
      amountKobo,
      callbackUrl,
    });

    await db.orderPayment.create({
      data: {
        orderId: order.id,
        method: "nuqood",
        amountKobo: BigInt(amountKobo),
        reference: account.ref,
        status: "pending",
      },
    });

    await writeAudit({
      actorUserId: session.id,
      actorType: "staff",
      action: "payment.link_created",
      entityType: "order",
      entityId: order.id,
      after: {
        orderNumber: order.number,
        reference: account.ref,
        amountKobo,
        method: "nuqood",
      },
    });

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    return NextResponse.json(
      apiSuccess({
        reference: account.ref,
        paymentUrl: account.checkoutUrl,
        amountKobo,
        expiresAt: expiresAt.toISOString(),
        nuqoodLive: true,
        bankTransfer: {
          accountNumber: account.number,
          accountName: account.name,
          bank: account.bank,
        },
      }),
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
