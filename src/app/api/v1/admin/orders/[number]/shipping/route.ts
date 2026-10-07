/**
 * POST /api/v1/admin/orders/:number/shipping   { shippingKobo }
 *
 * Set an order's delivery fee. Needed when the fee wasn't known at order time:
 * the AI places orders for addresses with no delivery price as "delivery fee
 * to be confirmed" (₦0 + an order note), and staff add the real fee here once
 * they've agreed it with the customer. Recomputes the total and payment status
 * against what's already paid, and audits the before/after.
 *
 * Any non-cancelled order. Permission: `orders.edit`.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, NotFoundError, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

const bodySchema = z.object({
  shippingKobo: z
    .number()
    .int("Delivery fee must be a whole number of kobo")
    .min(0, "Delivery fee cannot be negative"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { number: string } },
) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "orders.edit");

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ValidationError({ shippingKobo: parsed.error.issues[0]?.message ?? "Invalid" });
    }
    const shipping = parsed.data.shippingKobo;

    const result = await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { number: params.number } });
      if (!order) throw new NotFoundError("Order");
      if (order.status === "cancelled") {
        throw new AppError("CONFLICT", "Cannot edit a cancelled order", 409);
      }

      const products =
        Number(order.subtotalKobo) -
        Number(order.bulkDiscountKobo) -
        Number(order.couponDiscountKobo) -
        Number(order.manualDiscountKobo);
      const totalKobo = Math.max(0, products) + shipping;
      const paid = Number(order.paidKobo);
      const paymentStatus =
        order.paymentStatus === "refunded"
          ? "refunded"
          : paid >= totalKobo
            ? "paid"
            : paid > 0
              ? "partial"
              : "unpaid";

      const prev = Number(order.shippingKobo);
      if (shipping === prev) return { shippingKobo: shipping, totalKobo, paymentStatus };

      await tx.order.update({
        where: { id: order.id },
        data: { shippingKobo: BigInt(shipping), totalKobo: BigInt(totalKobo), paymentStatus },
      });

      await writeAudit(
        {
          actorUserId: session.id,
          actorType: "staff",
          action: "order.shipping.set",
          entityType: "order",
          entityId: order.id,
          before: { shippingKobo: prev, totalKobo: Number(order.totalKobo), paymentStatus: order.paymentStatus },
          after: { shippingKobo: shipping, totalKobo, paymentStatus },
        },
        tx,
      );

      return { shippingKobo: shipping, totalKobo, paymentStatus };
    });

    return NextResponse.json(apiSuccess(result));
  } catch (err) {
    return handleApiError(err);
  }
}
