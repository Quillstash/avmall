/**
 * GET /api/v1/ai/tools/payments/[reference]
 *
 * Look up a payment by its reference (the one returned from
 * POST /api/v1/ai/tools/payments/link). Used by the AI to answer "did my
 * payment go through?" without exposing internal payment IDs.
 *
 * Auth: Bearer AI_AGENT_TOKEN
 */

import { NextRequest, NextResponse } from "next/server";
import { db, hasDatabase } from "@/lib/db";
import { requireAiAgent } from "@/lib/ai-auth";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, NotFoundError } from "@/lib/errors";
import { formatMoney } from "@/lib/money";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { reference: string } },
) {
  try {
    requireAiAgent(req);

    if (!hasDatabase) {
      throw new AppError("DB_NOT_CONFIGURED", "Payment lookup requires DATABASE_URL.", 503);
    }

    const payment = await db.orderPayment.findFirst({
      where: { reference: params.reference },
      include: {
        order: {
          select: {
            number: true,
            status: true,
            paymentStatus: true,
            totalKobo: true,
            paidKobo: true,
          },
        },
      },
    });
    if (!payment) throw new NotFoundError("Payment");

    return NextResponse.json(
      apiSuccess({
        reference: payment.reference,
        method: payment.method,
        amount: formatMoney(Number(payment.amountKobo)),
        status: payment.status,
        createdAt: payment.createdAt.toISOString(),
        order: {
          number: payment.order.number,
          status: payment.order.status,
          paymentStatus: payment.order.paymentStatus,
          total: formatMoney(Number(payment.order.totalKobo)),
          paid: formatMoney(Number(payment.order.paidKobo)),
          outstanding: formatMoney(
            Math.max(
              0,
              Number(payment.order.totalKobo) - Number(payment.order.paidKobo),
            ),
          ),
        },
      }),
    );
  } catch (err) {
    return handleApiError(err);
  }
}
