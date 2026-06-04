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
      if (order.status === "cancelled" || order.status === "delivered") {
        throw new AppError("CONFLICT", `Cannot edit lines on a ${order.status} order`, 409);
      }

      const line = order.lines.find((l) => l.id === params.lineId);
      if (!line) throw new NotFoundError("Order line");

      const oldQty = line.quantity;

      // Update the line
      await tx.orderLine.update({
        where: { id: params.lineId },
        data: { quantity: newQty },
      });

      // Adjust stock reservation for this line
      const reservation = order.reservations.find(
        (r) => r.productId === line.productId && r.variantId === line.variantId,
      );
      const qtyDelta = newQty - oldQty;

      if (reservation && qtyDelta !== 0) {
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

      const quote = computeQuote({
        lines: inputLines,
        shippingKobo: Number(order.shippingKobo),
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          subtotalKobo: BigInt(quote.subtotalKobo),
          bulkDiscountKobo: BigInt(quote.bulkDiscountKobo),
          totalKobo: BigInt(quote.totalKobo),
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
      if (order.status === "cancelled" || order.status === "delivered") {
        throw new AppError("CONFLICT", `Cannot edit lines on a ${order.status} order`, 409);
      }

      const line = order.lines.find((l) => l.id === params.lineId);
      if (!line) throw new NotFoundError("Order line");

      if (order.lines.length === 1) {
        throw new AppError("CONFLICT", "Cannot remove the last item — cancel the order instead", 409);
      }

      // Release this line's stock reservation
      const reservation = order.reservations.find(
        (r) => r.productId === line.productId && r.variantId === line.variantId,
      );
      if (reservation) {
        await tx.stockReservation.update({
          where: { id: reservation.id },
          data: { status: "released", quantity: 0 },
        });
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

      const quote = computeQuote({
        lines: inputLines,
        shippingKobo: Number(order.shippingKobo),
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          subtotalKobo: BigInt(quote.subtotalKobo),
          bulkDiscountKobo: BigInt(quote.bulkDiscountKobo),
          totalKobo: BigInt(quote.totalKobo),
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
