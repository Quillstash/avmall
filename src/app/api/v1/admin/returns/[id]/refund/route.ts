/**
 * POST /api/v1/admin/returns/:id/refund
 *
 * Issues the refund recorded on a Return. Updates the originating Order's
 * paid_kobo (-= refund) and payment_status.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { emailOnRefundProcessed } from "@/lib/return-emails";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

const bodySchema = z.object({
  method: z.enum(["original", "transfer"]).default("original"),
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

    const refundedReturnId = await db.$transaction(async (tx) => {
      const ret = await tx.return.findUnique({
        where: { number: params.id },
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

      return ret.id;
    });

    const methodLabel =
      parsed.data.method === "original" ? "Original payment method" : "Bank transfer";
    void emailOnRefundProcessed(refundedReturnId, methodLabel);

    return NextResponse.json(apiSuccess({ status: "refunded" }));
  } catch (err) {
    return handleApiError(err);
  }
}
