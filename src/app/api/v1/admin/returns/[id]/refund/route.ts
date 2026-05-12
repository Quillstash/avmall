/**
 * POST /api/v1/admin/returns/:id/refund
 *
 * Issues the refund recorded on a Return. Updates the originating Order's
 * paid_kobo (-= refund) and payment_status. When the refund method is
 * `credit`, the customer's store credit is bumped instead of issuing money.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

const bodySchema = z.object({
  method: z.enum(["original", "credit", "transfer"]).default("original"),
  /** Optional override — usually we use Return.refundKobo */
  amountKobo: z.number().int().nonnegative().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "returns.refund");

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError({ method: "Invalid" });

    await db.$transaction(async (tx) => {
      const ret = await tx.return.findUnique({
        where: { id: params.id },
        include: { order: true, customer: true },
      });
      if (!ret) throw new NotFoundError("Return");
      if (ret.status === "refunded") {
        throw new ConflictError("Already refunded");
      }

      const refundKobo = BigInt(
        parsed.data.amountKobo != null ? parsed.data.amountKobo : Number(ret.refundKobo),
      );

      // Apply the refund to the originating order's totals
      const newPaid = ret.order.paidKobo - refundKobo;
      const paymentStatus =
        newPaid <= 0n
          ? "refunded"
          : newPaid < ret.order.totalKobo
            ? "partial"
            : "paid";

      await tx.order.update({
        where: { id: ret.order.id },
        data: {
          paidKobo: newPaid > 0n ? newPaid : 0n,
          paymentStatus,
        },
      });

      // Store-credit option: bump customer wallet.
      if (parsed.data.method === "credit") {
        // 5% bonus per CLAUDE.md §15 (returns can offer this).
        const bonus = (refundKobo * 5n) / 100n;
        await tx.customer.update({
          where: { id: ret.customer.id },
          data: { storeCreditKobo: { increment: refundKobo + bonus } },
        });
      }

      await tx.return.update({
        where: { id: ret.id },
        data: {
          status: "refunded",
          refundMethod: parsed.data.method,
          refundKobo,
        },
      });

      await writeAudit(
        {
          actorUserId: session.id,
          actorType: "staff",
          action: "return.refund",
          entityType: "return",
          entityId: ret.id,
          after: {
            method: parsed.data.method,
            refundKobo: Number(refundKobo),
          },
        },
        tx,
      );
    });

    return NextResponse.json(apiSuccess({ status: "refunded" }));
  } catch (err) {
    return handleApiError(err);
  }
}
