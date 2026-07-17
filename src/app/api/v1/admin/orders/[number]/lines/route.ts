/**
 * POST /api/v1/admin/orders/:number/lines — add a new line item to an order.
 *
 * Accepts { productId, variantId?, quantity }.
 * If variantId is omitted, the first non-archived variant is used automatically.
 * Recalculates and persists order totals on success.
 * Blocked only on cancelled orders. Shipped/delivered orders are editable —
 * the added units are drawn straight from committed on_hand stock.
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

const bodySchema = z.object({
  productId: z.string().uuid("Invalid product ID"),
  variantId: z.string().uuid("Invalid variant ID").nullable().optional(),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
});

type Params = { params: { number: string } };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "orders.edit");

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ValidationError({ quantity: parsed.error.issues[0]?.message ?? "Invalid" });
    }

    const { productId, variantId: requestedVariantId, quantity } = parsed.data;

    const result = await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { number: params.number },
        include: {
          lines: { include: { product: { include: { bulkTiers: true } }, variant: true } },
        },
      });
      if (!order) throw new NotFoundError("Order");
      if (order.status === "cancelled") {
        throw new AppError("CONFLICT", "Cannot add lines to a cancelled order", 409);
      }
      // Shipped/delivered orders draw the new units straight from on_hand.
      const committed = order.status === "shipped" || order.status === "delivered";

      // Resolve product + variant
      const product = await tx.product.findUnique({
        where: { id: productId },
        include: {
          variants: { where: { archivedAt: null }, orderBy: { position: "asc" }, take: 1 },
          bulkTiers: true,
        },
      });
      if (!product || product.archivedAt) throw new NotFoundError("Product");

      let variant = product.variants[0] ?? null;

      if (requestedVariantId) {
        const specificVariant = await tx.productVariant.findUnique({
          where: { id: requestedVariantId },
        });
        if (!specificVariant || specificVariant.productId !== productId) {
          throw new NotFoundError("Variant");
        }
        variant = specificVariant;
      }

      const unitKobo = variant?.priceKobo
        ? Number(variant.priceKobo)
        : product.saleActive && product.saleKobo != null
          ? Number(product.saleKobo)
          : Number(product.priceKobo);

      const newLine = await tx.orderLine.create({
        data: {
          orderId: order.id,
          productId: product.id,
          variantId: variant?.id ?? null,
          nameSnapshot: product.name,
          variantSnapshot: variant?.label ?? null,
          skuSnapshot: variant?.sku ?? product.slug,
          quantity,
          unitKobo: BigInt(unitKobo),
          bulkDiscountKobo: BigInt(0),
          bulkTierLabel: null,
        },
      });

      if (committed && variant?.id && order.storeId) {
        // Delivered/shipped: the added units leave the shelf now (throws if
        // there isn't enough on-hand).
        await adjustCommittedStock(tx, order.storeId, variant.id, quantity);
      }

      // Recalculate totals from all lines including the new one
      const allLines = [
        ...order.lines.map((l) => ({
          productId: l.productId,
          variantId: l.variantId,
          quantity: l.quantity,
          unitKobo: Number(l.unitKobo),
          bulkTiers: (l.product?.bulkTiers ?? []).map((t) => ({
            min: t.min, max: t.max, type: t.type, value: t.value,
          })),
        })),
        {
          productId: product.id,
          variantId: variant?.id ?? null,
          quantity,
          unitKobo,
          bulkTiers: product.bulkTiers.map((t) => ({
            min: t.min, max: t.max, type: t.type, value: t.value,
          })),
        },
      ] satisfies QuoteInputLine[];

      const quote = computeQuote({ lines: allLines });
      // Preserve coupon + manual discounts (computeQuote only knows lines/bulk)
      // and re-derive payment status against what's already paid.
      const couponD = Number(order.couponDiscountKobo);
      const manualD = Number(order.manualDiscountKobo);
      const shipping = Number(order.shippingKobo);
      const newTotal = Math.max(
        0,
        quote.subtotalKobo - quote.bulkDiscountKobo - couponD - manualD + shipping,
      );
      const paid = Number(order.paidKobo);
      const newPaymentStatus =
        order.paymentStatus === "refunded"
          ? "refunded"
          : paid >= newTotal
            ? "paid"
            : paid > 0
              ? "partial"
              : "unpaid";

      await tx.order.update({
        where: { id: order.id },
        data: {
          subtotalKobo: BigInt(quote.subtotalKobo),
          bulkDiscountKobo: BigInt(quote.bulkDiscountKobo),
          totalKobo: BigInt(newTotal),
          paymentStatus: newPaymentStatus,
        },
      });

      // Update bulk discount on the new line if the quote computed one
      const quoteLine = quote.lines.find((ql) => ql.productId === product.id);
      if (quoteLine && quoteLine.bulkDiscountKobo > 0) {
        await tx.orderLine.update({
          where: { id: newLine.id },
          data: {
            bulkDiscountKobo: BigInt(quoteLine.bulkDiscountKobo),
            bulkTierLabel: quoteLine.bulkTierLabel,
          },
        });
      }

      await writeAudit(
        {
          actorUserId: session.id,
          actorType: "staff",
          action: "order.line_add",
          entityType: "order",
          entityId: order.id,
          before: { lineCount: order.lines.length },
          after: {
            lineId: newLine.id,
            product: product.name,
            variant: variant?.label ?? null,
            quantity,
            unitKobo,
          },
        },
        tx,
      );

      return { lineId: newLine.id };
    });

    return NextResponse.json(apiSuccess(result), { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
