/**
 * GET /api/v1/ai/tools/orders/[number]
 *
 * Order status + summary for the AI. Compact JSON the agent can summarise
 * back to the customer ("your order ships in 24h").
 *
 * Auth: Bearer AI_AGENT_TOKEN
 */

import { NextRequest, NextResponse } from "next/server";
import { db, hasDatabase } from "@/lib/db";
import { requireAiAgent } from "@/lib/ai-auth";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, NotFoundError } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { number: string } },
) {
  try {
    requireAiAgent(req);

    if (!hasDatabase) {
      throw new AppError("DB_NOT_CONFIGURED", "Order lookup requires DATABASE_URL.", 503);
    }

    const order = await db.order.findUnique({
      where: { number: params.number },
      include: {
        lines: {
          select: {
            nameSnapshot: true,
            variantSnapshot: true,
            quantity: true,
            unitKobo: true,
          },
        },
        payments: {
          where: { status: { in: ["completed", "pending"] } },
          orderBy: { createdAt: "desc" },
          select: {
            method: true,
            amountKobo: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });
    if (!order) throw new NotFoundError("Order");

    const totalKobo = Number(order.totalKobo);
    const paidKobo = Number(order.paidKobo);

    return NextResponse.json(
      apiSuccess({
        number: order.number,
        status: order.status,
        paymentStatus: order.paymentStatus,
        source: order.source,
        createdAt: order.createdAt.toISOString(),
        ...(order.shippedAt && { shippedAt: order.shippedAt.toISOString() }),
        ...(order.deliveredAt && { deliveredAt: order.deliveredAt.toISOString() }),
        ...(order.cancelledAt && { cancelledAt: order.cancelledAt.toISOString() }),
        shipping: {
          name: order.shipName,
          phone: order.shipPhone,
          line1: order.shipLine1,
          line2: order.shipLine2 ?? null,
          city: order.shipCity,
          state: order.shipState,
        },
        totals: {
          subtotalKobo: Number(order.subtotalKobo),
          shippingKobo: Number(order.shippingKobo),
          discountKobo:
            Number(order.bulkDiscountKobo) +
            Number(order.couponDiscountKobo) +
            Number(order.manualDiscountKobo),
          totalKobo,
          paidKobo,
          outstandingKobo: Math.max(0, totalKobo - paidKobo),
        },
        items: order.lines.map((l) => ({
          name: l.nameSnapshot,
          variant: l.variantSnapshot,
          quantity: l.quantity,
          unitKobo: Number(l.unitKobo),
        })),
        payments: order.payments.map((p) => ({
          method: p.method,
          amountKobo: Number(p.amountKobo),
          status: p.status,
          at: p.createdAt.toISOString(),
        })),
      }),
    );
  } catch (err) {
    return handleApiError(err);
  }
}
