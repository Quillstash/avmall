/**
 * PATCH /api/v1/admin/orders/:number/lines/:lineId  — edit quantity
 * DELETE /api/v1/admin/orders/:number/lines/:lineId — remove line
 *
 * Both recalculate and persist the order totals so the DB stays consistent.
 * Removing the last line is blocked — cancel the order instead.
 * Stock reservations are adjusted: decreasing qty releases the difference;
 * removing a line releases all reservations for that line.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, NotFoundError, ValidationError } from "@/lib/errors";
import { computeQuote, type QuoteInputLine } from "@/lib/cart-quote";
import { adjustCommittedStock } from "@/lib/stock";

/**
 * Recompute an order's money after a line change, preserving coupon + manual
 * discounts (computeQuote only knows lines + bulk), and re-derive the payment
 * status against what's already been paid.
 */
function reconcileMoney(order: {
  couponDiscountKobo: bigint;
  manualDiscountKobo: bigint;
  shippingKobo: bigint;
  paidKobo: bigint;
  paymentStatus: string;
}, subtotalKobo: number, bulkDiscountKobo: number) {
  const couponD = Number(order.couponDiscountKobo);
  const manualD = Number(order.manualDiscountKobo);
  const shipping = Number(order.shippingKobo);
  const totalKobo = Math.max(0, subtotalKobo - bulkDiscountKobo - couponD - manualD + shipping);
  const paid = Number(order.paidKobo);
  const paymentStatus =
    order.paymentStatus === "refunded"
      ? "refunded"
      : paid >= totalKobo
        ? "paid"
        : paid > 0
          ? "partial"
          : "unpaid";
  return { totalKobo, paymentStatus } as const;
}

const patchSchema = z.object({
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
});

type Params = { params: { number: string; lineId: string } };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "orders.edit");

    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ValidationError({ quantity: parsed.error.issues[0]?.message ?? "Invalid" });
    }

    const { quantity: newQty } = parsed.data;

    await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { number: params.number },
        include: {
          lines: { include: { product: { include: { bulkTiers: true } }, variant: true } },
          reservations: { where: { status: "active" } },
        },
      });
      if (!order) throw new NotFoundError("Order");
      if (order.status === "cancelled") {
        throw new AppError("CONFLICT", "Cannot edit lines on a cancelled order", 409);
      }
      // Shipped/delivered orders had their reservations consumed, so their
      // stock now lives in on_hand — edits reconcile it directly.
      const committed = order.status === "shipped" || order.status === "delivered";

      const line = order.lines.find((l) => l.id === params.lineId);
      if (!line) throw new NotFoundError("Order line");

      const oldQty = line.quantity;
      const qtyDelta = newQty - oldQty;

      // Update the line
      await tx.orderLine.update({
        where: { id: params.lineId },
        data: { quantity: newQty },
      });

      if (committed && qtyDelta !== 0 && line.variantId && order.storeId) {
        // Stock already left the shelf — reconcile on_hand (down if qty up,
        // back on the shelf if qty down). Throws if increasing beyond on_hand.
        await adjustCommittedStock(tx, order.storeId, line.variantId, qtyDelta);
      }

      // Adjust the stock reservation (non-committed orders only).
      const reservation = order.reservations.find(
        (r) => r.productId === line.productId && r.variantId === line.variantId,
      );

      if (!committed && reservation && qtyDelta !== 0) {
        if (qtyDelta > 0) {
          // Increasing — check stock and add reservation
          const stock = await tx.$queryRaw<{ on_hand: number; reserved: number }[]>`
            SELECT on_hand, reserved FROM product_stock_levels
            WHERE product_id = ${line.productId}::uuid
              AND (variant_id = ${line.variantId ?? null}::uuid OR (variant_id IS NULL AND ${line.variantId ?? null}::uuid IS NULL))
            FOR UPDATE
          `.catch(() => [] as { on_hand: number; reserved: number }[]);
          if (stock.length > 0) {
            const available = stock[0]!.on_hand - stock[0]!.reserved;
            if (available < qtyDelta) {
              throw new AppError("STOCK_UNAVAILABLE", `Only ${available} additional units available`, 409);
            }
          }
          await tx.stockReservation.update({
            where: { id: reservation.id },
            data: { quantity: reservation.quantity + qtyDelta },
          });
        } else {
          // Decreasing — release the difference
          const newReservationQty = reservation.quantity + qtyDelta; // qtyDelta is negative
          if (newReservationQty <= 0) {
            await tx.stockReservation.update({
              where: { id: reservation.id },
              data: { status: "released", quantity: 0 },
            });
          } else {
            await tx.stockReservation.update({
              where: { id: reservation.id },
              data: { quantity: newReservationQty },
            });
          }
        }
      }

      // Recalculate order totals from all lines (including the updated one)
      const updatedLines = order.lines.map((l) => ({
        ...l,
        quantity: l.id === params.lineId ? newQty : l.quantity,
      }));

      const inputLines: QuoteInputLine[] = updatedLines.map((l) => ({
        productId: l.productId,
        variantId: l.variantId,
        quantity: l.quantity,
        unitKobo: Number(l.unitKobo),
        bulkTiers: (l.product?.bulkTiers ?? []).map((t) => ({
          min: t.min, max: t.max, type: t.type, value: t.value,
        })),
      }));

      const quote = computeQuote({ lines: inputLines });
      const money = reconcileMoney(order, quote.subtotalKobo, quote.bulkDiscountKobo);

      await tx.order.update({
        where: { id: order.id },
        data: {
          subtotalKobo: BigInt(quote.subtotalKobo),
          bulkDiscountKobo: BigInt(quote.bulkDiscountKobo),
          totalKobo: BigInt(money.totalKobo),
          paymentStatus: money.paymentStatus,
        },
      });

      // Also update the line's bulk discount
      const updatedLine = inputLines.find((l) => l.productId === line.productId && l.variantId === line.variantId);
      const quoteLineData = quote.lines.find((ql) => ql.productId === line.productId);
      if (quoteLineData) {
        await tx.orderLine.update({
          where: { id: params.lineId },
          data: { bulkDiscountKobo: BigInt(quoteLineData.bulkDiscountKobo) },
        });
      }

      await writeAudit(
        {
          actorUserId: session.id,
          actorType: "staff",
          action: "order.line_edit",
          entityType: "order",
          entityId: order.id,
          before: { lineId: params.lineId, quantity: oldQty },
          after: { lineId: params.lineId, quantity: newQty },
        },
        tx,
      );
    });

    return NextResponse.json(apiSuccess({ updated: true }));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "orders.edit");

    await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { number: params.number },
        include: {
          lines: { include: { product: { include: { bulkTiers: true } }, variant: true } },
          reservations: { where: { status: "active" } },
        },
      });
      if (!order) throw new NotFoundError("Order");
      if (order.status === "cancelled") {
        throw new AppError("CONFLICT", "Cannot edit lines on a cancelled order", 409);
      }
      const committed = order.status === "shipped" || order.status === "delivered";

      const line = order.lines.find((l) => l.id === params.lineId);
      if (!line) throw new NotFoundError("Order line");

      if (order.lines.length === 1) {
        throw new AppError("CONFLICT", "Cannot remove the last item — cancel the order instead", 409);
      }

      if (committed && line.variantId && order.storeId) {
        // Stock already committed — put the whole line's quantity back on the shelf.
        await adjustCommittedStock(tx, order.storeId, line.variantId, -line.quantity);
      } else {
        // Non-committed — release this line's reservation.
        const reservation = order.reservations.find(
          (r) => r.productId === line.productId && r.variantId === line.variantId,
        );
        if (reservation) {
          await tx.stockReservation.update({
            where: { id: reservation.id },
            data: { status: "released", quantity: 0 },
          });
        }
      }

      await tx.orderLine.delete({ where: { id: params.lineId } });

      // Recalculate totals from remaining lines
      const remainingLines = order.lines.filter((l) => l.id !== params.lineId);
      const inputLines: QuoteInputLine[] = remainingLines.map((l) => ({
        productId: l.productId,
        variantId: l.variantId,
        quantity: l.quantity,
        unitKobo: Number(l.unitKobo),
        bulkTiers: (l.product?.bulkTiers ?? []).map((t) => ({
          min: t.min, max: t.max, type: t.type, value: t.value,
        })),
      }));

      const quote = computeQuote({ lines: inputLines });
      const money = reconcileMoney(order, quote.subtotalKobo, quote.bulkDiscountKobo);

      await tx.order.update({
        where: { id: order.id },
        data: {
          subtotalKobo: BigInt(quote.subtotalKobo),
          bulkDiscountKobo: BigInt(quote.bulkDiscountKobo),
          totalKobo: BigInt(money.totalKobo),
          paymentStatus: money.paymentStatus,
        },
      });

      await writeAudit(
        {
          actorUserId: session.id,
          actorType: "staff",
          action: "order.line_remove",
          entityType: "order",
          entityId: order.id,
          before: { lineId: params.lineId, name: line.nameSnapshot, quantity: line.quantity },
          after: { removed: true },
        },
        tx,
      );
    });

    return NextResponse.json(apiSuccess({ removed: true }));
  } catch (err) {
    return handleApiError(err);
  }
}
