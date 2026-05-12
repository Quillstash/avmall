/**
 * POST /api/v1/admin/orders/:number/cancel
 *
 * Cancels an order. Releases any active stock reservations so the units
 * become available again. Audit-logged. Requires `orders.cancel` permission.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { releaseReservations } from "@/lib/stock";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

const bodySchema = z.object({
  reason: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { number: string } },
) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "orders.cancel");

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError({ reason: "Invalid" });

    const updated = await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { number: params.number },
        include: { reservations: { where: { status: "active" } } },
      });
      if (!order) throw new NotFoundError("Order");
      if (order.status === "cancelled") {
        throw new ConflictError("Order is already cancelled");
      }
      if (order.status === "shipped" || order.status === "delivered") {
        throw new ConflictError("Cannot cancel a shipped or delivered order");
      }

      await releaseReservations(
        tx,
        order.reservations.map((r) => r.id),
      );

      const next = await tx.order.update({
        where: { id: order.id },
        data: {
          status: "cancelled",
          cancelledAt: new Date(),
        },
      });

      await writeAudit(
        {
          actorUserId: session.id,
          actorType: "staff",
          action: "order.cancel",
          entityType: "order",
          entityId: order.id,
          before: { status: order.status },
          after: { status: "cancelled" },
          metadata: parsed.data.reason ? { reason: parsed.data.reason } : {},
        },
        tx,
      );

      return next;
    });

    return NextResponse.json(apiSuccess({ status: updated.status }));
  } catch (err) {
    return handleApiError(err);
  }
}
