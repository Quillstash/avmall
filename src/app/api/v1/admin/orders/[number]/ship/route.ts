/**
 * POST /api/v1/admin/orders/:number/ship
 *
 * Mark an order as shipped. Spec policy: only when fully paid, unless the
 * staff explicitly passes `override: true` AND has the override permission.
 * Consumes the active stock reservations (on_hand decremented).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { consumeReservations } from "@/lib/stock";
import { writeAudit } from "@/lib/audit";
import { emailOnOrderShipped } from "@/lib/order-emails";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";

const bodySchema = z.object({
  override: z.boolean().optional(),
  trackingNumber: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { number: string } },
) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "orders.edit");

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError({ body: "Invalid" });

    const updated = await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { number: params.number },
        include: {
          reservations: { where: { status: "active" } },
          installmentPlan: true,
        },
      });
      if (!order) throw new NotFoundError("Order");
      if (order.status === "cancelled") throw new ConflictError("Order is cancelled");
      if (order.status === "shipped" || order.status === "delivered") {
        throw new ConflictError(`Order already ${order.status}`);
      }

      // Buy-now-pay-later: an active installment plan is an explicit agreement
      // to fulfil before full payment, so the paid-in-full gate doesn't apply.
      const onInstallmentPlan = order.installmentPlan?.status === "active";
      const paidInFull = order.paidKobo >= order.totalKobo;
      if (!paidInFull && !onInstallmentPlan) {
        if (!parsed.data.override) {
          throw new ConflictError(
            "Order is not paid in full — pass override:true to ship anyway (Manager+)",
          );
        }
        if (!hasPermission(session, "orders.override_partial_paid")) {
          throw new ForbiddenError("Manager+ required to ship a partially-paid order");
        }
      }

      await consumeReservations(
        tx,
        order.reservations.map((r) => r.id),
      );

      const next = await tx.order.update({
        where: { id: order.id },
        data: { status: "shipped", shippedAt: new Date() },
      });

      await writeAudit(
        {
          actorUserId: session.id,
          actorType: "staff",
          action: "order.ship",
          entityType: "order",
          entityId: order.id,
          before: { status: order.status },
          after: { status: "shipped" },
          metadata: parsed.data.override ? { override: true } : {},
        },
        tx,
      );

      return next;
    });

    void emailOnOrderShipped(updated.id, {
      ...(parsed.data.trackingNumber && { trackingNumber: parsed.data.trackingNumber }),
    });

    return NextResponse.json(apiSuccess({ status: updated.status }));
  } catch (err) {
    return handleApiError(err);
  }
}
