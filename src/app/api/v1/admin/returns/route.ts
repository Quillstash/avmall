/**
 * POST /api/v1/admin/returns
 *
 * Counter return — admin records a return when the customer brings the item
 * back in person. Creates the Return + ReturnLines inside a transaction,
 * restocks the variants when condition allows, and writes audit entries.
 *
 * Permission: returns.create
 *
 * Body:
 *   {
 *     orderNumber: string,
 *     lines: [
 *       {
 *         orderLineId: string (uuid),
 *         quantity: number,
 *         condition: "unopened" | "used" | "damaged",
 *         restock: boolean,
 *         refundKobo?: number,    // defaults to unit × qty when omitted
 *       },
 *     ],
 *     reason: string,
 *     refundMethod: "original" | "transfer",
 *     internalNote?: string,
 *   }
 *
 * Response (201):
 *   { return: { id, number, status, refundKobo } }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, hasDatabase } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { nextReturnNumber } from "@/lib/return-number";
import { emailOnReturnReceived } from "@/lib/return-emails";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import {
  AppError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";

export const runtime = "nodejs";

const RETURN_WINDOW_DAYS = 14;

const bodySchema = z.object({
  orderNumber: z.string().min(1),
  lines: z
    .array(
      z.object({
        orderLineId: z.string().uuid("orderLineId must be a UUID"),
        quantity: z.number().int().positive(),
        condition: z.enum(["unopened", "used", "damaged"]),
        restock: z.boolean(),
        refundKobo: z.number().int().nonnegative().optional(),
      }),
    )
    .min(1, "At least one line is required"),
  reason: z.string().min(1, "A reason is required"),
  refundMethod: z.enum(["original", "transfer"]),
  internalNote: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "returns.create");

    if (!hasDatabase) {
      throw new AppError("DB_NOT_CONFIGURED", "Returns require DATABASE_URL.", 503);
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ValidationError({
        [issue?.path.join(".") ?? "body"]: issue?.message ?? "Invalid",
      });
    }
    const body = parsed.data;

    // Look up the order with its lines + existing returns so we can validate
    // available quantity (a single SKU can be returned across multiple visits).
    const order = await db.order.findUnique({
      where: { number: body.orderNumber },
      include: {
        customer: { select: { id: true, blacklisted: true } },
        lines: {
          include: {
            returnLines: { select: { quantity: true } },
          },
        },
      },
    });
    if (!order) throw new NotFoundError(`Order ${body.orderNumber}`);
    if (!order.customerId || !order.customer) {
      throw new ConflictError(
        "Order has no linked customer — guest walk-ins can't be returned via this flow yet",
      );
    }
    if (order.customer.blacklisted) {
      throw new ConflictError("Customer is blacklisted — escalate to manager");
    }

    // Outside-window flag (per CLAUDE.md §20). Doesn't block — just records the
    // fact for the audit + UI alert.
    const deliveredAt = order.deliveredAt;
    const outsideWindow =
      deliveredAt != null &&
      Date.now() - deliveredAt.getTime() > RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;

    // Validate every requested line: exists on this order + within remaining qty.
    const lineByOrderLineId = new Map(order.lines.map((l) => [l.id, l]));
    type Prepared = {
      orderLineId: string;
      productId: string;
      variantId: string | null;
      quantity: number;
      condition: "unopened" | "used" | "damaged";
      restock: boolean;
      unitKobo: number;
      refundKobo: number;
    };
    const prepared: Prepared[] = [];

    for (const req of body.lines) {
      const ol = lineByOrderLineId.get(req.orderLineId);
      if (!ol) {
        throw new NotFoundError(`Order line ${req.orderLineId}`);
      }
      const alreadyReturned = ol.returnLines.reduce((a, r) => a + r.quantity, 0);
      const remaining = ol.quantity - alreadyReturned;
      if (req.quantity > remaining) {
        throw new ConflictError(
          `${ol.nameSnapshot}: only ${remaining} unit${remaining === 1 ? "" : "s"} still returnable (requested ${req.quantity})`,
        );
      }
      const unitKobo = Number(ol.unitKobo);
      const refundKobo = req.refundKobo ?? unitKobo * req.quantity;
      // Damaged items default to no-restock per CLAUDE.md §20. Staff can still
      // override (we don't force it server-side, but flag in audit metadata).
      prepared.push({
        orderLineId: ol.id,
        productId: ol.productId,
        variantId: ol.variantId,
        quantity: req.quantity,
        condition: req.condition,
        restock: req.restock,
        unitKobo,
        refundKobo,
      });
    }

    const totalRefundKobo = prepared.reduce((a, l) => a + l.refundKobo, 0);

    // Will the order be fully returned after this batch?
    const willBeFullyReturned = order.lines.every((ol) => {
      const previouslyReturned = ol.returnLines.reduce((a, r) => a + r.quantity, 0);
      const reqForThisLine = prepared.find((p) => p.orderLineId === ol.id);
      const nextReturned = previouslyReturned + (reqForThisLine?.quantity ?? 0);
      return nextReturned >= ol.quantity;
    });

    const result = await db.$transaction(
      async (tx) => {
        const number = await nextReturnNumber(tx);

        const created = await tx.return.create({
          data: {
            number,
            orderId: order.id,
            customerId: order.customerId!,
            // Counter return: item is already in hand, so we open it past
            // `requested` and `in_transit` straight to `received`.
            status: "received",
            reason: body.reason,
            refundKobo: BigInt(totalRefundKobo),
            refundMethod: body.refundMethod,
            outsideWindow,
            fullyReturned: willBeFullyReturned,
            internalNote: body.internalNote ?? null,
            lines: {
              create: prepared.map((p) => ({
                orderLineId: p.orderLineId,
                quantity: p.quantity,
                condition: p.condition,
                restock: p.restock,
                refundKobo: BigInt(p.refundKobo),
              })),
            },
          },
          include: { lines: true },
        });

        // Restock — only when the variant exists and the line opted in.
        for (const p of prepared) {
          if (!p.restock || !p.variantId) continue;
          const v = await tx.productVariant.findUnique({
            where: { id: p.variantId },
            select: { onHand: true, label: true, sku: true },
          });
          if (!v) continue;
          await tx.productVariant.update({
            where: { id: p.variantId },
            data: { onHand: { increment: p.quantity } },
          });
          await writeAudit(
            {
              actorUserId: session.id,
              actorType: "staff",
              action: "product.stock_adjust",
              entityType: "product_variant",
              entityId: p.variantId,
              before: { onHand: v.onHand },
              after: { onHand: v.onHand + p.quantity },
              metadata: {
                reason: "return",
                returnId: created.id,
                returnNumber: number,
                orderNumber: body.orderNumber,
                condition: p.condition,
                delta: p.quantity,
              },
            },
            tx,
          );
        }

        await writeAudit(
          {
            actorUserId: session.id,
            actorType: "staff",
            action: "return.create",
            entityType: "return",
            entityId: created.id,
            after: {
              number: created.number,
              orderNumber: body.orderNumber,
              status: created.status,
              refundKobo: totalRefundKobo,
              refundMethod: body.refundMethod,
              lines: created.lines.length,
              outsideWindow,
              fullyReturned: willBeFullyReturned,
            },
          },
          tx,
        );

        return created;
      },
      { timeout: 20_000, maxWait: 10_000 },
    );

    void emailOnReturnReceived(result.id);

    return NextResponse.json(
      apiSuccess({
        return: {
          id: result.id,
          number: result.number,
          status: result.status,
          refundKobo: Number(result.refundKobo),
        },
      }),
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
