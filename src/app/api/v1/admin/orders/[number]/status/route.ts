/**
 * POST /api/v1/admin/orders/:number/status
 *
 * Set an order's status directly. Admin can jump to any forward status
 * without following the strict one-step machine — e.g. confirmed → shipped
 * in one click. Backwards moves (e.g. delivered → pending) are blocked.
 * Cancel uses /cancel. Refund uses /refund.
 *
 * Shipping (any transition → "shipped") consumes active stock reservations
 * and sends the shipped email.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { consumeReservations } from "@/lib/stock";
import { writeAudit } from "@/lib/audit";
import { emailOnOrderShipped } from "@/lib/order-emails";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

// Order rank — higher = further along. Used to block backwards moves.
const STATUS_RANK: Record<string, number> = {
  pending: 0,
  confirmed: 1,
  processing: 2,
  shipped: 3,
  delivered: 4,
};

const bodySchema = z.object({
  status: z.enum(["confirmed", "processing", "shipped", "delivered"]),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { number: string } },
) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "orders.edit");

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError({ status: "Invalid status" });

    const { status: newStatus } = parsed.data;

    const updated = await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { number: params.number },
        include: { reservations: { where: { status: "active" } } },
      });
      if (!order) throw new NotFoundError("Order");
      if (order.status === "cancelled") throw new ConflictError("Order is cancelled");
      if (order.status === newStatus) throw new ConflictError(`Order is already ${newStatus}`);

      const currentRank = STATUS_RANK[order.status] ?? 0;
      const newRank = STATUS_RANK[newStatus] ?? 0;
      if (newRank < currentRank) {
        throw new ConflictError(`Cannot move backwards from "${order.status}" to "${newStatus}"`);
      }

      // Shipping (reaching "shipped" for the first time) consumes reservations
      const wasNotShipped = order.status !== "shipped" && order.status !== "delivered";
      if (newStatus === "shipped" && wasNotShipped && order.reservations.length > 0) {
        await consumeReservations(tx, order.reservations.map((r) => r.id));
      }

      const next = await tx.order.update({
        where: { id: order.id },
        data: {
          status: newStatus,
          ...(newStatus === "shipped" && wasNotShipped && { shippedAt: new Date() }),
        },
      });

      await writeAudit(
        {
          actorUserId: session.id,
          actorType: "staff",
          action: `order.${newStatus}`,
          entityType: "order",
          entityId: order.id,
          before: { status: order.status },
          after: { status: newStatus },
        },
        tx,
      );

      return next;
    });

    if (updated.status === "shipped") {
      void emailOnOrderShipped(updated.id, {});
    }

    return NextResponse.json(apiSuccess({ status: updated.status }));
  } catch (err) {
    return handleApiError(err);
  }
}
