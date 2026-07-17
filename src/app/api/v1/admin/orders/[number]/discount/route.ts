/**
 * POST /api/v1/admin/orders/:number/discount
 *
 * Set the manual (staff) discount on an order in kobo. Per the edge-case
 * catalogue, a manual discount that would exceed the discountable product total
 * is capped server-side (never lets the total go negative) and the response
 * flags `capped` so the UI can warn. Recomputes total + payment status against
 * what's already paid, and audits the before/after.
 *
 * Allowed on any non-cancelled order (including delivered) so staff can correct
 * a recorded sale. Requires the dedicated `orders.apply_manual_discount`
 * permission, not just `orders.edit`.
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
  manualDiscountKobo: z
    .number()
    .int("Discount must be a whole number of kobo")
    .min(0, "Discount cannot be negative"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { number: string } },
) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "orders.apply_manual_discount");

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ValidationError({
        manualDiscountKobo: parsed.error.issues[0]?.message ?? "Invalid",
      });
    }

    const requested = parsed.data.manualDiscountKobo;

    const result = await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { number: params.number } });
      if (!order) throw new NotFoundError("Order");
      if (order.status === "cancelled") {
        throw new AppError("CONFLICT", "Cannot edit a cancelled order", 409);
      }

      const subtotal = Number(order.subtotalKobo);
      const bulk = Number(order.bulkDiscountKobo);
      const coupon = Number(order.couponDiscountKobo);
      const shipping = Number(order.shippingKobo);
      const paid = Number(order.paidKobo);

      // The product total left to discount after bulk + coupon. Manual discount
      // can't push this below zero — cap it here (shipping is charged on top).
      const discountableBase = Math.max(0, subtotal - bulk - coupon);
      const capped = requested > discountableBase;
      const manual = capped ? discountableBase : requested;

      const totalKobo = Math.max(0, subtotal - bulk - coupon - manual) + shipping;
      const paymentStatus =
        order.paymentStatus === "refunded"
          ? "refunded"
          : paid >= totalKobo
            ? "paid"
            : paid > 0
              ? "partial"
              : "unpaid";

      const prevManual = Number(order.manualDiscountKobo);
      if (manual === prevManual) {
        return { manualDiscountKobo: manual, totalKobo, paymentStatus, capped };
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          manualDiscountKobo: BigInt(manual),
          totalKobo: BigInt(totalKobo),
          paymentStatus,
        },
      });

      await writeAudit(
        {
          actorUserId: session.id,
          actorType: "staff",
          action: "order.manual_discount.set",
          entityType: "order",
          entityId: order.id,
          before: {
            manualDiscountKobo: prevManual,
            totalKobo: Number(order.totalKobo),
            paymentStatus: order.paymentStatus,
          },
          after: { manualDiscountKobo: manual, totalKobo, paymentStatus, requestedKobo: requested },
        },
        tx,
      );

      return { manualDiscountKobo: manual, totalKobo, paymentStatus, capped };
    });

    return NextResponse.json(apiSuccess(result));
  } catch (err) {
    return handleApiError(err);
  }
}
