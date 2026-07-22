/**
 * GET /api/v1/ai/tools/orders/by-phone?phone=<phone>&limit=<n>
 *
 * Returns the most recent orders for a phone number. Used when the customer
 * asks "where's my order?" without giving a number. Phone is normalised to
 * E.164 (+234…) before lookup.
 *
 * Auth: Bearer AI_AGENT_TOKEN
 */

import { NextRequest, NextResponse } from "next/server";
import { db, hasDatabase } from "@/lib/db";
import { requireAiAgent } from "@/lib/ai-auth";
import { getMainStoreId } from "@/lib/store";
import { normaliseNigerianPhone } from "@/lib/phone";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, ValidationError } from "@/lib/errors";
import { formatMoney } from "@/lib/money";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    requireAiAgent(req);

    if (!hasDatabase) {
      throw new AppError("DB_NOT_CONFIGURED", "Order lookup requires DATABASE_URL.", 503);
    }

    const rawPhone = req.nextUrl.searchParams.get("phone")?.trim();
    if (!rawPhone) throw new ValidationError({ phone: "phone is required" });

    const phone = normaliseNigerianPhone(rawPhone);

    const limitParam = Number(req.nextUrl.searchParams.get("limit"));
    const limit = Math.min(
      Math.max(1, Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 5),
      20,
    );

    const storeId = await getMainStoreId();
    const customer = storeId
      ? await db.customer.findFirst({
          where: { storeId, phone },
          select: { id: true, name: true, blacklisted: true },
        })
      : null;
    if (!customer) {
      return NextResponse.json(
        apiSuccess({ phone, customerFound: false, orders: [] }),
      );
    }

    const orders = await db.order.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        number: true,
        status: true,
        paymentStatus: true,
        totalKobo: true,
        paidKobo: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      apiSuccess({
        phone,
        customerFound: true,
        customer: { name: customer.name, blacklisted: customer.blacklisted },
        orders: orders.map((o) => ({
          number: o.number,
          status: o.status,
          paymentStatus: o.paymentStatus,
          total: formatMoney(Number(o.totalKobo)),
          paid: formatMoney(Number(o.paidKobo)),
          outstanding: formatMoney(Math.max(0, Number(o.totalKobo) - Number(o.paidKobo))),
          createdAt: o.createdAt.toISOString(),
        })),
      }),
    );
  } catch (err) {
    return handleApiError(err);
  }
}
