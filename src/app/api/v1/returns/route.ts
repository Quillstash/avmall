/**
 * POST /api/v1/returns
 *
 * Customer-initiated return request. Validates that:
 *   - the order belongs to the calling customer (or the unauthenticated
 *     guest-track flow with a matching phone)
 *   - the order is delivered (refused before delivery — CLAUDE.md §20)
 *   - we're inside the 14-day return window (configurable later)
 *   - the requested line quantities don't exceed what's still returnable
 *     (original line qty minus previously-returned qty)
 *
 * Creates a Return + ReturnLine rows in status="requested". Staff then
 * review via /admin/returns and approve / reject via the admin API.
 *
 * Body:
 *   {
 *     orderNumber: "AVM-2026-00000007",
 *     reason: "Doesn't fit",
 *     lines: [{ orderLineId, quantity, condition: "unopened"|"used"|"damaged", note? }],
 *   }
 *
 * Response (201): { return: { id, number, status, refundKobo } }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, hasDatabase } from "@/lib/db";
import { getCustomerSession } from "@/lib/customer-session";
import { writeAudit } from "@/lib/audit";
import { nextReturnNumber } from "@/lib/return-number";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import {
  AppError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";

export const runtime = "nodejs";

/** Default 14-day window per CLAUDE.md §20. Promote to settings later. */
const RETURN_WINDOW_DAYS = 14;

const bodySchema = z.object({
  orderNumber: z.string().min(1),
  reason: z.string().min(3).max(500),
  lines: z
    .array(
      z.object({
        orderLineId: z.string().uuid(),
        quantity: z.number().int().positive(),
        condition: z.enum(["unopened", "used", "damaged"]),
      }),
    )
    .min(1, "Pick at least one item to return"),
});

export async function POST(req: NextRequest) {
  try {
    if (!hasDatabase) {
      throw new AppError(
        "DB_NOT_CONFIGURED",
        "Returns require DATABASE_URL.",
        503,
      );
    }

    const session = await getCustomerSession();
    if (!session) {
      // Returns require a logged-in customer. Guests must sign in via OTP
      // first — we can't safely tie a return to an order without identity.
      throw new AppError(
        "UNAUTHENTICATED",
        "Sign in to request a return",
        401,
      );
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ValidationError({
        [issue?.path.join(".") ?? "body"]: issue?.message ?? "Invalid",
      });
    }
    const body = parsed.data;

    const order = await db.order.findUnique({
      where: { number: body.orderNumber },
      include: {
        lines: true,
        returns: { include: { lines: true } },
      },
    });
    if (!order) throw new NotFoundError(`Order ${body.orderNumber}`);
    if (order.customerId !== session.customerId) {
      // Don't leak whether the order exists — same shape as not-found.
      throw new NotFoundError(`Order ${body.orderNumber}`);
    }

    // Gate: order must be delivered before we accept a return.
    if (order.status !== "delivered" || !order.deliveredAt) {
      throw new ConflictError(
        "Can only return delivered orders. Track your order for updates.",
      );
    }

    // Gate: within return window.
    const windowEnds = new Date(
      order.deliveredAt.getTime() + RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );
    const outsideWindow = new Date() > windowEnds;
    if (outsideWindow) {
      throw new ConflictError(
        `Outside the ${RETURN_WINDOW_DAYS}-day return window. Contact support if this is exceptional.`,
      );
    }

    // Compute remaining returnable qty per order line.
    const orderLineById = new Map(order.lines.map((l) => [l.id, l]));
    const alreadyReturnedByLineId = new Map<string, number>();
    for (const r of order.returns) {
      // Count only returns that aren't rejected — pending requests still
      // hold the qty so customers can't double-submit.
      if (r.status === "rejected") continue;
      for (const rl of r.lines) {
        alreadyReturnedByLineId.set(
          rl.orderLineId,
          (alreadyReturnedByLineId.get(rl.orderLineId) ?? 0) + rl.quantity,
        );
      }
    }

    let refundKobo = 0;
    const lineCreates: {
      orderLineId: string;
      quantity: number;
      condition: "unopened" | "used" | "damaged";
      refundKobo: bigint;
    }[] = [];

    for (const reqLine of body.lines) {
      const ol = orderLineById.get(reqLine.orderLineId);
      if (!ol) {
        throw new ValidationError({
          [`lines.${reqLine.orderLineId}`]: "Line not part of this order",
        });
      }
      const alreadyReturned = alreadyReturnedByLineId.get(ol.id) ?? 0;
      const remaining = ol.quantity - alreadyReturned;
      if (remaining <= 0) {
        throw new ConflictError(
          `Item "${ol.nameSnapshot}" has already been fully returned`,
        );
      }
      if (reqLine.quantity > remaining) {
        throw new ValidationError({
          [`lines.${ol.id}.quantity`]: `Only ${remaining} unit${remaining === 1 ? "" : "s"} of "${ol.nameSnapshot}" can still be returned`,
        });
      }
      const lineRefund = Number(ol.unitKobo) * reqLine.quantity;
      refundKobo += lineRefund;
      lineCreates.push({
        orderLineId: ol.id,
        quantity: reqLine.quantity,
        condition: reqLine.condition,
        refundKobo: BigInt(lineRefund),
      });
    }

    const created = await db.$transaction(async (tx) => {
      const number = await nextReturnNumber(tx);

      // After this insert, are all order lines fully returned?
      const fullyReturned = order.lines.every((ol) => {
        const already = alreadyReturnedByLineId.get(ol.id) ?? 0;
        const requested =
          body.lines.find((l) => l.orderLineId === ol.id)?.quantity ?? 0;
        return already + requested >= ol.quantity;
      });

      const ret = await tx.return.create({
        data: {
          number,
          orderId: order.id,
          customerId: session.customerId,
          status: "requested",
          reason: body.reason.trim(),
          refundKobo: BigInt(refundKobo),
          refundMethod: "original",
          outsideWindow: false,
          fullyReturned,
          lines: {
            create: lineCreates,
          },
        },
      });

      await writeAudit(
        {
          actorType: "customer",
          action: "return.create",
          entityType: "return",
          entityId: ret.id,
          after: {
            number: ret.number,
            orderNumber: order.number,
            refundKobo,
            items: lineCreates.length,
            fullyReturned,
          },
        },
        tx,
      );

      return ret;
    });

    return NextResponse.json(
      apiSuccess({
        return: {
          id: created.id,
          number: created.number,
          status: created.status,
          refundKobo: Number(created.refundKobo),
        },
      }),
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
